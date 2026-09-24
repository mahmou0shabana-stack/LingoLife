"""XTTS v2 worker — runs in envs/xtts (coqui-tts, the maintained idiap fork).

    envs/xtts/bin/python engines/xtts_worker.py <reference.wav>

The checkpoint has no built-in speakers file (see engines.json), so the voice
is cloned from a reference clip shipped inside the model repo (samples/).
Sampling parameters are the checkpoint's own config.json defaults.
"""

import sys
from pathlib import Path

import torch

# engines/ holds adapters named like the engine packages (chatterbox.py, cosyvoice.py …):
# search it last so `import chatterbox` resolves to the real package.
sys.path.append(sys.path.pop(0))

from _worker_io import seed_all, serve, write_wav

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "xtts"
REF = sys.argv[1]


def load():
    from importlib.metadata import version

    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    torch.set_num_threads(4)
    config = XttsConfig()
    config.load_json(str(MODEL / "config.json"))
    model = Xtts.init_from_config(config)
    model.load_checkpoint(config, checkpoint_dir=str(MODEL), eval=True)
    model.eval()
    latent, emb = model.get_conditioning_latents(audio_path=[str(ROOT / REF)])
    return (model, config, latent, emb), {
        "packages": {p: version(p) for p in ("coqui-tts", "torch", "transformers")},
        "reference_audio": REF, "device": "cpu", "threads": torch.get_num_threads(),
        "sampling": {k: getattr(config, k) for k in ("temperature", "length_penalty", "repetition_penalty", "top_k", "top_p")},
    }


def synth(state, req):
    model, config, latent, emb = state
    seed_all(req["seed"])
    tok = model.tokenizer
    cleaned = tok.preprocess_text(req["text"].strip().lower(), "ru")
    ids = tok.encode(req["text"].strip().lower(), "ru")
    pieces = [tok.tokenizer.id_to_token(i) for i in ids]
    out = model.inference(req["text"], "ru", latent, emb, speed=req.get("speed", 1.0),
                          enable_text_splitting=True,
                          temperature=config.temperature, length_penalty=config.length_penalty,
                          repetition_penalty=config.repetition_penalty, top_k=config.top_k, top_p=config.top_p)
    info = write_wav(req["out"], out["wav"], 24000)
    return {"ok": True, "sample_rate": 24000, **info, "frontend": {
        "normalized_text": cleaned,
        "tokens": pieces,
        "u0301_in_normalized": cleaned.count("́"),
        "unk_tokens": pieces.count("[UNK]"),
        "tokens_containing_u0301": sum("́" in p for p in pieces),
    }}


if __name__ == "__main__":
    serve(load, synth)
