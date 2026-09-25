"""Supertonic 3 INT8 adapter — sherpa-onnx worker in envs/sherpa (the on-device route) (see engines/_neural.py).

Voices: the model's built-in preset voice styles (voice_styles/F1.json, M1.json). No voice cloning in
the open-weight release. lang="ru". Rate: Supertonic `speed` (multiplied into the official default 1.05).
"""

from engines._neural import ROOT, NeuralAdapter

ENGINE = "supertonic-int8"
MODEL = ROOT / "models" / "sherpa" / "sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
SID = {"F1": "0", "M1": "5"}
VOICES = ["F1", "M1"]


def _rate(rate):
    if rate == 1.0:
        return {}, "official default speed 1.05"
    return {"speed": rate}, f"Supertonic speed = 1.05 × {rate}"


_adapter = NeuralAdapter(ENGINE, lambda v: [SID[v]], _rate, worker="supertonic_int8", env="sherpa")
VARIANTS = _adapter.VARIANTS
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / "sherpa" / "bin" / "python").exists():
        return False, "envs/sherpa missing — run setup_phase1c.sh"
    if not (MODEL / "vector_estimator.int8.onnx").exists():
        return False, "sherpa-onnx INT8 model missing — run setup_phase1c.sh"
    return True, ""


def version():
    return ("Supertonic 3 INT8 — sherpa-onnx release asset sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2 "
            "(sha256 82fa96f9…); sherpa-onnx 1.13.8 CPU, 4 threads, 8 steps")


def voices():
    size = sum(f.stat().st_size for f in MODEL.glob("*.onnx"))
    return [{"id": v, "name": v, "gender": "female" if v.startswith("F") else "male", "model_bytes": size} for v in VOICES]
