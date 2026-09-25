"""OmniVoice adapter — persistent worker in envs/omnivoice (omnivoice 0.2.1, torch 2.8.0 CPU).

Voice: cloned from the native-Russian FLEURS female clip + its FLEURS transcript (CC-BY-4.0).
language="ru"; library-default generation config. Rate: OmniVoice `speed`.
"""

import json

from engines._neural import ROOT, NeuralAdapter

ENGINE = "omnivoice"
MODEL = ROOT / "models" / "omnivoice"
REFS = json.loads((ROOT / "references" / "references.json").read_text())["clips"]
VOICES = {"ru_female_fleurs": REFS["ru_female_fleurs"]}


def _rate(rate):
    if rate == 1.0:
        return {}, "default (model-estimated duration)"
    return {"speed": rate}, f"OmniVoice speed={rate}"


_adapter = NeuralAdapter(ENGINE, lambda v: [VOICES[v]["file"], VOICES[v]["transcript"]], _rate, env="omnivoice")
VARIANTS = _adapter.VARIANTS
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / "omnivoice" / "bin" / "python").exists():
        return False, "envs/omnivoice missing — run setup_phase1c.sh"
    if not (MODEL / "model.safetensors").exists():
        return False, "models/omnivoice missing — run fetch_models.py omnivoice"
    return True, ""


def version():
    p = json.loads((MODEL / "_provenance.json").read_text())
    return (f"OmniVoice {p['hf_repo']}@{p['hf_revision'][:10]} (Qwen3-0.6B-based, SHA-256-verified via modelscope.cn); "
            f"omnivoice 0.2.1, torch 2.8.0 CPU float32")


def voices():
    size = sum(f.stat().st_size for f in MODEL.rglob("*.safetensors"))
    return [{"id": v, "name": v, "gender": "female", "model_bytes": size} for v in VOICES]
