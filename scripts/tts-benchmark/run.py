#!/usr/bin/env python3
"""Russian TTS benchmark runner — isolated from the LingoLife app.

    python3 scripts/tts-benchmark/run.py            # all working engines
    python3 scripts/tts-benchmark/run.py rhvoice    # one engine

Writes:
    output/<engine>/<voice>/<item-id>.wav   real audio, same filename across engines
    results/results.json                    one record per synthesis
    results/summary.json                    per engine/voice timing + memory
    results/environment.json                the machine this ran on

Only engines with an adapter in engines/ are run. Blocked engines are
reported from engines.json with their recorded blocker — never simulated.
Standard library only.
"""

import datetime
import importlib
import json
import os
import platform
import shutil
import statistics
import subprocess
import sys
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

ADAPTERS = {"rhvoice": "engines.rhvoice", "piper": "engines.piper"}


def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception as exc:  # noqa: BLE001 — environment probing must not abort the run
        return f"error: {exc}"


def environment():
    mem_kb = int(next(l.split()[1] for l in open("/proc/meminfo") if l.startswith("MemTotal")))
    gpu = sh("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader") if shutil.which("nvidia-smi") else ""
    disk = shutil.disk_usage(ROOT)
    return {
        "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "os": sh(". /etc/os-release && echo $PRETTY_NAME"),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "cpu": sh("lscpu | sed -n 's/^Model name: *//p'"),
        "cpu_cores": os.cpu_count(),
        "ram_gb": round(mem_kb / 1024 / 1024, 1),
        "gpu": gpu or "none (no nvidia-smi, no /dev/nvidia*)",
        "vram": "n/a (no GPU)" if not gpu else gpu,
        "python": platform.python_version(),
        "node": sh("node --version"),
        "disk_free_gb": round(disk.free / 1e9, 1),
    }


def wav_info(path):
    with wave.open(str(path)) as w:
        return round(w.getnframes() / w.getframerate(), 3), w.getframerate(), w.getnchannels()


def run_engine(engine_id, corpus, records):
    mod = importlib.import_module(ADAPTERS[engine_id])
    ok, why = mod.available()
    if not ok:
        print(f"[{engine_id}] not available: {why}")
        return None
    version = mod.version()
    per_voice = {}
    for voice, (suffix, normalize, variant_note) in [(v, var) for v in mod.voices() for var in mod.VARIANTS]:
        model_voice = voice["id"]
        vid = model_voice + suffix
        out_dir = ROOT / "output" / engine_id / vid
        out_dir.mkdir(parents=True, exist_ok=True)
        walls, rss = [], []
        for n, item in enumerate(corpus["items"]):
            engine_input, steps = normalize(item["text"])
            out = out_dir / f"{item['id']}.wav"
            if out.exists():
                out.unlink()
            t0 = time.perf_counter()
            res = mod.synthesize(engine_input, model_voice, item["rate"], out)
            wall = time.perf_counter() - t0
            rec = {
                "engine": engine_id,
                "model_version": version,
                "voice": vid,
                "model_voice": model_voice,
                "variant": variant_note,
                "language": "ru",
                "item_id": item["id"],
                "category": item["category"],
                "rate": item["rate"],
                "input_text": item["text"],
                "engine_input": engine_input,
                "preprocessing": steps,
                "stress_marks_in_input": item["text"].count("́"),
                "stress_marks_sent": engine_input.count("́"),
                "success": res["ok"],
                "first_call_for_voice": n == 0,
                "synthesis_wall_s": round(wall, 4),
                "engine_infer_s": res.get("engine_infer_s"),
                "peak_rss_mb": round(res["peak_rss_kb"] / 1024, 1),
                "rate_mapping": res.get("rate_mapping"),
                "command": res.get("command"),
                "output_file": str(out.relative_to(ROOT)) if res["ok"] else None,
                "error": res.get("error"),
            }
            if "espeak_phonemes" in res:
                rec["espeak_phonemes"] = res["espeak_phonemes"]
            if res["ok"]:
                dur, sr, ch = wav_info(out)
                rec.update({"audio_duration_s": dur, "sample_rate": sr, "channels": ch,
                            "file_bytes": out.stat().st_size,
                            "rtf_wall": round(wall / dur, 4) if dur else None,
                            "rtf_infer": round(res["engine_infer_s"] / dur, 4) if res.get("engine_infer_s") and dur else None})
                walls.append(wall)
                rss.append(rec["peak_rss_mb"])
            records.append(rec)
            mark = "ok " if res["ok"] else "ERR"
            print(f"[{engine_id}/{vid}] {mark} {item['id']} {wall:.2f}s {rec.get('audio_duration_s', '-')}s")
        ok_recs = [r for r in records if r["engine"] == engine_id and r["voice"] == vid and r["success"]]
        per_voice[vid] = {
            "model_voice": model_voice,
            "variant": variant_note,
            "model_bytes": voice.get("model_bytes"),
            "syntheses": len(corpus["items"]),
            "succeeded": len(ok_recs),
            "first_run_wall_s": round(walls[0], 3) if walls else None,
            "warm_wall_median_s": round(statistics.median(walls[1:]), 3) if len(walls) > 1 else None,
            "rtf_wall_median": round(statistics.median(r["rtf_wall"] for r in ok_recs), 4) if ok_recs else None,
            "rtf_infer_median": (round(statistics.median(r["rtf_infer"] for r in ok_recs if r["rtf_infer"]), 4)
                                 if any(r.get("rtf_infer") for r in ok_recs) else None),
            "peak_rss_mb_max": max(rss) if rss else None,
        }
    return {"model_version": version, "voices": per_voice}


def main():
    corpus = json.loads((ROOT / "corpus.json").read_text())
    engines_meta = json.loads((ROOT / "engines.json").read_text())
    wanted = sys.argv[1:] or list(ADAPTERS)
    (ROOT / "results").mkdir(exist_ok=True)
    results_path = ROOT / "results" / "results.json"
    records = [r for r in json.loads(results_path.read_text())["records"] if r["engine"] not in wanted] \
        if results_path.exists() else []
    summary_path = ROOT / "results" / "summary.json"
    summary = json.loads(summary_path.read_text()) if summary_path.exists() else {"engines": {}}

    for engine_id in wanted:
        summary["engines"][engine_id] = run_engine(engine_id, corpus, records)

    for meta in engines_meta["engines"]:
        eid = meta["id"]
        done = summary["engines"].get(eid)
        ok = any(r["engine"] == eid and r["success"] for r in records)
        meta["status"] = "working" if ok else "blocked"
        summary["engines"].setdefault(eid, None)
        summary.setdefault("status", {})[eid] = meta["status"]
        if done is None and not ok and not meta.get("blocker"):
            meta["blocker"] = {"kind": "adapter-unavailable", "detail": "adapter reported the engine unavailable"}

    env = environment()
    (ROOT / "results" / "environment.json").write_text(json.dumps(env, ensure_ascii=False, indent=2))
    results_path.write_text(json.dumps({"corpus_version": corpus["version"], "records": records},
                                       ensure_ascii=False, indent=1))
    summary["engines_meta"] = engines_meta["engines"]
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    ok = sum(r["success"] for r in records)
    print(f"\n{ok}/{len(records)} syntheses succeeded → {results_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
