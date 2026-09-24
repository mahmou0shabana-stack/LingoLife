"""CosyVoice 3 worker — runs in envs/cosyvoice with the official repo in tools/CosyVoice.

    envs/cosyvoice/bin/python engines/cosyvoice_worker.py <prompt.wav>

Usage mirrors the official CosyVoice3 example (example.py, cosyvoice3_example):
inference_cross_lingual(text, prompt_wav) where the text already carries the
"You are a helpful assistant.<|endofprompt|>" prefix (added by the adapter and
recorded as engine input). Because the text contains "<|…|>", CosyVoice's own
text frontend (English-only normalizer for non-Chinese text) is skipped by the
library itself — reported per synthesis.
"""

import sys
from pathlib import Path

import torch

# engines/ holds adapters named like the engine packages (chatterbox.py, cosyvoice.py …):
# search it last so `import chatterbox` resolves to the real package.
sys.path.append(sys.path.pop(0))

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT / "tools" / "CosyVoice"
sys.path[:0] = [str(REPO), str(REPO / "third_party" / "Matcha-TTS")]

from _worker_io import seed_all, serve, write_wav  # noqa: E402

PROMPT = sys.argv[1]


def load():
    import subprocess
    from importlib.metadata import version

    from cosyvoice.cli.cosyvoice import AutoModel

    torch.set_num_threads(4)
    model = AutoModel(model_dir=str(ROOT / "models" / "cosyvoice3"))
    commit = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return model, {"packages": {p: version(p) for p in ("torch", "transformers", "onnxruntime")},
                   "cosyvoice_git_commit": commit, "class": type(model).__name__,
                   "text_frontend_backend": model.frontend.text_frontend,
                   "prompt_audio": PROMPT, "mode": "inference_cross_lingual (official CosyVoice3 example)",
                   "device": "cpu", "threads": torch.get_num_threads(), "sample_rate": model.sample_rate}


def synth(model, req):
    seed_all(req["seed"])
    text = req["text"]
    chunks = model.frontend.text_normalize(text, split=True, text_frontend=True)
    tok = model.frontend.tokenizer
    pieces = []
    for c in chunks:
        ids = tok.encode(c, allowed_special=model.frontend.allowed_special)
        pieces += [tok.decode([i]) for i in ids]
    parts = [out["tts_speech"] for out in model.inference_cross_lingual(
        text, str(ROOT / PROMPT), stream=False, speed=req.get("speed", 1.0))]
    wav = torch.cat(parts, dim=1).numpy()
    info = write_wav(req["out"], wav, model.sample_rate)
    return {"ok": True, "sample_rate": model.sample_rate, **info, "frontend": {
        "normalized_text": " ‖ ".join(chunks),
        "text_frontend": "skipped by CosyVoice (text contains <|…|>)" if "<|" in text else model.frontend.text_frontend,
        "tokens": pieces,
        "u0301_in_normalized": sum(c.count("́") for c in chunks),
        "unk_tokens": 0,
        "tokens_containing_u0301": sum("́" in p for p in pieces),
        "chunks": len(chunks),
    }}


if __name__ == "__main__":
    serve(load, synth)
