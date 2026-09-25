"""Supertonic 3 worker — ONNX Runtime CPU, torch-free, runs in envs/supertonic with the official
repo helper (tools/supertonic/py/helper.py, archived repo @ 1e9799e).

    envs/supertonic/bin/python engines/supertonic_worker.py <voice style, e.g. F1>

Official defaults from py/example_onnx.py: total_step 8, speed 1.05, lang "ru". Text goes through the
repo's UnicodeProcessor (NFKD + symbol cleanup, no number expansion, no stress handling) and is indexed
per Unicode code point. The model is non-autoregressive: audio for a text chunk (≤300 chars, split on
sentence ends) is produced in one pass, so "first audio" = time until the first chunk's waveform exists.
"""

import sys
import time
from pathlib import Path

import numpy as np

# engines/ holds adapters named like engine packages: search it last.
sys.path.append(sys.path.pop(0))

ROOT = Path(__file__).resolve().parent.parent
REPO_PY = ROOT / "tools" / "supertonic" / "py"
sys.path.insert(0, str(REPO_PY))

from _worker_io import serve, write_wav  # noqa: E402

MODEL = ROOT / "models" / "supertonic3"
VOICE = sys.argv[1]
TOTAL_STEP, SPEED = 8, 1.05


def load():
    import subprocess
    from importlib.metadata import version

    import onnxruntime as ort
    from helper import load_text_to_speech, load_voice_style

    tts = load_text_to_speech(str(MODEL / "onnx"), use_gpu=False)
    style = load_voice_style([str(MODEL / "voice_styles" / f"{VOICE}.json")])
    commit = subprocess.run(["git", "-C", str(REPO_PY.parent), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return (tts, style), {"packages": {"onnxruntime": version("onnxruntime"), "numpy": version("numpy")},
                          "torch_imported": "torch" in sys.modules, "repo_commit": commit, "voice_style": VOICE,
                          "total_step": TOTAL_STEP, "speed": SPEED, "providers": ort.get_available_providers(),
                          "sample_rate": tts.sample_rate}


def synth(state, req):
    from helper import chunk_text

    tts, style = state
    np.random.seed(req["seed"])
    speed = SPEED * req.get("speed", 1.0)
    t0 = time.perf_counter()
    chunks = chunk_text(req["text"], max_len=300)
    wavs, first_audio = [], None
    for i, ch in enumerate(chunks):
        wav, _ = tts._infer([ch], ["ru"], style, TOTAL_STEP, speed)
        if first_audio is None:
            first_audio = time.perf_counter() - t0
        if i:
            wavs.append(np.zeros((1, int(0.3 * tts.sample_rate)), dtype=np.float32))
        wavs.append(wav)
    info = write_wav(req["out"], np.concatenate(wavs, axis=1), tts.sample_rate)
    proc = tts.text_processor._preprocess_text(req["text"], "ru")
    idx = tts.text_processor.indexer
    ids = [idx[ord(c)] if ord(c) < len(idx) else -1 for c in proc]
    return {"ok": True, "sample_rate": tts.sample_rate, **info, "first_audio_s": round(first_audio, 4), "frontend": {
        "normalized_text": proc,
        "note": "NFKD + symbol cleanup; one token per Unicode code point via unicode_indexer.json (-1 = unknown)",
        "tokens": [f"{c}:{i}" if unicodedata_name(c) else f"U+{ord(c):04X}:{i}" for c, i in zip(proc, ids)],
        "u0301_in_normalized": proc.count("́"),
        "unk_tokens": sum(1 for i in ids if i < 0),
        "tokens_containing_u0301": sum(1 for c in proc if c == "́"),
        "u0301_index": idx[0x301],
        "chunks": len(chunks),
    }}


def unicodedata_name(c):
    import unicodedata
    return not unicodedata.combining(c)


if __name__ == "__main__":
    serve(load, synth)
