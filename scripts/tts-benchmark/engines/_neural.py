"""Runner side for the neural engines (XTTS v2, Qwen3-TTS, Chatterbox, CosyVoice 3).

Each engine lives in its own venv (envs/<engine>/, see setup_neural.sh) because
their pinned torch/transformers versions conflict. The adapter keeps ONE worker
process per voice alive so the model is loaded once; load time and RAM are
recorded separately from per-sentence synthesis.

Stress (U+0301): every neural engine is run twice over the corpus with the SAME
seed per sentence — text as-is, and U+0301 removed — so any audio difference
comes from the marks alone. Each worker also reports what its own text
frontend did with the marks (tokens / normalized text).
"""

import json
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TIMEOUT_S = 900  # per sentence; a timeout is recorded as a failed synthesis, never retried silently


def as_is(text):
    return text, []


def strip_marks(text):
    n = text.count("́")
    return text.replace("́", ""), ([f"removed {n}× U+0301 (combining acute)"] if n else [])


VARIANTS = [
    ("", as_is, "text sent as-is (U+0301 kept)"),
    ("~no-stress-marks", strip_marks, "U+0301 removed before synthesis (same seed as the as-is run)"),
]


def seed_for(out_path):
    return 1000 + int(Path(out_path).stem)


class Worker:
    def __init__(self, engine, args, worker=None, env=None):
        py = ROOT / "envs" / (env or engine) / "bin" / "python"
        tag = "-".join(Path(a).stem for a in args) or "default"
        self.stderr_path = ROOT / "logs" / f"{engine}-{tag}.stderr.log"
        self.stderr_path.parent.mkdir(exist_ok=True)
        self.proc = subprocess.Popen([str(py), str(ROOT / "engines" / f"{worker or engine}_worker.py"), *args],
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=open(self.stderr_path, "a"), text=True, cwd=str(ROOT))
        self.info = self._read(timeout=3600)
        if not self.info or not self.info.get("ready"):
            raise RuntimeError(f"{engine} worker failed to load: {self.info}")

    def _read(self, timeout):
        box = {}
        t = threading.Thread(target=lambda: box.setdefault("line", self.proc.stdout.readline()), daemon=True)
        t.start()
        t.join(timeout)
        if t.is_alive():
            self.proc.kill()
            return {"ok": False, "error": f"timeout after {timeout}s"}
        line = box.get("line")
        if not line:
            return {"ok": False, "ready": False,
                    "error": f"worker exited (code {self.proc.poll()}); see {self.stderr_path.relative_to(ROOT)}"}
        return json.loads(line)

    def call(self, req):
        if self.proc.poll() is not None:
            return {"ok": False, "error": "worker is not running"}
        self.proc.stdin.write(json.dumps(req, ensure_ascii=False) + "\n")
        self.proc.stdin.flush()
        return self._read(TIMEOUT_S)

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            try:
                self.proc.wait(30)
            except subprocess.TimeoutExpired:
                self.proc.kill()


class NeuralAdapter:
    """Implements the run.py adapter interface on top of a persistent worker."""

    VARIANTS = VARIANTS

    def __init__(self, engine, worker_args_for_voice, rate_mapping, worker=None, env=None):
        self.engine = engine
        self.worker_name = worker or engine
        self.env = env or ("moss-nano" if self.worker_name.startswith("moss_nano") else engine)
        self.args_for = worker_args_for_voice
        self.rate_mapping = rate_mapping
        self.workers = {}
        self.load_info = {}

    def worker(self, voice):
        if voice not in self.workers:
            try:
                self.workers[voice] = Worker(self.engine, self.args_for(voice), self.worker_name, self.env)
                self.load_info[voice] = self.workers[voice].info
            except RuntimeError as exc:
                self.workers[voice] = None
                self.load_info[voice] = {"ready": False, "error": str(exc)}
        return self.workers[voice]

    def synthesize(self, text, voice, rate, out_path):
        w = self.worker(voice)
        rate_args, rate_note = self.rate_mapping(rate)
        if w is None:
            return {"ok": False, "error": self.load_info[voice]["error"], "peak_rss_kb": 0, "rate_mapping": rate_note}
        req = {"text": text, "out": str(out_path), "seed": seed_for(out_path), **rate_args}
        res = w.call(req)
        ok = bool(res.get("ok")) and Path(out_path).exists() and Path(out_path).stat().st_size > 44
        return {
            "ok": ok,
            "error": None if ok else res.get("error") or "no audio written",
            "peak_rss_kb": res.get("peak_rss_kb") or 0,
            "engine_infer_s": res.get("infer_s"),
            "rate_mapping": rate_note,
            "command": f"envs/{self.env}/bin/python engines/{self.worker_name}_worker.py {' '.join(self.args_for(voice))}"
                       f"  (persistent worker; request {json.dumps({k: v for k, v in req.items() if k != 'text'})})",
            "extra": {"seed": req["seed"], "frontend": res.get("frontend"), "worker_rss_mb": round((res.get("rss_kb") or 0) / 1024, 1),
                      "clipped": res.get("clipped"), "peak_sample": res.get("peak"),
                      **({"first_audio_s": res["first_audio_s"]} if res.get("first_audio_s") is not None else {})},
        }

    def close(self, voice):
        w = self.workers.pop(voice, None)
        if w:
            w.close()
