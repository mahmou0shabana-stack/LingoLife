"""Chatterbox Multilingual V3 adapter — persistent worker in envs/chatterbox.

Voice: the built-in conditioning in conds.pt. Rate: Chatterbox has no speed
or duration control, so slow-learner items are synthesized at the default
rate and the record says so (no post-processing time-stretch).
"""

import json

from engines._neural import ROOT, NeuralAdapter

ENGINE = "chatterbox"
MODEL = ROOT / "models" / "chatterbox"


def _rate(rate):
    if rate == 1.0:
        return {}, "default"
    return {}, f"NOT SUPPORTED — Chatterbox has no speed control; synthesized at default rate (requested {rate})"


_adapter = NeuralAdapter(ENGINE, lambda voice: [voice], _rate)
VARIANTS = _adapter.VARIANTS
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / ENGINE / "bin" / "python").exists():
        return False, "envs/chatterbox missing — run setup_neural.sh"
    if not (MODEL / "t3_mtl23ls_v3.safetensors").exists():
        return False, "models/chatterbox missing — run fetch_models.py chatterbox"
    return True, ""


def version():
    prov = json.loads((MODEL / "_provenance.json").read_text())
    return (f"Chatterbox Multilingual V3 — t3_mtl23ls_v3.safetensors, {prov['hf_repo']}@{prov['hf_revision'][:10]} "
            f"(SHA-256-verified, fetched from modelscope.cn); chatterbox-tts 0.1.7 @ git 5de7a54, torch 2.6.0 CPU")


def voices():
    size = sum((MODEL / f).stat().st_size for f in ("t3_mtl23ls_v3.safetensors", "s3gen.pt", "ve.pt"))
    return [{"id": "builtin", "name": "built-in conds.pt", "gender": "", "model_bytes": size}]
