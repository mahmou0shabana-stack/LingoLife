#!/usr/bin/env python3
"""
LingoLife — جسر تطوير محلّي لمزوّدات TTS خارجية (RHVoice · XTTS)

أداة تطوير فقط — لا تُشحَن مع الـPWA ولا تُنشر معه. تشغّلها بنفسك محليًّا
حين تريد محرّك نطقٍ لا يعمل داخل المتصفّح.

    python3 scripts/tts-bridge/server.py

يرتبط بـ 127.0.0.1:8765 افتراضيًّا فقط — لا يُعرَّض للشبكة، ولا سرّ ولا
مفتاح API هنا ولا في أيّ كودٍ يستدعيه من الواجهة الأمامية.

اعتماديّاته من مكتبة بايثون القياسية وحدها. والمحرّكاتُ **تُكتشَف** عند
التشغيل ولا تُفترَض:

    RHVoice  ← الأداة `RHVoice-test` وأصواتُها المثبَّتة
               (Ubuntu/Debian: apt install rhvoice rhvoice-russian)
    XTTS     ← مكتبة Coqui `TTS` (pip install TTS) ونموذجُ xtts_v2
               الذي تُنزّله المكتبةُ عند أوّل استعمال

النقاط (يقرؤها `js/services/shadow/tts/local-bridge.js`):

    GET  /health                 → {"status":"ok","engines":{"rhvoice":{"available","reason"},"xtts":{…}}}
    GET  /voices?engine=rhvoice  → {"voices":[{"id","name","language","gender"?}]}
    POST /synthesize             جسمٌ {"engine","text","language","voice","speed"}
                                  يُرجع WAV في الجسم عند 200، أو JSON خطأ + رمز غير 200.

══════════ ⚠️ لماذا كان «XTTS» يظهر غيرَ متاحٍ والجسرُ يعمل ══════════

التطبيقُ على أصلٍ آخر (GitHub Pages، أو http://localhost:8124 في التطوير)،
والجسرُ على http://localhost:8765 — فكلُّ طلبٍ منه **عابرٌ للأصول**. وكان
الجسرُ لا يرسل رؤوسَ CORS ولا يجيب `OPTIONS` (501)، فيحجب المتصفّحُ كلَّ
ردٍّ منه: `/health` يفشل في الصفحة وهو ينجح في curl، فيُقال «الجسر غير
متّصل». والآن:
  · `Access-Control-Allow-Origin` لأصول التطبيق وحدها (لا `*`):
    localhost/127.0.0.1 بأيّ منفذ، وصفحةُ GitHub للمشروع، وما يُضاف في
    `LINGOLIFE_BRIDGE_ORIGINS` (مفصولةً بفواصل).
  · `OPTIONS` تجيب الطلبَ التمهيديّ لـPOST بجسم JSON.
  · `Access-Control-Allow-Private-Network: true` — Chrome يشترطها قبل أن
    تستدعي صفحةٌ عامّة (https) عنوانًا محلّيًّا (Private Network Access).

⚠️ **السرعةُ لا تُطبَّق هنا.** المتصفّح يضبطها على الملفّ نفسِه
   (`playbackRate` في speaker-adapter.js)؛ لو طبّقها المحرّكُ أيضًا لتضاعفت.
   فالمحرّكُ يولّد بسرعته الطبيعيّة دائمًا.
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HOST = "127.0.0.1"  # لا 0.0.0.0 أبدًا — محلّيٌّ فقط
PORT = int(os.environ.get("LINGOLIFE_BRIDGE_PORT", "8765"))
SYNTH_TIMEOUT_S = 30

# ══════════ الأصولُ المسموح لها ══════════

ALLOWED_ORIGINS = {"https://mahmou0shabana-stack.github.io"}
ALLOWED_ORIGINS.update(
    o.strip() for o in os.environ.get("LINGOLIFE_BRIDGE_ORIGINS", "").split(",") if o.strip()
)
LOCAL_ORIGIN = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")


def origin_allowed(origin):
    return bool(origin) and (origin in ALLOWED_ORIGINS or bool(LOCAL_ORIGIN.match(origin)))


# ══════════ RHVoice — عبر أداته الرسميّة `RHVoice-test` ══════════

RHVOICE_BIN = shutil.which("RHVoice-test")
RHVOICE_DIRS = [
    d for d in [
        os.environ.get("RHVOICE_VOICES_DIR"),
        "/usr/share/RHVoice/voices",
        "/usr/local/share/RHVoice/voices",
        os.path.expanduser("~/.local/share/RHVoice/voices"),
    ] if d
]

# اسمُ اللغة في voice.info ← رمزُها. ما ليس هنا يُعاد بحرفه — لا يُخمَّن.
LANGUAGE_CODES = {"Russian": "ru", "English": "en", "Ukrainian": "uk", "Kyrgyz": "ky", "Tatar": "tt"}


def _read_voice_info(path):
    info = {}
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if "=" in line:
                    key, value = line.split("=", 1)
                    info[key.strip()] = value.strip()
    except OSError:
        return None
    return info


def rhvoice_voices():
    voices, seen = [], set()
    for base in RHVOICE_DIRS:
        if not os.path.isdir(base):
            continue
        for folder in sorted(os.listdir(base)):
            info = _read_voice_info(os.path.join(base, folder, "voice.info"))
            if not info or folder in seen:
                continue
            seen.add(folder)
            voice = {"id": folder, "name": info.get("name", folder)}
            language = info.get("language")
            if language:
                voice["language"] = LANGUAGE_CODES.get(language, language)
            if info.get("gender"):
                voice["gender"] = info["gender"]
            voices.append(voice)
    return voices


def rhvoice_state():
    if not RHVOICE_BIN:
        return False, "RHVoice غير مثبّت على هذا الجهاز — ثبّته (مثلًا: apt install rhvoice rhvoice-russian) ثمّ أعِد تشغيل الجسر"
    if not rhvoice_voices():
        return False, "RHVoice مثبّت بلا أصوات — ثبّت حزمة أصوات (مثلًا: rhvoice-russian)"
    return True, ""


def rhvoice_synthesize(text, voice):
    ids = {v["id"] for v in rhvoice_voices()}
    if voice and voice not in ids:
        raise ValueError(f"unknown-voice: {voice}")
    profile = voice or sorted(ids)[0]
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "out.wav")
        subprocess.run(
            [RHVOICE_BIN, "-p", profile, "-o", out],
            input=text.encode("utf-8"), capture_output=True, timeout=SYNTH_TIMEOUT_S, check=True,
        )
        with open(out, "rb") as fh:
            data = fh.read()
    if len(data) <= 44:
        raise RuntimeError("rhvoice-produced-no-audio")
    return data, "audio/wav"


# ══════════ XTTS — عبر مكتبة Coqui `TTS` إن ثُبّتت ══════════
# ⚠️ لم يُختبَر هذا المحرّك في بيئة كتابته: المكتبةُ ونموذجُها (≈٢GB من
#    huggingface) غيرُ متاحين هناك. الكشفُ صادق (المكتبةُ موجودةٌ أم لا)،
#    والتوليدُ يمرّ بواجهة المكتبة الموثّقة `TTS.tts_to_file`.

XTTS_MODEL = os.environ.get("XTTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
_xtts = {"model": None, "error": None}


def xtts_state():
    try:
        import TTS  # noqa: F401  — الكشفُ وحده، بلا تحميل نموذج
    except Exception:  # ImportError وما يرميه اعتماديّاتها (torch…)
        return False, "مكتبة Coqui TTS غير مثبّتة — pip install TTS (مع PyTorch) ثمّ أعِد تشغيل الجسر"
    if _xtts["error"]:
        return False, f"تعذّر تحميل نموذج XTTS: {_xtts['error']}"
    return True, "" if _xtts["model"] else "النموذجُ يُحمَّل عند أوّل نطق (قد يُنزَّل أوّلَ مرّة)"


def _xtts_model():
    if _xtts["model"] is None:
        try:
            from TTS.api import TTS as CoquiTTS
            _xtts["model"] = CoquiTTS(XTTS_MODEL)
        except Exception as err:
            _xtts["error"] = str(err)[:200]
            raise
    return _xtts["model"]


def xtts_voices():
    ok, _ = xtts_state()
    if not ok or _xtts["model"] is None:
        return []
    speakers = getattr(_xtts["model"], "speakers", None) or []
    return [{"id": s, "name": s} for s in speakers]


def xtts_synthesize(text, voice, language):
    model = _xtts_model()
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "out.wav")
        kwargs = {"text": text, "language": language or "ru", "file_path": out}
        if voice:
            kwargs["speaker"] = voice
        model.tts_to_file(**kwargs)
        with open(out, "rb") as fh:
            return fh.read(), "audio/wav"


ENGINES = {
    "rhvoice": {"state": rhvoice_state, "voices": rhvoice_voices},
    "xtts": {"state": xtts_state, "voices": xtts_voices},
}


def engines_report():
    report = {}
    for name, engine in ENGINES.items():
        available, reason = engine["state"]()
        report[name] = {"available": available, "reason": reason}
    return report


# ══════════ HTTP ══════════

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin")
        if origin_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Expose-Headers", "X-Audio-Engine")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204 if origin_allowed(self.headers.get("Origin")) else 403)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/health":
            return self._json(200, {"status": "ok", "engines": engines_report()})
        if url.path == "/voices":
            engine = (parse_qs(url.query).get("engine") or [None])[0]
            if engine:
                if engine not in ENGINES:
                    return self._json(404, {"error": "unknown-engine"})
                return self._json(200, {"voices": ENGINES[engine]["voices"]()})
            voices = [dict(v, engine=name) for name, e in ENGINES.items() for v in e["voices"]()]
            return self._json(200, {"voices": voices})
        return self._json(404, {"error": "not-found"})

    def do_POST(self):
        if urlparse(self.path).path != "/synthesize":
            return self._json(404, {"error": "not-found"})
        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "bad-json"})

        text = (data.get("text") or "").strip()
        if not text:
            return self._json(400, {"error": "empty-text"})
        # ⚠️ عميلٌ قديمٌ لا يرسل «engine» — كان يعني XTTS.
        engine = data.get("engine") or "xtts"
        if engine not in ENGINES:
            return self._json(404, {"error": "unknown-engine"})
        available, reason = ENGINES[engine]["state"]()
        if not available:
            return self._json(503, {"error": "engine-unavailable", "detail": reason})

        try:
            if engine == "rhvoice":
                audio, mime = rhvoice_synthesize(text, data.get("voice"))
            else:
                audio, mime = xtts_synthesize(text, data.get("voice"), data.get("language"))
        except ValueError as err:
            return self._json(400, {"error": str(err)})
        except subprocess.TimeoutExpired:
            return self._json(504, {"error": "synthesis-timeout"})
        except Exception as err:  # عطلٌ حقيقيّ — يُبلَّغ لا يُخفى
            return self._json(500, {"error": "synthesis-failed", "detail": str(err)[:300]})

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("X-Audio-Engine", engine)
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, fmt, *args):
        if os.environ.get("LINGOLIFE_BRIDGE_VERBOSE"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print(f"جسر LingoLife TTS شغّال على http://{HOST}:{PORT}")
    for name, state in engines_report().items():
        print(f"  {name}: {'متاح' if state['available'] else 'غير متاح'}{(' — ' + state['reason']) if state['reason'] else ''}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
