"""Piper adapter — official Piper CLI release 2023.11.14-2 (C++, onnxruntime, CPU).

Stress: Piper phonemizes with its bundled espeak-ng, which IGNORES U+0301
(measured with piper_phonemize: «за́мок», «замо́к», «замок» → identical
`zamˈok`; «+» is read aloud as «плюс»). Text is sent UNCHANGED — the marks
are not removed, but the engine does not honour them. The phonemes espeak-ng
actually produced are recorded per synthesis so this is auditable.

Rate: `--length_scale` = 1/rate (0.8x speed → 1.25).
"""

import json
import os
import re
import subprocess
from pathlib import Path

ENGINE = "piper"
ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools" / "piper"
MODELS = ROOT / "models" / "piper"
EXE = TOOLS / "piper"
RELEASE = "2023.11.14-2"


def available():
    if not EXE.exists():
        return False, f"{EXE} missing — run setup.sh"
    if not list(MODELS.glob("ru-*.onnx")):
        return False, f"no Russian .onnx voice in {MODELS}"
    return True, ""


def version():
    return f"Piper CLI {RELEASE} (github.com/rhasspy/piper release), onnxruntime 1.14.1"


def voices():
    found = []
    for onnx in sorted(MODELS.glob("ru-*.onnx")):
        cfg = json.loads(Path(f"{onnx}.json").read_text())
        found.append({"id": onnx.stem, "name": onnx.stem, "gender": "",
                      "model_bytes": onnx.stat().st_size,
                      "sample_rate": cfg["audio"]["sample_rate"],
                      "espeak_voice": cfg["espeak"]["voice"]})
    return found


def normalize(text):
    """Returns (engine_input, steps). No preprocessing is applied."""
    return text, []


def strip_marks(text):
    """Explicit, recorded variant: remove U+0301 so espeak-ng can use its dictionary.

    Measured on this corpus: a word CONTAINING U+0301 misses espeak-ng's
    dictionary and falls back to letter rules — «перейти́» → pʲirʲˈejtʲi,
    unmarked «перейти» → pʲirʲijtʲˈɪ. Without marks espeak-ng applies its own
    dictionary stress, which cannot tell homographs apart (за́мок/замо́к).
    """
    n = text.count("\u0301")
    return text.replace("\u0301", ""), ([f"removed {n}× U+0301 (combining acute) — espeak-ng mis-stresses words containing it"] if n else [])


# (voice-directory suffix, normalizer, description) — each variant is its own
# output/<engine>/<voice><suffix>/ directory so both can be heard side by side.
VARIANTS = [
    ("", normalize, "text sent as-is (U+0301 kept)"),
    ("~no-stress-marks", strip_marks, "U+0301 removed before synthesis (recorded per record)"),
]


def phonemes(text):
    env = {**os.environ, "LD_LIBRARY_PATH": str(TOOLS)}
    out = subprocess.run([str(TOOLS / "piper_phonemize"), "-l", "ru", "--espeak_data", str(TOOLS / "espeak-ng-data")],
                         input=text, capture_output=True, text=True, env=env)
    parts = []
    for line in out.stdout.splitlines():
        try:
            parts.append("".join(json.loads(line)["phonemes"]))
        except (ValueError, KeyError):
            pass
    return " | ".join(parts)


def synthesize(text, voice, rate, out_path):
    length_scale = round(1 / rate, 4)
    cmd = [str(EXE), "-m", str(MODELS / f"{voice}.onnx"), "-f", str(out_path)]
    note = "default length_scale 1"
    if rate != 1.0:
        cmd += ["--length_scale", str(length_scale)]
        note = f"--length_scale {length_scale} (= 1/rate)"
    env = {**os.environ, "LD_LIBRARY_PATH": str(TOOLS)}
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    proc.stdin.write(text.encode("utf-8"))
    proc.stdin.close()
    _, status, usage = os.wait4(proc.pid, 0)
    stderr = proc.stderr.read().decode("utf-8", "replace")
    proc.stdout.close(); proc.stderr.close()
    infer = re.search(r"infer=([0-9.]+) sec", stderr)
    return {
        "ok": status == 0 and out_path.exists() and out_path.stat().st_size > 44,
        "error": None if status == 0 else f"exit {status}: {stderr.strip()[-300:]}",
        "peak_rss_kb": usage.ru_maxrss,
        "engine_infer_s": float(infer.group(1)) if infer else None,
        "rate_mapping": note,
        "command": " ".join(cmd) + "  (text on stdin)",
        "espeak_phonemes": phonemes(text),
    }
