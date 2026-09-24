# Russian TTS Benchmark Lab (Phase 1)

An isolated benchmark that runs outside the LingoLife app. Nothing here is imported by the app,
and it doesn't touch the Voice Center, providers, storage, or the audio pipeline.

```
setup.sh            installs RHVoice (apt) and Piper (GitHub release) into this folder
corpus.json         32 Russian sentences in LingoLife style (U+0301 stress marks kept)
engines.json        all 6 target engines: license, CPU/GPU, and the exact blocker for blocked ones
engines/*.py        adapters only for engines that really run here (rhvoice, piper)
run.py              synthesizes to output/<engine>/<voice>/<id>.wav and writes results/
build_page.py       builds page/index.html, the listening page
results/results.json      one record per synthesis (input, engine input, preprocessing, timings, …)
results/summary.json      per engine/voice: first call, warm median, RTF, peak RAM, model size
results/environment.json  the machine it ran on
```

Reproduce: `bash setup.sh && python3 run.py && .venv/bin/python build_page.py`.
To open the page locally, serve the repo (`python3 -m http.server`) and open
`scripts/tts-benchmark/page/index.html`.

## Results of this run (2026-09-24)

Machine: Ubuntu 24.04, Intel Xeon 2.1 GHz × 4 cores, 15.7 GB RAM, **no GPU**, Python 3.11.

| Engine | Status | Tested |
|---|---|---|
| RHVoice 1.8.0 | working | all 14 Russian voices × 32 sentences |
| Piper (CLI 2023.11.14-2) | working | ru-irinia-medium, in two recorded variants (below) × 32 sentences |
| XTTS v2 | blocked | weights only on huggingface.co, which is refused (CONNECT 403) |
| Qwen3-TTS | blocked | weights only on huggingface.co / modelscope.cn, both refused (403) |
| Chatterbox Multilingual V3 | blocked | `t3_mtl23ls_v3.safetensors` only on huggingface.co (403) |
| CosyVoice 3 | blocked | Fun-CosyVoice3-0.5B-2512 only on modelscope.cn / huggingface.co (403) |

All 512 syntheses succeeded. No substitute models were used.

## Stress and preprocessing findings (measured, not assumed)

- **RHVoice honors U+0301.** «пи́шу» and «бе́рега» change the audio. When the mark matches the
  default stress, the output is byte-identical to the unmarked word (items 27 and 28 are
  identical for every voice checked). Text is sent unchanged.
- **Piper (espeak-ng) does not honor U+0301, and the mark makes stress worse.** A word containing
  the mark misses espeak-ng's dictionary and falls back to letter rules:
  «перейти́» → `pʲirʲˈejtʲi`, but unmarked «перейти» → `pʲirʲijtʲˈɪ`.
  «документа́ции» and «могу́» go wrong the same way. So Piper has two variants, each in its own output folder:
  - `ru-irinia-medium`: text as-is.
  - `ru-irinia-medium~no-stress-marks`: U+0301 removed. Every record logs how many marks were removed.
    Without the marks espeak-ng uses its dictionary, but it cannot tell homographs apart (за́мок/замо́к).
  The phonemes espeak-ng produced are stored for every Piper synthesis.
- «+» is not a usable stress marker for Piper: espeak-ng reads it aloud as «плюс».
- ё is handled correctly by both engines.
- Numbers, dates, and times are expanded by the engines themselves. No preprocessing is applied.
- Slow learner speech (rate 0.8): RHVoice `-r 80`; Piper `--length_scale 1.25`.
