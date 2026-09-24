"""Qwen3-TTS adapter — persistent worker in envs/qwen3.

Model: Qwen3-TTS-12Hz-1.7B-CustomVoice (built-in speakers; none is a native
Russian speaker — the README lists Chinese/English/Japanese/Korean natives).
Rate: no speed parameter; for rate < 1 the 1.7B model is given a natural-
language instruction, recorded per synthesis.
"""

import json

from engines._neural import ROOT, NeuralAdapter

ENGINE = "qwen3"
MODEL_ID = "qwen3-1.7b"
MODEL = ROOT / "models" / MODEL_ID
SPEAKERS = ["serena", "ryan"]
SLOW_INSTRUCT = "Speak slowly and clearly, like a teacher for language learners."


def _rate(rate):
    if rate == 1.0:
        return {}, "default (no instruction)"
    return {"instruct": SLOW_INSTRUCT}, f"no speed parameter — instruct=\"{SLOW_INSTRUCT}\" (requested {rate})"


_adapter = NeuralAdapter(ENGINE, lambda voice: [f"models/{MODEL_ID}", voice], _rate)
VARIANTS = _adapter.VARIANTS
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / ENGINE / "bin" / "python").exists():
        return False, "envs/qwen3 missing — run setup_neural.sh"
    if not (MODEL / "model.safetensors").exists():
        return False, f"models/{MODEL_ID} missing — run fetch_models.py {MODEL_ID}"
    return True, ""


def version():
    prov = json.loads((MODEL / "_provenance.json").read_text())
    return (f"{prov['hf_repo']}@{prov['hf_revision'][:10]} (SHA-256-verified, fetched from modelscope.cn); "
            f"qwen-tts 0.1.1, transformers 4.57.3, torch 2.6.0 CPU float32")


def voices():
    size = sum(f.stat().st_size for f in MODEL.rglob("*.safetensors"))
    return [{"id": s, "name": s, "gender": "female" if s == "serena" else "male", "model_bytes": size} for s in SPEAKERS]
