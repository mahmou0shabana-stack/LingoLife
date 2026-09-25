#!/usr/bin/env python3
"""Silero Stress (silero-stress 1.5, MIT) — text-level Russian stress / homograph test on stress_suite.json.

    envs/omnivoice/bin/python silero_stress_test.py     → results/silero_stress_test.json

Silero's v5 Russian TTS voices could not be downloaded here (models.silero.ai refused), but Silero's
standalone stress + homograph model is on PyPI. This measures what it predicts, objectively:
each suite item has its U+0301 marks removed, goes through the accentor, and the predicted stress
('+' before the vowel) is compared with the intended stress for the item's target homograph.
For "neutral" items the sentence alone cannot decide the meaning — the prediction is recorded, not scored.
"""

import json
import re
import resource
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VOWELS = "аеёиоуыэюяАЕЁИОУЫЭЮЯ"


def plus_to_acute(s):
    """'з+амок' → 'за́мок' (Silero writes '+' before the stressed vowel)."""
    return re.sub(r"\+([" + VOWELS + "])", lambda m: m.group(1) + "́", s)


def stress_pos(word):
    """Index (among vowels) of the stressed vowel in a U+0301-marked word; ё counts as stressed if no mark."""
    w = unicodedata.normalize("NFC", word)
    vi = -1
    for i, ch in enumerate(w):
        if ch in VOWELS:
            vi += 1
            if i + 1 < len(w) and w[i + 1] == "́":
                return vi
    return None


def main():
    from importlib.metadata import version

    import torch
    from silero_stress import load_accentor

    torch.set_num_threads(1)
    t0 = time.perf_counter()
    acc = load_accentor()
    load_s = time.perf_counter() - t0
    suite = json.loads((ROOT / "stress_suite.json").read_text())["items"]
    out = []
    for it in suite:
        plain = it["text"].replace("́", "")
        t = time.perf_counter()
        pred_plus = acc(plain)
        ms = (time.perf_counter() - t) * 1000
        pred = plus_to_acute(pred_plus)
        rec = {"id": it["id"], "category": it["category"], "input": plain, "output_plus": pred_plus,
               "output_u0301": pred, "reference": it["text"], "latency_ms": round(ms, 1)}
        if "target" in it:
            base = it["target"].replace("́", "")
            words = re.findall(r"[\ẃ+]+", pred)
            hit = next((w for w in words if w.replace("́", "").lower() == base.lower()), None)
            rec.update({"target": it["target"], "meaning": it["meaning"], "context": it["context"], "predicted_word": hit,
                        "predicted_matches_intended": (stress_pos(hit) == stress_pos(it["target"])) if hit else None})
        if it["category"] == "yo-omitted":
            rec["yo_restored"] = "ё" in pred_plus
        out.append(rec)
        print(rec["id"], pred_plus, "→", rec.get("predicted_matches_intended", ""))
    ctx = [r for r in out if r.get("context") == "disambiguating"]
    result = {
        "model": f"silero-stress {version('silero-stress')} (github.com/snakers4/silero-stress @ d38096c, MIT); torch {version('torch')}, 1 CPU thread",
        "load_s": round(load_s, 2), "peak_rss_mb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024,
        "homographs_in_disambiguating_context": {"correct": sum(bool(r["predicted_matches_intended"]) for r in ctx), "total": len(ctx)},
        "items": out,
    }
    (ROOT / "results" / "silero_stress_test.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(result["homographs_in_disambiguating_context"], "load", result["load_s"], "s")


if __name__ == "__main__":
    main()
