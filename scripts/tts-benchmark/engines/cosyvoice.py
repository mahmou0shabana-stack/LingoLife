"""CosyVoice 3 adapter — persistent worker in envs/cosyvoice + tools/CosyVoice.

Voice: zero-shot from asset/zero_shot_prompt.wav, the prompt the official
CosyVoice3 example uses (a Mandarin speaker; the repo ships no Russian prompt).
Input: the official CosyVoice3 prompt prefix is prepended and recorded as
engine input. Rate: CosyVoice `speed` argument.
"""

import json

from engines._neural import ROOT, NeuralAdapter, as_is, strip_marks

ENGINE = "cosyvoice"
MODEL = ROOT / "models" / "cosyvoice3"
PREFIX = "You are a helpful assistant.<|endofprompt|>"
PROMPTS = {"zero_shot_prompt": "tools/CosyVoice/asset/zero_shot_prompt.wav"}


def _with_prefix(normalize):
    def run(text):
        out, steps = normalize(text)
        return PREFIX + out, steps + [f"prepended official CosyVoice3 prompt prefix \"{PREFIX}\""]
    return run


VARIANTS = [
    ("", _with_prefix(as_is), "text as-is (U+0301 kept) + official CosyVoice3 prefix"),
    ("~no-stress-marks", _with_prefix(strip_marks), "U+0301 removed + official prefix (same seed as the as-is run)"),
]


def _rate(rate):
    if rate == 1.0:
        return {}, "default speed 1.0"
    return {"speed": rate}, f"CosyVoice speed={rate}"


_adapter = NeuralAdapter(ENGINE, lambda voice: [PROMPTS[voice]], _rate)
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / ENGINE / "bin" / "python").exists():
        return False, "envs/cosyvoice missing — run setup_neural.sh"
    if not (MODEL / "llm.pt").exists():
        return False, "models/cosyvoice3 missing — run fetch_models.py cosyvoice3"
    return True, ""


def version():
    prov = json.loads((MODEL / "_provenance.json").read_text())
    return (f"{prov['hf_repo']}@{prov['hf_revision'][:10]} (SHA-256-verified, fetched from modelscope.cn); "
            f"FunAudioLLM/CosyVoice @ git 074ca6d, torch 2.3.1 CPU")


def voices():
    size = sum((MODEL / f).stat().st_size for f in ("llm.pt", "flow.pt", "hift.pt", "CosyVoice-BlankEN/model.safetensors"))
    return [{"id": v, "name": v, "gender": "", "model_bytes": size} for v in PROMPTS]
