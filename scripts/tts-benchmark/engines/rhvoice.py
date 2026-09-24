"""RHVoice adapter — runs the system `RHVoice-test` CLI (one process per synthesis).

Stress: RHVoice honours U+0301 (measured: «пи́шу»/«бе́рега» change the audio;
a mark that matches the default stress gives byte-identical audio to the
unmarked word). So text is sent UNCHANGED.

Rate: `-r <percent>`, 100 = default; 80 ≈ 0.8x speed (measured 2.06s → 2.58s).
"""

import os
import shutil
import subprocess
from pathlib import Path

ENGINE = "rhvoice"
VOICES_DIR = Path("/usr/share/RHVoice/voices")


def available():
    exe = shutil.which("RHVoice-test")
    if not exe:
        return False, "RHVoice-test not found (apt install rhvoice rhvoice-russian)"
    if not VOICES_DIR.is_dir():
        return False, f"{VOICES_DIR} missing"
    return True, ""


def version():
    out = subprocess.run(["dpkg-query", "-W", "-f=${Version}", "rhvoice"], capture_output=True, text=True)
    return f"RHVoice {out.stdout.strip() or 'unknown'} (Ubuntu package rhvoice / rhvoice-russian)"


def voices():
    found = []
    for info in sorted(VOICES_DIR.glob("*/voice.info")):
        meta = dict(line.split("=", 1) for line in info.read_text().splitlines() if "=" in line)
        if meta.get("language") != "Russian":
            continue
        size = sum(f.stat().st_size for f in info.parent.rglob("*") if f.is_file())
        found.append({"id": info.parent.name, "name": meta.get("name", info.parent.name),
                      "gender": meta.get("gender", ""), "model_bytes": size})
    return found


def normalize(text):
    """Returns (engine_input, steps). No preprocessing is required."""
    return text, []


VARIANTS = [("", normalize, "text sent as-is (U+0301 kept; RHVoice honours it)")]


def rate_args(rate):
    if rate == 1.0:
        return [], "default rate"
    percent = round(rate * 100)
    return ["-r", str(percent)], f"-r {percent} (percent of default speed)"


def synthesize(text, voice, rate, out_path):
    args, rate_note = rate_args(rate)
    cmd = ["RHVoice-test", "-p", voice, *args, "-o", str(out_path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    proc.stdin.write(text.encode("utf-8"))
    proc.stdin.close()
    _, status, usage = os.wait4(proc.pid, 0)
    stderr = proc.stderr.read().decode("utf-8", "replace")
    proc.stdout.close(); proc.stderr.close()
    return {
        "ok": status == 0 and out_path.exists() and out_path.stat().st_size > 44,
        "error": None if status == 0 else f"exit {status}: {stderr.strip()[:300]}",
        "peak_rss_kb": usage.ru_maxrss,
        "engine_infer_s": None,
        "rate_mapping": rate_note,
        "command": " ".join(cmd) + "  (text on stdin)",
    }
