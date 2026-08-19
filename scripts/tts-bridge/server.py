#!/usr/bin/env python3
"""
LingoLife — جسر تطوير محلّي لمزوّدات TTS خارجية (XTTS/Piper/RHVoice)

أداة تطوير فقط — لا تُشحَن مع الـPWA ولا تُنشر معه. تشغّلها بنفسك محليًّا
حين تريد تجربة محرّك نطقٍ لا يعمل داخل المتصفّح (XTTS تحديدًا)، وربما
Piper أو RHVoice أثناء التطوير أيضًا — الجسر عامٌّ بما يكفي ليغلّف أيًّا
منها (WS41، بند 7).

    python3 scripts/tts-bridge/server.py

يرتبط بـ 127.0.0.1:8765 افتراضيًّا فقط — لا يُعرَّض للشبكة (بند 8)، ولا
سرّ ولا مفتاح API هنا ولا في أيّ كودٍ يستدعيه من الواجهة الأمامية.

اعتماديّاته من مكتبة بايثون القياسية وحدها — يعمل بلا `pip install`
حتى تختار محرّكًا وتوصّله بنفسك (وقتها تضيف اعتماديّاته هو، لا اعتماديّة
هذا الجسر).

النقاط (يقرأها `js/services/shadow/tts/xtts-bridge-provider.js`):

    GET  /health               → {"status": "ok"}
    GET  /voices                → {"voices": [{"id","name","language"}]}
    POST /synthesize             جسمٌ {"text","language","voice","speed"}
                                  يُرجع بايتات صوتيّة في الجسم عند 200،
                                  أو JSON خطأ + رمز حالة غير 200.

⚠️ **لا محرّك حقيقيّ هنا.** `synthesize_audio()` أدناه هي حيث تُوصِّل
   XTTS أو Piper أو RHVoice فعليًّا. من غير توصيلٍ يرجع الجسرُ خطأً
   صادقًا (501 engine-not-configured) — لا صمتًا يبدو نجاحًا. هذا هو
   نفس مبدأ الطلب الأصليّ بالحرف: «Do NOT fake support».
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "127.0.0.1"  # لا 0.0.0.0 أبدًا — محلّيٌّ فقط (بند 8)
PORT = 8765


def list_voices():
    """عدِّل هذه لترجع أصوات محرّكك الفعليّ حين توصّله."""
    return []


def synthesize_audio(text, language, voice, speed):
    """
    وصِّل XTTS أو Piper أو RHVoice هنا فعليًّا.

    يجب أن تُرجع (audio_bytes: bytes, mime_type: str) — مثلًا
    (wav_bytes, "audio/wav"). ارمِ NotImplementedError إن لم يُوصَّل
    بعد؛ لا تُرجع صمتًا أو بايتات فارغة كأنها نجاحٌ صامت.
    """
    raise NotImplementedError("لم يُوصَّل أيّ محرّك نطقٍ بعد — عدِّل synthesize_audio() في هذا الملفّ")


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"status": "ok"})
        if self.path == "/voices":
            return self._json(200, {"voices": list_voices()})
        return self._json(404, {"error": "not-found"})

    def do_POST(self):
        if self.path != "/synthesize":
            return self._json(404, {"error": "not-found"})

        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "bad-json"})

        text = (data.get("text") or "").strip()
        if not text:
            return self._json(400, {"error": "empty-text"})

        try:
            audio_bytes, mime_type = synthesize_audio(
                text=text,
                language=data.get("language", "ru"),
                voice=data.get("voice"),
                speed=data.get("speed", 1.0),
            )
        except NotImplementedError as err:
            return self._json(501, {"error": "engine-not-configured", "detail": str(err)})
        except Exception as err:  # عطلٌ حقيقيّ في التوليد — يُبلَّغ لا يُخفى
            return self._json(500, {"error": "synthesis-failed", "detail": str(err)})

        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(audio_bytes)))
        self.end_headers()
        self.wfile.write(audio_bytes)

    def log_message(self, fmt, *args):
        pass  # هدوءٌ افتراضيّ — عدِّل لو أردت سجلًّا مفصَّلًا


if __name__ == "__main__":
    print(f"جسر LingoLife TTS شغّال على http://{HOST}:{PORT}")
    print("مطفأٌ فعليًّا (501) حتى تُوصِّل محرّكًا في synthesize_audio() — راجع رأس الملفّ")
    HTTPServer((HOST, PORT), Handler).serve_forever()
