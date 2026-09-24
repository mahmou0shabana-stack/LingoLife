# Russian TTS Benchmark Lab (Phase 1)

An isolated benchmark that runs outside the LingoLife app. Nothing here is imported by the app,
and it doesn't touch the Voice Center, providers, storage, or the audio pipeline.

```
setup.sh            installs RHVoice (apt) and Piper (GitHub release) into this folder
setup_neural.sh     one venv per neural engine in envs/ + weights via fetch_models.py
fetch_models.py     weights from modelscope.cn, each file SHA-256-checked against the official HF revision
corpus.json         32 Russian sentences in LingoLife style (U+0301 stress marks kept)
engines.json        all 6 target engines: exact model, license, CPU/GPU, measured U+0301 behaviour
engines/*.py        adapters; neural engines use engines/_neural.py + <engine>_worker.py (persistent model)
run.py              synthesizes to output/<engine>/<voice>/<id>.wav and writes results/
build_page.py       builds page/index.html, the listening page
results/results.json      one record per synthesis (input, engine input, engine frontend/tokens, seed, timings, …)
results/summary.json      per engine/voice: model load, first call, warm median, RTF, peak RAM, stress experiment
results/environment.json  the machine it ran on
```

Reproduce: `bash setup.sh && bash setup_neural.sh && python3 run.py && python3 run.py xtts chatterbox qwen3 cosyvoice
&& .venv/bin/python build_page.py`. To open the page locally, serve the repo (`python3 -m http.server`) and open
`scripts/tts-benchmark/page/index.html`.

## Results of this run (2026-09-24)

Machine: Ubuntu 24.04, Intel Xeon 2.1 GHz × 4 cores, 15.7 GB RAM, **no GPU**, Python 3.11 (3.10 for CosyVoice).
All 832 syntheses succeeded. No substitute models were used. Quality is not ranked here — that is for the listener.

| Engine | Exact model | Voice(s) | OK | Load | RAM after load / peak | Warm median / sentence | RTF (median) |
|---|---|---|---|---|---|---|---|
| RHVoice 1.8.0 | Ubuntu package | 14 Russian voices | 448/448 | per call | — / 36–42 MB | 0.18–0.35 s | 0.06–0.11 |
| Piper 2023.11.14-2 | ru-irinia-medium | 1 × 2 variants | 64/64 | per call | — / 348–352 MB | 0.46–0.47 s | 0.14 |
| XTTS v2 | coqui/XTTS-v2 **v2.0.1** (not v2.0.3) | cloned from `samples/en_sample.wav` | 64/64 | 28.7 s | 3.6 GB / 7.0 GB | 6.3–6.7 s | 2.2–2.4 |
| Chatterbox Multilingual V3 | `t3_mtl23ls_v3` | built-in `conds.pt` | 64/64 | 22.0 s | 4.8 GB / 7.0 GB | 16.9–17.1 s | 6.2–6.5 |
| Qwen3-TTS | 12Hz-1.7B-CustomVoice, fp32 | serena, ryan (built-in) | 128/128 | 7–10 s | 8.3 GB / **13.5 GB** | 19.5–30.3 s | 6.4–7.1 |
| CosyVoice 3 | Fun-CosyVoice3-0.5B-2512 | zero-shot `asset/zero_shot_prompt.wav` | 64/64 | 27.0 s | 7.1 GB / 8.4 GB | 18.0–20.6 s | 6.6–7.2 |

RTF = synthesis wall time ÷ audio duration (1.0 = real time; CPU only). Exact revisions, packages and licenses per engine
are in `engines.json`; per-sentence numbers in `results/`. RHVoice/Piper figures are from the phase-1 run (commit 4a4b32e).

Licenses (model weights): XTTS v2 — **Coqui Public Model License, non-commercial for the model and its outputs**;
Chatterbox — MIT (outputs carry Resemble's Perth watermark by default); Qwen3-TTS — Apache-2.0; CosyVoice 3 — Apache-2.0.

Rate 0.8 (items 29–30): XTTS `speed=0.8`; CosyVoice `speed=0.8`; Qwen3 1.7B has no speed parameter, so it got a
natural-language instruction (recorded); **Chatterbox has no rate control** — synthesized at normal rate, recorded as such.

### How this environment got the weights

- `huggingface.co` answers the API and small files, but its large-file CDNs (`us.aws.cdn.hf.co`, `cas-server.xethub.hf.co`)
  are refused (CONNECT 403). `modelscope.cn` works, so `fetch_models.py` downloads from there and verifies **every LFS file's
  SHA-256 against the official Hugging Face repo at a pinned revision** — all matched.
- The ModelScope XTTS mirror (`AI-ModelScope/XTTS-v2`) holds the **v2.0.0/v2.0.1** files (weights, config, vocab identical to
  those HF tags) and no `speakers_xtts.pth`, so XTTS ran as v2.0.1 with a reference clip from the model repo.
- `download.pytorch.org` redirects wheels to `download-r2.pytorch.org` (refused), so torch came from PyPI.
- `www.modelscope.cn` is refused (only `modelscope.cn` works): CosyVoice's optional `wetext` normalizer could not download.
  It does not matter for the official CosyVoice3 usage, which skips the text frontend (see below).

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

### Neural engines and U+0301 (measured)

Each neural engine ran the corpus twice with the **same seed per sentence**: as-is and with U+0301 removed
(`~no-stress-marks`). Control: sentences without marks (#25, #28) came out **byte-identical** across the two runs for every
engine and voice, so the engines are deterministic here and every difference in a marked pair is caused by the marks.

| Engine | What its frontend does with U+0301 | Marked pairs with different audio |
|---|---|---|
| XTTS v2 | No U+0301 in the vocab → each mark becomes **`[UNK]`** and breaks the BPE split (`за·[UNK]·мо·к` vs `за·мо·к`). Marks also count toward XTTS's 182-char Russian limit and triggered sentence splitting on #22 (needs spaCy). | 30/30 |
| Chatterbox V3 | U+0301 is **its own vocab token** (the model is trained on stressed Russian). The package's automatic Russian stresser (`russian_text_stresser`) is not a declared dependency and is not published anywhere I could find, so it is skipped with a warning, recorded per synthesis. NFKD also splits й → и + U+0306. | 30/30 |
| Qwen3-TTS | No normalization; byte-level BPE keeps U+0301 as **its own token**. | 60/60 |
| CosyVoice 3 | The official prefix `You are a helpful assistant.<|endofprompt|>` makes CosyVoice skip its (English-only) text frontend; BPE keeps U+0301 as **its own token**. Digits are therefore sent unexpanded (#14–#17). | 30/30 |

"Different audio" proves the marks reach the model and change the output. It does **not** prove the stress moved to the
marked syllable — listen to #04/#05/#06/#07/#27 in both variants, and #27 against #28.
Every record keeps the original text, the exact engine input, the engine's own normalized text and its token sequence.
