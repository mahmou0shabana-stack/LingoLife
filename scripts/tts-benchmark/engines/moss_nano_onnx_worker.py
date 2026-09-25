"""MOSS-TTS-Nano worker (ONNX Runtime CPU path, torch-free) — envs/moss-nano + tools/MOSS-TTS-Nano.

    envs/moss-nano/bin/python engines/moss_nano_onnx_worker.py <reference.wav> <wetext 1|0>

Mirrors the official infer_onnx.py: OnnxTtsRuntime over the official ONNX
exports (MOSS-TTS-Nano-100M-ONNX + MOSS-Audio-Tokenizer-Nano-ONNX), 4 ORT
threads, sample_mode "fixed", realtime streaming codec decode ON (all repo
defaults). Time-to-first-audio = request start → first non-empty streaming
codec output. torch is never imported by this path.
"""

import sys
import time
from pathlib import Path

# engines/ holds adapters named like engine packages: search it last.
sys.path.append(sys.path.pop(0))

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT / "tools" / "MOSS-TTS-Nano"
sys.path.insert(0, str(REPO))

from _worker_io import serve, write_wav  # noqa: E402

REF = sys.argv[1]
WETEXT = sys.argv[2] == "1"
state_first_audio = {}


def load():
    import logging
    import subprocess
    from importlib.metadata import version

    from onnx_tts_runtime import OnnxTtsRuntime

    logging.disable(logging.INFO)
    rt = OnnxTtsRuntime(model_dir=str(ROOT / "models/moss-nano-onnx"), thread_count=4,
                        output_dir=str(ROOT / "logs" / "moss-nano-scratch"))
    rt._ensure_text_normalizer(WETEXT)
    orig = rt.codec_streaming_session.run_frames

    def timed_run_frames(frames):
        out = orig(frames)
        if out is not None and out[1] > 0 and state_first_audio.get("t") is None:
            state_first_audio["t"] = time.perf_counter()
        return out

    rt.codec_streaming_session.run_frames = timed_run_frames
    commit = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return rt, {
        "packages": {p: version(p) for p in ("onnxruntime", "WeTextProcessing", "sentencepiece", "numpy")},
        "torch_imported": "torch" in sys.modules,
        "repo_commit": commit, "reference_audio": REF, "wetext_processing": WETEXT, "robust_normalization": True,
        "execution_provider": rt.execution_provider, "threads": 4,
        "generation_defaults": rt.manifest["generation_defaults"],
    }


def synth(rt, req):
    state_first_audio["t"] = None
    t0 = time.perf_counter()
    res = rt.synthesize(text=req["text"], prompt_audio_path=str(ROOT / REF),
                        output_audio_path=str(ROOT / "logs" / "moss-nano-scratch" / "last_onnx.wav"),
                        streaming=True, enable_wetext=WETEXT, enable_normalize_tts_text=True, seed=req["seed"])
    info = write_wav(req["out"], res["waveform"], int(res["sample_rate"]))
    text = str(res["prepared_texts"]["text"])
    ids = rt.encode_text(text)
    pieces = [rt.sp_model.id_to_piece(i) for i in ids]
    fa = state_first_audio.get("t")
    return {"ok": True, "sample_rate": int(res["sample_rate"]), **info,
            "first_audio_s": round(fa - t0, 4) if fa else None, "frontend": {
                "normalized_text": text,
                "normalization_method": res["prepared_texts"]["normalization_method"],
                "text_normalization_language": res["prepared_texts"]["text_normalization_language"],
                "tokens": pieces,
                "u0301_in_normalized": text.count("́"),
                "unk_tokens": sum(1 for i in ids if i == rt.sp_model.unk_id()),
                "tokens_containing_u0301": sum("́" in p for p in pieces),
                "chunks": len(res["text_chunks"]),
            }}


if __name__ == "__main__":
    serve(load, synth)
