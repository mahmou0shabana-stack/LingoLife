"""Supertonic 3 INT8 via sherpa-onnx — the on-device route (sherpa-onnx ships Android/iOS/WASM builds).

    envs/sherpa/bin/python engines/supertonic_int8_worker.py <sid>

Model: sherpa-onnx release asset sherpa-onnx-supertonic-3-tts-int8-2026-05-11 (INT8 quantization of
Supertonic 3 by the sherpa-onnx project, k2-fsa — not by Supertone). sherpa-onnx 1.13.8 C++ frontend
(its own NFKD table + unicode indexer), num_steps 8, 4 threads. sid: voice.bin order F1..F5, M1..M5
(verified: its style vectors equal voice_styles/*.json exactly). Seed via extra["seed"]. First audio = first callback chunk.
"""

import sys
import time
from pathlib import Path

import numpy as np

sys.path.append(sys.path.pop(0))

from _worker_io import serve, write_wav  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
M = ROOT / "models" / "sherpa" / "sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
SID = int(sys.argv[1])
state_fa = {}


def load():
    from importlib.metadata import version

    import sherpa_onnx

    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
            duration_predictor=str(M / "duration_predictor.int8.onnx"), text_encoder=str(M / "text_encoder.int8.onnx"),
            vector_estimator=str(M / "vector_estimator.int8.onnx"), vocoder=str(M / "vocoder.int8.onnx"),
            tts_json=str(M / "tts.json"), unicode_indexer=str(M / "unicode_indexer.bin"), voice_style=str(M / "voice.bin")),
        num_threads=4, provider="cpu"))
    tts = sherpa_onnx.OfflineTts(cfg)
    return tts, {"packages": {"sherpa-onnx": version("sherpa-onnx")}, "torch_imported": "torch" in sys.modules,
                 "sid": SID, "num_steps": 8, "threads": 4, "sample_rate": tts.sample_rate,
                 "model": M.name}


def synth(tts, req):
    import sherpa_onnx

    gc = sherpa_onnx.GenerationConfig()
    gc.sid, gc.num_steps, gc.speed = SID, 8, 1.05 * req.get("speed", 1.0)
    # NB: in sherpa-onnx 1.13.8 `gc.extra[...] = …` edits a copy and is silently lost (the official example's
    # pattern) — the whole dict must be assigned. seed feeds sherpa's own C++ RNG (default -1 = random).
    gc.extra = {"lang": "ru", "seed": str(int(req["seed"]))}
    t0 = time.perf_counter()
    state_fa["t"] = None

    def cb(samples, progress):
        if state_fa["t"] is None and len(samples):
            state_fa["t"] = time.perf_counter() - t0
        return 0

    audio = tts.generate(req["text"], gc, cb)
    info = write_wav(req["out"], np.asarray(audio.samples, dtype=np.float32), audio.sample_rate)
    return {"ok": len(audio.samples) > 0, "sample_rate": audio.sample_rate, **info,
            "first_audio_s": round(state_fa["t"], 4) if state_fa["t"] else None, "frontend": {
                "normalized_text": req["text"],
                "note": "sherpa-onnx C++ Supertonic frontend (own NFKD table + unicode_indexer.bin); internal token ids not exposed to Python",
                "tokens": list(req["text"]), "u0301_in_normalized": req["text"].count("́"), "unk_tokens": 0,
                "tokens_containing_u0301": req["text"].count("́")}}


if __name__ == "__main__":
    serve(load, synth)
