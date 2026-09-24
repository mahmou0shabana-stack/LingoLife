"""Qwen3-TTS worker — runs in envs/qwen3 (qwen-tts package).

    envs/qwen3/bin/python engines/qwen3_worker.py <model-dir> <speaker>

CustomVoice checkpoint with a built-in speaker; language="Russian".
Generation parameters: the checkpoint's generate_config.json (package default).
Slow speech (rate < 1): the 1.7B model takes a natural-language instruction;
the 0.6B model ignores instructions (qwen-tts drops them for 0b6).
"""

import sys
from pathlib import Path

import torch

# engines/ holds adapters named like the engine packages (chatterbox.py, cosyvoice.py …):
# search it last so `import chatterbox` resolves to the real package.
sys.path.append(sys.path.pop(0))

from _worker_io import seed_all, serve, write_wav

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR, SPEAKER = ROOT / sys.argv[1], sys.argv[2]


def load():
    from importlib.metadata import version

    from qwen_tts import Qwen3TTSModel

    torch.set_num_threads(4)
    model = Qwen3TTSModel.from_pretrained(str(MODEL_DIR), device_map="cpu", dtype=torch.float32)
    return model, {"packages": {p: version(p) for p in ("qwen-tts", "torch", "transformers")},
                   "model_dir": sys.argv[1], "speaker": SPEAKER, "dtype": "float32", "device": "cpu",
                   "threads": torch.get_num_threads(), "tts_model_size": model.model.tts_model_size,
                   "generate_defaults": model.generate_defaults,
                   "supported_languages": model.get_supported_languages(),
                   "supported_speakers": model.get_supported_speakers()}


def synth(model, req):
    seed_all(req["seed"])
    tok = model.processor.tokenizer
    prompt = model._build_assistant_text(req["text"])
    ids = tok(prompt)["input_ids"]
    pieces = [tok.decode([i]) for i in ids]
    wavs, sr = model.generate_custom_voice(text=req["text"], language="Russian", speaker=SPEAKER,
                                           instruct=req.get("instruct"))
    info = write_wav(req["out"], wavs[0], sr)
    return {"ok": True, "sample_rate": sr, **info, "frontend": {
        "normalized_text": req["text"],
        "note": "no text normalization; byte-level BPE over the chat-template prompt",
        "tokens": pieces,
        "u0301_in_normalized": req["text"].count("́"),
        "unk_tokens": 0,
        "tokens_containing_u0301": sum("́" in p for p in pieces),
        "instruct": req.get("instruct"),
    }}


if __name__ == "__main__":
    serve(load, synth)
