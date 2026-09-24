"""Worker side of the neural-engine protocol (runs INSIDE the engine's venv).

The model is loaded once; then one JSON request per stdin line, one JSON reply
per stdout line. Library chatter is pushed to stderr so stdout stays clean.
Standard library only — imported by every *_worker.py.
"""

import json
import os
import resource
import sys
import time
import traceback


def rss_kb():
    for line in open("/proc/self/status"):
        if line.startswith("VmRSS:"):
            return int(line.split()[1])
    return None


def serve(load, synth):
    """load() -> (state, info dict); synth(state, req) -> reply dict (ok, sample_rate, frontend, …)."""
    proto = os.fdopen(os.dup(1), "w", buffering=1)
    os.dup2(2, 1)
    sys.stdout = sys.stderr

    def send(obj):
        proto.write(json.dumps(obj, ensure_ascii=False) + "\n")

    rss0 = rss_kb()
    t0 = time.perf_counter()
    try:
        state, info = load()
    except Exception as exc:  # noqa: BLE001 — reported to the runner verbatim
        send({"ready": False, "error": f"{type(exc).__name__}: {exc}", "trace": traceback.format_exc()[-2000:]})
        return
    send({"ready": True, "load_s": round(time.perf_counter() - t0, 3), "rss_before_load_kb": rss0,
          "rss_after_load_kb": rss_kb(), "peak_rss_after_load_kb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
          **info})
    for line in sys.stdin:
        req = json.loads(line)
        t = time.perf_counter()
        try:
            reply = synth(state, req)
        except Exception as exc:  # noqa: BLE001
            reply = {"ok": False, "error": f"{type(exc).__name__}: {exc}", "trace": traceback.format_exc()[-2000:]}
        reply["infer_s"] = round(time.perf_counter() - t, 4)
        reply["rss_kb"] = rss_kb()
        reply["peak_rss_kb"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        send(reply)


def seed_all(seed):
    import random

    import numpy as np
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def write_wav(path, samples, sample_rate):
    """float waveform (any shape squeezable to 1-D) → 16-bit mono WAV."""
    import numpy as np
    import soundfile as sf

    data = np.asarray(samples, dtype="float32").squeeze()
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    sf.write(path, data, sample_rate, subtype="PCM_16")
    return {"clipped": peak > 1.0, "peak": round(peak, 4)}
