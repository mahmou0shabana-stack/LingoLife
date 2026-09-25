"""F5-TTS Russian adapter — ESpeech-TTS-1 RL-V2 checkpoint, persistent worker in envs/f5.

Why this checkpoint: F5-TTS's SHARED.md lists one Russian checkpoint, hotstone228/F5-TTS-Russian,
but its weights are only on huggingface.co's large-file CDN (refused here). ESpeech-TTS-1 RL-V2 is a
Russian F5-TTS checkpoint (Apache-2.0) mirrored byte-identically on modelscope.cn.

Voice: cloned from the native-Russian FLEURS female clip + its FLEURS transcript (CC-BY-4.0).

Stress: ESpeech's own pipeline writes stress as "+" BEFORE the stressed vowel (via ruaccent, which
cannot run here). Three variants, same seed per sentence:
  ""                  corpus text as-is (U+0301 after the vowel)
  "~no-stress-marks"  U+0301 removed
  "~plus-stress"      each U+0301 converted to ESpeech notation: "+" moved before the marked vowel
Rate: F5-TTS `speed` argument.
"""

import json
import unicodedata

from engines._neural import ROOT, NeuralAdapter, as_is, strip_marks

ENGINE = "f5-espeech"
MODEL = ROOT / "models" / "espeech-rlv2"
REFS = json.loads((ROOT / "references" / "references.json").read_text())["clips"]
VOICES = {"ru_female_fleurs": REFS["ru_female_fleurs"]}


def plus_marks(text):
    """«за́мок» → «з+амок»: U+0301 follows its vowel; ESpeech wants "+" before the vowel."""
    out = []
    for ch in text:
        if ch == "́" and out:
            vowel = out.pop()
            out.append("+" + vowel)
        else:
            out.append(ch)
    n = text.count("́")
    result = unicodedata.normalize("NFC", "".join(out))
    return result, ([f"converted {n}× U+0301 to ESpeech '+' notation (before the stressed vowel)"] if n else [])


VARIANTS = [
    ("", as_is, "text sent as-is (U+0301 kept)"),
    ("~no-stress-marks", strip_marks, "U+0301 removed before synthesis (same seed as the as-is run)"),
    ("~plus-stress", plus_marks, "U+0301 converted to ESpeech's '+'-before-vowel notation (same seed)"),
]


def _rate(rate):
    if rate == 1.0:
        return {}, "default speed 1.0"
    return {"speed": rate}, f"F5-TTS speed={rate}"


_adapter = NeuralAdapter(ENGINE, lambda v: [VOICES[v]["file"], VOICES[v]["transcript"]], _rate,
                         worker="f5_espeech", env="f5")
synthesize = _adapter.synthesize
close = _adapter.close
load_info = _adapter.load_info


def available():
    if not (ROOT / "envs" / "f5" / "bin" / "python").exists():
        return False, "envs/f5 missing — run setup_phase1b.sh"
    if not (MODEL / "espeech_tts_rlv2.pt").exists():
        return False, "models/espeech-rlv2 missing — run fetch_models.py espeech-rlv2 vocos-mel-24khz"
    return True, ""


def version():
    p = json.loads((MODEL / "_provenance.json").read_text())
    return (f"ESpeech-TTS-1 RL-V2 {p['hf_repo']}@{p['hf_revision'][:10]} (F5-TTS DiT, SHA-256-verified via modelscope.cn) "
            f"+ Vocos charactr/vocos-mel-24khz; f5-tts 1.1.22, torch CPU float32")


def voices():
    size = (MODEL / "espeech_tts_rlv2.pt").stat().st_size + (ROOT / "models/vocos-mel-24khz/pytorch_model.bin").stat().st_size
    return [{"id": v, "name": v, "gender": "female", "model_bytes": size} for v in VOICES]
