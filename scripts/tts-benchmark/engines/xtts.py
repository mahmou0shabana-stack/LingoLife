"""XTTS v2 adapter — persistent worker in envs/xtts (see engines/_neural.py).

Voice: cloned from `samples/en_sample.wav`, the reference clip shipped in the
model repo (the checkpoint mirrored here has no built-in speakers file; the
repo has no Russian sample).
Rate: XTTS `speed` argument (0.8 → speed=0.8, i.e. length_scale 1.25).
"""

import json
from pathlib import Path

from engines._neural import ROOT, NeuralAdapter

ENGINE = "xtts"
MODEL = ROOT / "models" / "xtts"
REFERENCES = {"en_sample": "models/xtts/samples/en_sample.wav"}


def _rate(rate):
    if rate == 1.0:
        return {}, "default speed 1.0"
    return {"speed": rate}, f"XTTS speed={rate} (length_scale {round(1 / rate, 4)})"


_adapter = NeuralAdapter(ENGINE, lambda voice: [REFERENCES[voice]], _rate)
VARIANTS = _adapter.VARIANTS
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / ENGINE / "bin" / "python").exists():
        return False, "envs/xtts missing — run setup_neural.sh"
    if not (MODEL / "model.pth").exists():
        return False, "models/xtts/model.pth missing — run fetch_models.py xtts"
    return True, ""


def version():
    prov = json.loads((MODEL / "_provenance.json").read_text())
    return (f"XTTS v2.0.1 — {prov['hf_repo']}@{prov['hf_revision'][:10]} (tag v2.0.1; files SHA-256-identical, "
            f"fetched from modelscope.cn/{prov['modelscope_repo']}); coqui-tts 0.27.5, torch 2.6.0 CPU")


def voices():
    size = sum(f.stat().st_size for f in MODEL.glob("*.pth"))
    return [{"id": v, "name": v, "gender": "", "model_bytes": size} for v in REFERENCES]
