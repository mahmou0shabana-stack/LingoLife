"""F5-TTS (ESpeech-TTS-1 RL-V2, Russian) worker — runs in envs/f5.

    envs/f5/bin/python engines/f5_espeech_worker.py <reference.wav> <reference transcript>

Follows the ESpeech model card's snippet: f5_tts load_model(DiT, MODEL_CFG,
ckpt, vocab_file) with the card's MODEL_CFG, Vocos (charactr/vocos-mel-24khz,
local copy), preprocess_ref_audio_text + infer_process with f5-tts defaults
(nfe_step 32, cfg_strength 2.0, sway -1, cross-fade 0.15 s). The card's
automatic stress step (ruaccent) is NOT run — its models are Hugging Face-only
and blocked here; stress marks come from the corpus (see the adapter).
"""

import sys
from pathlib import Path

import torch

# engines/ holds adapters named like engine packages: search it last.
sys.path.append(sys.path.pop(0))

from _worker_io import seed_all, serve, write_wav  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "espeech-rlv2"
VOCOS = ROOT / "models" / "vocos-mel-24khz"
REF, REF_TEXT = sys.argv[1], sys.argv[2]
MODEL_CFG = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4)  # from the ESpeech card


def load():
    from importlib.metadata import version

    from f5_tts.infer.utils_infer import load_model, load_vocoder, preprocess_ref_audio_text
    from f5_tts.model import DiT

    torch.set_num_threads(4)
    model = load_model(DiT, MODEL_CFG, str(MODEL / "espeech_tts_rlv2.pt"), vocab_file=str(MODEL / "vocab.txt"), device="cpu")
    vocoder = load_vocoder("vocos", is_local=True, local_path=str(VOCOS), device="cpu")
    ref_audio, ref_text = preprocess_ref_audio_text(str(ROOT / REF), REF_TEXT, show_info=lambda *a: None)
    vocab = [line for line in (MODEL / "vocab.txt").read_text(encoding="utf-8").split("\n")]
    return (model, vocoder, ref_audio, ref_text, set(vocab)), {
        "packages": {p: version(p) for p in ("f5-tts", "torch", "vocos")},
        "model_cfg": MODEL_CFG, "reference_audio": REF, "reference_text": ref_text,
        "device": "cpu", "threads": torch.get_num_threads(),
        "vocab_has_u0301": "́" in vocab, "vocab_has_plus": "+" in vocab,
    }


def synth(state, req):
    from f5_tts.infer.utils_infer import infer_process
    from f5_tts.model.utils import convert_char_to_pinyin

    model, vocoder, ref_audio, ref_text, vocab = state
    seed_all(req["seed"])
    wav, sr, _ = infer_process(ref_audio, ref_text, req["text"], model, vocoder, device="cpu",
                               speed=req.get("speed", 1.0), show_info=lambda *a: None, progress=None)
    info = write_wav(req["out"], wav, sr)
    chars = convert_char_to_pinyin([req["text"]])[0]
    unknown = [c for c in chars if c not in vocab]
    return {"ok": True, "sample_rate": sr, **info, "frontend": {
        "normalized_text": "".join(chars),
        "note": "character tokens (convert_char_to_pinyin passes Cyrillic through); characters missing from vocab map to index 0 = space",
        "tokens": chars,
        "u0301_in_normalized": "".join(chars).count("́"),
        "unk_tokens": len(unknown),
        "unknown_chars": sorted(set(unknown)),
        "tokens_containing_u0301": sum(c == "́" for c in chars),
        "plus_marks": "".join(chars).count("+"),
    }}


if __name__ == "__main__":
    serve(load, synth)
