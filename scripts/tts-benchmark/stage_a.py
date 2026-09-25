#!/usr/bin/env python3
"""Phase 1C Stage A — Russian smoke + stress shootout on stress_suite.json (22 items).

    python3 stage_a.py supertonic omnivoice

For every engine and voice, each item is synthesized in three variants with the SAME seed:
  as-is        text with the intended stress as U+0301
  no-marks     U+0301 removed — the engine's own stress handling
  silero-auto  U+0301 removed, then Silero Stress (silero-stress 1.5) adds stress automatically,
               converted to U+0301 (results/silero_stress_test.json) — could an automatic stress
               front-end feed this engine?
Writes output/stage_a/<engine>/<voice>/<variant>/<id>.wav and results/stage_a.json (merged per engine).
What is measured: whether U+0301 reaches the engine's frontend/tokens, whether it changes the
deterministic output, and the exact input transformation. Whether the stress is CORRECT is not
measured — that is for the listener.
"""

import hashlib
import importlib
import json
import sys
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from run import ADAPTERS, environment  # noqa: E402


def wav_info(path):
    with wave.open(str(path)) as w:
        return round(w.getnframes() / w.getframerate(), 3), w.getframerate(), w.getnchannels()


def variants_for(item, silero):
    plain = item["text"].replace("́", "")
    return [("as-is", item["text"], []),
            ("no-marks", plain, [f"removed {item['text'].count(chr(0x301))}× U+0301"] if "́" in item["text"] else []),
            ("silero-auto", silero[item["id"]], ["U+0301 removed, then Silero Stress 1.5 auto-stress ('+' → U+0301)"])]


def main():
    engines = sys.argv[1:]
    suite = json.loads((ROOT / "stress_suite.json").read_text())["items"]
    silero = {r["id"]: r["output_u0301"] for r in json.loads((ROOT / "results" / "silero_stress_test.json").read_text())["items"]}
    path = ROOT / "results" / "stage_a.json"
    data = json.loads(path.read_text()) if path.exists() else {"suite_version": 1, "engines": {}}
    import engines._neural as neural
    first_of_pair = {}
    for it in suite:
        if "pair" in it:  # neutral minimal pairs share one seed so only the mark position differs
            first_of_pair.setdefault(it["pair"], it["id"])
            neural.SEED_BY_STEM[it["id"]] = 1000 + int(first_of_pair[it["pair"]][1:])
    for eid in engines:
        mod = importlib.import_module(ADAPTERS[eid])
        ok, why = mod.available()
        if not ok:
            data["engines"][eid] = {"status": "unavailable", "reason": why}
            continue
        recs, voice_meta = [], {}
        for voice in mod.voices()[:1]:  # Stage A: first voice only
            vid = voice["id"]
            for item in suite:
                for variant, text, steps in variants_for(item, silero):
                    out = ROOT / "output" / "stage_a" / eid / vid / variant / f"{item['id']}.wav"
                    out.parent.mkdir(parents=True, exist_ok=True)
                    t0 = time.perf_counter()
                    res = mod.synthesize(text, vid, 1.0, out)
                    wall = time.perf_counter() - t0
                    rec = {"engine": eid, "voice": vid, "variant": variant, "item_id": item["id"], "category": item["category"],
                           "input_text": item["text"], "engine_input": text, "preprocessing": steps,
                           "stress_marks_sent": text.count("́"), "target": item.get("target"),
                           "meaning": item.get("meaning"), "context": item.get("context"),
                           "success": res["ok"], "synthesis_wall_s": round(wall, 3), "engine_infer_s": res.get("engine_infer_s"),
                           "peak_rss_mb": round(res["peak_rss_kb"] / 1024, 1), "error": res.get("error"),
                           **(res.get("extra") or {})}
                    if res["ok"]:
                        dur, sr, ch = wav_info(out)
                        rec.update({"output_file": str(out.relative_to(ROOT)), "audio_duration_s": dur, "sample_rate": sr,
                                    "channels": ch, "rtf_wall": round(wall / dur, 3) if dur else None,
                                    "audio_sha256": hashlib.sha256(out.read_bytes()).hexdigest()})
                    recs.append(rec)
                    print(f"[{eid}/{vid}/{variant}] {'ok ' if res['ok'] else 'ERR'} {item['id']} {wall:.1f}s {rec.get('audio_duration_s', '-')}s", flush=True)
            if hasattr(mod, "load_info"):
                voice_meta[vid] = {k: v for k, v in (mod.load_info.get(vid) or {}).items() if k != "trace"}
            mod.close(vid)
        by = {(r["item_id"], r["variant"]): r for r in recs if r["success"]}
        diffs = {}
        for item in suite:
            a, n, s = (by.get((item["id"], v)) for v in ("as-is", "no-marks", "silero-auto"))
            if a and n:
                diffs[item["id"]] = {"marks_change_audio": a["audio_sha256"] != n["audio_sha256"],
                                     "silero_auto_equals_as_is_audio": bool(s) and s["audio_sha256"] == a["audio_sha256"],
                                     "silero_auto_input_equals_as_is_input": bool(s) and s["engine_input"] == a["engine_input"],
                                     "duration_as_is": a["audio_duration_s"], "duration_no_marks": n["audio_duration_s"]}
        minimal_pairs = {}
        for it in suite:
            if "pair" in it:
                minimal_pairs.setdefault(it["pair"], []).append(it["id"])
        mp = {}
        for pid, (x, y) in minimal_pairs.items():
            ax, ay, nx, ny = by.get((x, "as-is")), by.get((y, "as-is")), by.get((x, "no-marks")), by.get((y, "no-marks"))
            if ax and ay and nx and ny:
                mp[pid] = {"items": [x, y], "targets": [ax["target"], ay["target"]], "shared_seed": neural.SEED_BY_STEM.get(x),
                           "unmarked_control_identical": nx["audio_sha256"] == ny["audio_sha256"],
                           "marked_audio_differs": ax["audio_sha256"] != ay["audio_sha256"],
                           "durations_marked": [ax["audio_duration_s"], ay["audio_duration_s"]]}
        unmarked = [i["id"] for i in suite if "́" not in i["text"]]
        data["engines"][eid] = {"status": "ran", "model_version": mod.version(), "voices": voice_meta, "records": recs,
                                "pairs": diffs, "minimal_pairs": mp,
                                "determinism_control": {i: not diffs[i]["marks_change_audio"] for i in unmarked if i in diffs},
                                "environment": environment()}
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
