#!/usr/bin/env python3
"""Builds page/index.html (the listening page) from results/*.json.

    scripts/tts-benchmark/.venv/bin/python scripts/tts-benchmark/build_page.py

Audio: one JSON pack per engine/voice in page/packs/, mapping sentence id →
base64 audio (JSON because artifact hosting only serves web media/data types). With `soundfile`
installed (in .venv) the packs are FLAC — lossless, same samples and sample
rate as the WAV. Without it the packs hold the original WAV bytes. Opened
from disk (file://) the page falls back to the WAVs in output/.
"""

import base64
import datetime
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAGE = ROOT / "page"

try:
    import soundfile as sf
except ImportError:  # stdlib-only fallback: raw WAV packs
    sf = None


def encode(wav_path):
    if sf is None:
        return wav_path.read_bytes(), "audio/wav"
    data, rate = sf.read(str(wav_path), dtype="int16")
    buf = io.BytesIO()
    sf.write(buf, data, rate, format="FLAC", subtype="PCM_16")
    return buf.getvalue(), "audio/flac"


def readable_frontend(fe):
    """Byte-level BPE tokens (Qwen3, CosyVoice) can hold part of one UTF-8 character; decoded alone they
    come out as U+FFFD. Shown as ⟨byte⟩ on the page; results.json keeps the raw decode."""
    if not fe:
        return fe
    return {**fe, "tokens": [t.replace("\ufffd", "⟨byte⟩") for t in fe.get("tokens", [])]}


def main():
    corpus = json.loads((ROOT / "corpus.json").read_text())
    results = json.loads((ROOT / "results" / "results.json").read_text())["records"]
    summary = json.loads((ROOT / "results" / "summary.json").read_text())
    env = json.loads((ROOT / "results" / "environment.json").read_text())

    records, packs = {}, {}
    (PAGE / "packs").mkdir(parents=True, exist_ok=True)
    groups = {}
    for r in results:
        records[f"{r['engine']}/{r['voice']}/{r['item_id']}"] = {
            "in": r["engine_input"], "pp": r["preprocessing"], "sm": r["stress_marks_in_input"],
            "ss": r["stress_marks_sent"], "ph": r.get("espeak_phonemes"), "d": r.get("audio_duration_s"),
            "sr": r.get("sample_rate"), "ch": r.get("channels"), "b": r.get("file_bytes"),
            "w": r["synthesis_wall_s"], "i": r.get("engine_infer_s"), "rtf": r.get("rtf_wall"),
            "rss": r["peak_rss_mb"], "rm": r.get("rate_mapping"), "mv": r["model_version"],
            "v": r.get("model_voice", r["voice"]), "f": r.get("output_file"), "err": r.get("error"),
            "first": r.get("first_call_for_voice"),
            "seed": r.get("seed"), "fe": readable_frontend(r.get("frontend")),
        }
        if r["success"]:
            groups.setdefault(f"{r['engine']}/{r['voice']}", []).append(r)

    for key, recs in groups.items():
        name = key.replace("/", "__").replace("~", "_") + ".json"
        if not all((ROOT / r["output_file"]).exists() for r in recs):
            # audio from an earlier run that is not on this machine: keep the pack already built from it
            if (PAGE / "packs" / name).exists():
                packs[key] = {"file": f"packs/{name}", "type": json.loads((PAGE / "packs" / name).read_text())["type"]}
                continue
            raise SystemExit(f"{key}: WAVs missing and no existing pack — re-run run.py for this engine")
        clips, kind = {}, None
        for r in recs:
            data, kind = encode(ROOT / r["output_file"])
            clips[r["item_id"]] = base64.b64encode(data).decode("ascii")
        (PAGE / "packs" / name).write_text(json.dumps({"type": kind, "clips": clips}))
        packs[key] = {"file": f"packs/{name}", "type": kind}

    engines = summary["engines_meta"]
    data = {
        "generated": datetime.date.today().isoformat(),
        "environment": env,
        "engines": engines,
        "summary": {k: v for k, v in summary["engines"].items() if v},
        "items": corpus["items"],
        "records": records,
        "packs": packs,
    }
    html = (PAGE / "template.html").read_text().replace(
        "/*__DATA__*/null", json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
    (PAGE / "index.html").write_text(html)
    total = sum(p.stat().st_size for p in (PAGE / "packs").glob("*.json"))
    print(f"page/index.html {len(html.encode()) / 1e6:.2f} MB · {len(packs)} packs {total / 1e6:.1f} MB ({'FLAC' if sf else 'WAV'})")


if __name__ == "__main__":
    main()
