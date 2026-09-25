"""Supertonic 3 adapter — torch-free ONNX Runtime worker in envs/supertonic (see engines/_neural.py).

Voices: the model's built-in preset voice styles (voice_styles/F1.json, M1.json). No voice cloning in
the open-weight release. lang="ru". Rate: Supertonic `speed` (multiplied into the official default 1.05).
"""

import json

from engines._neural import ROOT, NeuralAdapter

ENGINE = "supertonic"
MODEL = ROOT / "models" / "supertonic3"
VOICES = ["F1", "M1"]


def _rate(rate):
    if rate == 1.0:
        return {}, "official default speed 1.05"
    return {"speed": rate}, f"Supertonic speed = 1.05 × {rate}"


_adapter = NeuralAdapter(ENGINE, lambda v: [v], _rate, worker="supertonic", env="supertonic")
VARIANTS = _adapter.VARIANTS
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / "supertonic" / "bin" / "python").exists():
        return False, "envs/supertonic missing — run setup_phase1c.sh"
    if not (MODEL / "onnx" / "vector_estimator.onnx").exists():
        return False, "models/supertonic3 missing — run fetch_models.py supertonic3"
    return True, ""


def version():
    p = json.loads((MODEL / "_provenance.json").read_text())
    return (f"Supertonic 3 — {p['hf_repo']}@{p['hf_revision'][:10]} ONNX (SHA-256-verified via modelscope.cn; identical to "
            f"supertone-oss-archive/supertonic-3); repo supertonic @ 1e9799e (archived), onnxruntime 1.23.1 CPU, 8 steps")


def voices():
    size = sum(f.stat().st_size for f in (MODEL / "onnx").glob("*.onnx"))
    return [{"id": v, "name": v, "gender": "female" if v.startswith("F") else "male", "model_bytes": size} for v in VOICES]
