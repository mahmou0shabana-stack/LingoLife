"""MOSS-TTS-Nano adapter (ONNX Runtime CPU path, official ONNX exports) — persistent worker in envs/moss-nano (see engines/_neural.py).

Same reference clips, same repo text pipeline (WeText ON), streaming codec decode ON (repo default).
Voices: voice cloning from native-Russian FLEURS clips (references/references.json, CC-BY-4.0).
The repository's text pipeline runs with its defaults (robust cleanup + WeTextProcessing).
Measured: WeTextProcessing routes pure-Cyrillic text to its Chinese normalizer (digits → Chinese
numerals), so one extra voice config runs with WeText OFF (the repo's own
--disable-wetext-processing switch) to hear the model without that step.
Rate: no speed control in MOSS-TTS-Nano; slow items are synthesized at default rate (recorded).
"""

import json

from engines._neural import ROOT, NeuralAdapter

ENGINE = "moss-nano-onnx"
WORKER = "moss_nano_onnx"
MODEL = ROOT / "models" / "moss-nano-onnx"
CODEC = ROOT / "models" / "moss-audio-tokenizer-nano-onnx"
VOICES = {  # voice id → (reference clip, WeTextProcessing on?)
    "ru_female_fleurs": ("references/ru_female_fleurs.wav", True),
    "ru_male_fleurs": ("references/ru_male_fleurs.wav", True),
}


def _rate(rate):
    if rate == 1.0:
        return {}, "default"
    return {}, f"NOT SUPPORTED — MOSS-TTS-Nano has no speed control; synthesized at default rate (requested {rate})"


def _args(voice):
    ref, wetext = VOICES[voice]
    return [ref, "1" if wetext else "0"]


_adapter = NeuralAdapter(ENGINE, _args, _rate, worker=WORKER)
VARIANTS = _adapter.VARIANTS
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / "moss-nano" / "bin" / "python").exists():
        return False, "envs/moss-nano missing — run setup_phase1b.sh"
    if not (MODEL / "moss_tts_prefill.onnx").exists() or not (CODEC / "moss_audio_tokenizer_decode_step.onnx").exists():
        return False, "models missing — run fetch_models.py moss-nano-onnx moss-audio-tokenizer-nano-onnx"
    return True, ""


def version():
    a = json.loads((MODEL / "_provenance.json").read_text())
    b = json.loads((CODEC / "_provenance.json").read_text())
    return (f"{a['hf_repo']}@{a['hf_revision'][:10]} + {b['hf_repo']}@{b['hf_revision'][:10]} "
            f"(SHA-256-verified, via modelscope.cn); OpenMOSS/MOSS-TTS-Nano @ git 8b7bcc9 onnx_tts_runtime, onnxruntime 1.30.0 CPU")


def voices():
    size = sum(f.stat().st_size for d in (MODEL, CODEC) for f in d.iterdir() if f.suffix in (".onnx", ".data"))
    return [{"id": v, "name": v, "gender": "female" if "female" in v else "male", "model_bytes": size} for v in VOICES]
