"""MOSS-TTS-Nano worker (PyTorch path) — runs in envs/moss-nano with the official repo in tools/MOSS-TTS-Nano.

    envs/moss-nano/bin/python engines/moss_nano_worker.py <reference.wav> <wetext 1|0>

Mirrors the official infer.py / app.py flow: the repository's text pipeline
(prepare_tts_request_texts: robust cleanup + WeTextProcessing, both ON by
default), then NanoTTSService.synthesize_stream in voice_clone mode with the
reference clip. Sampling parameters are the repository defaults. Streaming
is used so time-to-first-audio can be measured; the full waveform is the
concatenation the service returns in its final event.
"""

import sys
import time
from pathlib import Path

import torch

# engines/ holds adapters named like engine packages: search it last.
sys.path.append(sys.path.pop(0))

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT / "tools" / "MOSS-TTS-Nano"
sys.path.insert(0, str(REPO))

from _worker_io import seed_all, serve, write_wav  # noqa: E402

REF = sys.argv[1]
WETEXT = sys.argv[2] == "1"


def load():
    import logging
    import subprocess
    from importlib.metadata import version

    import sentencepiece as spm
    from moss_tts_nano_runtime import NanoTTSService
    from text_normalization_pipeline import WeTextProcessingManager

    logging.disable(logging.INFO)
    torch.set_num_threads(4)
    svc = NanoTTSService(checkpoint_path=str(ROOT / "models/moss-nano"),
                         audio_tokenizer_path=str(ROOT / "models/moss-audio-tokenizer-nano"),
                         device="cpu", dtype="float32", output_dir=str(ROOT / "logs" / "moss-nano-scratch"))
    svc.preload(voices=[], load_model=True)
    svc._load_audio_tokenizer_locked(tts_attn_implementation=svc._read_model_attention_implementation(svc.get_model())[0])
    tn = None
    if WETEXT:
        tn = WeTextProcessingManager()
        snap = tn.ensure_ready()
        if not snap.ready:
            raise RuntimeError(snap.error or snap.message)
    sp = spm.SentencePieceProcessor(model_file=str(ROOT / "models/moss-nano/tokenizer.model"))
    commit = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return (svc, tn, sp), {
        "packages": {p: version(p) for p in ("torch", "transformers", "WeTextProcessing", "sentencepiece")},
        "repo_commit": commit, "reference_audio": REF, "wetext_processing": WETEXT, "robust_normalization": True,
        "device": "cpu", "dtype": "float32", "threads": torch.get_num_threads(),
        "sentencepiece_has_u0301": sp.piece_to_id("́") != sp.unk_id(),
    }


def synth(state, req):
    from text_normalization_pipeline import prepare_tts_request_texts

    svc, tn, sp = state
    seed_all(req["seed"])
    t0 = time.perf_counter()
    prepared = prepare_tts_request_texts(text=req["text"], prompt_text="", voice="", enable_wetext=WETEXT,
                                         enable_normalize_tts_text=True, text_normalizer_manager=tn)
    text = str(prepared["text"])
    first_audio = None
    final = None
    for ev in svc.synthesize_stream(text=text, mode="voice_clone", prompt_audio_path=str(ROOT / REF),
                                    output_audio_path=str(ROOT / "logs" / "moss-nano-scratch" / "last.wav"),
                                    seed=req["seed"]):
        if ev["type"] == "audio" and first_audio is None and not ev.get("is_pause"):
            first_audio = time.perf_counter() - t0
        if ev["type"] == "result":
            final = ev
    wav = final["waveform_numpy"]
    sr = int(final["sample_rate"])
    info = write_wav(req["out"], wav, sr)
    ids = sp.encode(text)
    pieces = [sp.id_to_piece(i) for i in ids]
    return {"ok": True, "sample_rate": sr, **info, "first_audio_s": round(first_audio, 4) if first_audio else None, "frontend": {
        "normalized_text": text,
        "normalization_method": prepared["normalization_method"],
        "text_normalization_language": prepared["text_normalization_language"],
        "tokens": pieces,
        "u0301_in_normalized": text.count("́"),
        "unk_tokens": sum(1 for i in ids if i == sp.unk_id()),
        "tokens_containing_u0301": sum("́" in p for p in pieces),
        "chunks": len(final.get("voice_clone_text_chunks") or [text]),
    }}


if __name__ == "__main__":
    serve(load, synth)
