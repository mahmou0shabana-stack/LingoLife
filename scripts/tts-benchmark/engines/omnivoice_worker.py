"""OmniVoice worker — runs in envs/omnivoice (omnivoice 0.2.1 from PyPI, torch 2.8.0 CPU).

    envs/omnivoice/bin/python engines/omnivoice_worker.py <reference.wav> <reference transcript>

Voice clone mode (README): create_voice_clone_prompt(ref_audio, ref_text) once, then generate(text,
language="ru", voice_clone_prompt=...) with the library's default generation config (num_step 32,
guidance 2.0, position_temperature 5.0 → sampled, so torch is seeded per sentence). No text
normalization (library default normalize_text=False). The reference is read with soundfile and passed
as (waveform, sample_rate) — same as a path, without torchaudio's file decoders.
"""

import sys
import time
from pathlib import Path

import torch

# engines/ holds adapters named like engine packages: search it last.
sys.path.append(sys.path.pop(0))

from _worker_io import seed_all, serve, write_wav  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "omnivoice"
REF, REF_TEXT = sys.argv[1], sys.argv[2]


def load():
    from importlib.metadata import version

    import soundfile as sf
    from omnivoice import OmniVoice

    torch.set_num_threads(4)
    model = OmniVoice.from_pretrained(str(MODEL), device_map="cpu", dtype=torch.float32)
    wav, sr = sf.read(str(ROOT / REF), dtype="float32")
    prompt = model.create_voice_clone_prompt(ref_audio=(torch.from_numpy(wav).unsqueeze(0), sr), ref_text=REF_TEXT)
    return (model, prompt), {"packages": {p: version(p) for p in ("omnivoice", "torch", "transformers")},
                             "reference_audio": REF, "reference_text": REF_TEXT, "dtype": "float32", "device": "cpu",
                             "threads": torch.get_num_threads(), "sample_rate": model.sampling_rate}


def synth(state, req):
    model, prompt = state
    seed_all(req["seed"])
    kw = {"speed": req["speed"]} if req.get("speed") else {}
    t0 = time.perf_counter()
    audio = model.generate(text=req["text"], language="ru", voice_clone_prompt=prompt, **kw)
    info = write_wav(req["out"], audio[0], model.sampling_rate)
    tok = model.text_tokenizer
    ids = tok(req["text"])["input_ids"]
    pieces = [tok.decode([i]) for i in ids]
    return {"ok": True, "sample_rate": model.sampling_rate, **info, "frontend": {
        "normalized_text": req["text"],
        "note": "no text normalization; Qwen3 byte-level BPE (voice-clone prompt text is prepended internally)",
        "tokens": pieces,
        "u0301_in_normalized": req["text"].count("́"),
        "unk_tokens": 0,
        "tokens_containing_u0301": sum("́" in p for p in pieces),
    }}


if __name__ == "__main__":
    serve(load, synth)
