"""Chatterbox Multilingual V3 worker — runs in envs/chatterbox.

    envs/chatterbox/bin/python engines/chatterbox_worker.py builtin

Voice: the built-in conditioning shipped with the model (conds.pt).
Generation parameters: the package defaults (exaggeration 0.5, cfg_weight 0.5,
temperature 0.8). Output carries Resemble's Perth watermark (package default).
"""

import sys
import logging
from pathlib import Path

import torch

# engines/ holds adapters named like the engine packages (chatterbox.py, cosyvoice.py …):
# search it last so `import chatterbox` resolves to the real package.
sys.path.append(sys.path.pop(0))

from _worker_io import seed_all, serve, write_wav

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "chatterbox"
stress_warnings = []


class _Capture(logging.Handler):
    def emit(self, record):
        stress_warnings.append(record.getMessage())


def load():
    import json
    from importlib.metadata import version

    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    torch.set_num_threads(4)
    logging.getLogger("chatterbox.models.tokenizers.tokenizer").addHandler(_Capture())
    model = ChatterboxMultilingualTTS.from_local(MODEL, "cpu", t3_model="v3")
    direct = json.loads(next((ROOT / "envs/chatterbox/lib/python3.11/site-packages").glob(
        "chatterbox_tts-*.dist-info/direct_url.json")).read_text())
    return model, {"packages": {p: version(p) for p in ("chatterbox-tts", "torch", "transformers")},
                   "chatterbox_git_commit": direct["vcs_info"]["commit_id"], "t3_checkpoint": "t3_mtl23ls_v3.safetensors",
                   "voice": "built-in conds.pt", "device": "cpu", "threads": torch.get_num_threads(),
                   "sample_rate": model.sr}


def synth(model, req):
    from chatterbox.mtl_tts import punc_norm

    seed_all(req["seed"])
    stress_warnings.clear()
    tok = model.tokenizer
    normed = punc_norm(req["text"])
    ids = tok.encode(normed, language_id="ru")
    pieces = [tok.tokenizer.id_to_token(i) for i in ids]
    pre = tok.preprocess_text(normed, language_id="ru")
    wav = model.generate(req["text"], language_id="ru")
    info = write_wav(req["out"], wav.squeeze(0).numpy(), model.sr)
    return {"ok": True, "sample_rate": model.sr, **info, "frontend": {
        "normalized_text": pre,
        "tokens": pieces,
        "u0301_in_normalized": pre.count("́"),
        "unk_tokens": pieces.count("[UNK]"),
        "tokens_containing_u0301": sum("́" in (p or "") for p in pieces),
        "russian_auto_stress": "skipped: " + stress_warnings[0] if stress_warnings else "no warning emitted",
    }}


if __name__ == "__main__":
    serve(load, synth)
