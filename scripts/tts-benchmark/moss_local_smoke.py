#!/usr/bin/env python3
"""MOSS-TTS Local (1.7B backbone) — guarded CPU smoke test, not a full benchmark.

    python3 moss_local_smoke.py            # runs the worker under an RSS watchdog

Official CPU path (model README): torch_dtype=float32 → 3.06B params × 4 B = 12.2 GB, plus
MOSS-Audio-Tokenizer 1.77B params stored in fp32 = 7.1 GB → ~19.4 GB of weights on a 15.7 GB
machine with no swap: not attempted (it cannot fit; trying would only OOM-kill the host).

This smoke test loads the weights in their STORED dtypes (model bf16, codec fp32 = 13.2 GB) —
a deviation from the official CPU dtype, recorded as such — and synthesizes corpus item #04
(as-is, then U+0301 stripped, same seed) with the native-Russian FLEURS female reference.
A watchdog kills the worker if its RSS exceeds WATCHDOG_GB. Result: results/moss_local_smoke.json.
"""

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WATCHDOG_GB = 14.5
PY = ROOT / "envs" / "moss-nano" / "bin" / "python"

WORKER = r'''
import json, sys, time, resource, torch
sys.path.insert(0, sys.argv[1])
from pathlib import Path
ROOT = Path(sys.argv[2])
def rss():
    return int(next(l for l in open("/proc/self/status") if l.startswith("VmRSS")).split()[1]) // 1024
out = {"steps": []}
def step(name, **kw):
    out["steps"].append({"step": name, "t": round(time.perf_counter() - T0, 2), "rss_mb": rss(),
                         "peak_rss_mb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024, **kw})
    print(json.dumps(out["steps"][-1]), flush=True)
T0 = time.perf_counter()
torch.set_num_threads(4)
from transformers import AutoModel, AutoProcessor
step("imports")
proc = AutoProcessor.from_pretrained(str(ROOT / "models/moss-local"), trust_remote_code=True,
                                     codec_path=str(ROOT / "models/moss-audio-tokenizer"))
step("processor+codec loaded", codec_dtype=str(next(proc.audio_tokenizer.parameters()).dtype))
model = AutoModel.from_pretrained(str(ROOT / "models/moss-local"), trust_remote_code=True,
                                  attn_implementation="eager", torch_dtype=torch.bfloat16)
model.eval()
step("model loaded", model_dtype=str(next(model.parameters()).dtype))
ref = str(ROOT / "references/ru_female_fleurs.wav")
for tag, text in [("as-is", "Э́тот ста́рый за́мок стои́т на холме́."), ("no-stress-marks", "Этот старый замок стоит на холме.")]:
    torch.manual_seed(1004)
    t = time.perf_counter()
    batch = proc([[proc.build_user_message(text=text, reference=[ref])]], mode="generation")
    with torch.no_grad():
        o = model.generate(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"], max_new_tokens=4096)
    msg = next(iter(proc.decode(o)))
    audio = msg.audio_codes_list[0]
    wall = time.perf_counter() - t
    sr = proc.model_config.sampling_rate
    import soundfile as sf
    p = ROOT / "output" / "moss-local-smoke" / f"04_{tag}.wav"
    p.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(p), audio.float().cpu().numpy().reshape(-1), sr, subtype="PCM_16")
    dur = audio.shape[-1] / sr
    ids = proc.tokenizer(text)["input_ids"]
    step("synthesized " + tag, text=text, wall_s=round(wall, 2), audio_s=round(dur, 3), rtf=round(wall / dur, 2) if dur else None,
         file=str(p.relative_to(ROOT)), text_tokens=[proc.tokenizer.decode([i]) for i in ids])
'''


def main():
    result = {"about": __doc__.strip().splitlines()[0], "watchdog_gb": WATCHDOG_GB,
              "official_cpu_config": {"model_dtype": "float32", "model_params": 3060606464,
                                      "codec_params": 1774566400, "codec_dtype": "float32",
                                      "weights_gb": round((3060606464 * 4 + 1774566400 * 4) / 1e9, 1),
                                      "machine_ram_gb": 15.7, "attempted": False,
                                      "reason": "weights alone exceed physical RAM (no swap)"},
              "smoke_config": {"model_dtype": "bfloat16 (as stored)", "codec_dtype": "float32 (as stored)",
                               "weights_gb": round((3060606464 * 2 + 1774566400 * 4) / 1e9, 1)},
              "steps": [], "outcome": None}
    t0 = time.perf_counter()
    proc = subprocess.Popen([str(PY), "-c", WORKER, str(ROOT / "tools" / "MOSS-TTS"), str(ROOT)],
                            stdout=subprocess.PIPE, stderr=open(ROOT / "logs" / "moss-local-smoke.stderr.log", "w"),
                            text=True, cwd=str(ROOT))
    peak = {"mb": 0, "killed": False}

    def watch():
        while proc.poll() is None:
            try:
                kb = int(next(l for l in open(f"/proc/{proc.pid}/status") if l.startswith("VmRSS")).split()[1])
            except (OSError, StopIteration):
                break
            peak["mb"] = max(peak["mb"], kb // 1024)
            if kb / 1024 / 1024 > WATCHDOG_GB:
                peak["killed"] = True
                proc.kill()
            time.sleep(0.2)

    threading.Thread(target=watch, daemon=True).start()
    for line in proc.stdout:
        result["steps"].append(json.loads(line))
        print(line.strip(), flush=True)
    code = proc.wait()
    result["exit_code"] = code
    result["wall_total_s"] = round(time.perf_counter() - t0, 1)
    result["watchdog_peak_rss_mb"] = peak["mb"]
    result["outcome"] = ("killed by watchdog (RSS > %.1f GB)" % WATCHDOG_GB if peak["killed"]
                         else "ok" if code == 0 else f"worker exited {code} — see logs/moss-local-smoke.stderr.log")
    if code not in (0, None) and not peak["killed"]:
        result["stderr_tail"] = (ROOT / "logs" / "moss-local-smoke.stderr.log").read_text()[-1500:]
    (ROOT / "results" / "moss_local_smoke.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(result["outcome"])


if __name__ == "__main__":
    main()
