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

---

## Phase 1B (2026-09-25): MOSS-TTS-Nano, F5-TTS Russian, MOSS-TTS Local

Same corpus, same record format, same stress variants (as-is vs U+0301 removed, same seed) and the same
determinism control. Phase-1 results and audio are untouched. Setup: `setup_phase1b.sh`; run:
`python3 run.py moss-nano moss-nano-onnx` and `python3 moss_local_smoke.py`.

**Native-Russian reference voices.** Every Phase 1B voice-cloning engine uses clips from FLEURS (Google, **CC-BY-4.0**),
recorded by native Russian speakers, with FLEURS's own transcripts (`references/references.json`). The female and male
clip were picked **by measurement**: highest estimated SNR in the first 205 dev clips, 6–12 s long, no clipping.
Phase-1 neural engines used non-native references (English sample for XTTS, Mandarin prompt for CosyVoice, built-in voices
for Chatterbox/Qwen3).

| Engine | Exact model | OK | Cold load | RAM after load / peak | Warm median / sentence | RTF | First audio (streaming) |
|---|---|---|---|---|---|---|---|
| MOSS-TTS-Nano (PyTorch) | MOSS-TTS-Nano-100M @44502f8 + MOSS-Audio-Tokenizer-Nano @6aa02b0, fp32 | 192/192 | 4.9 s | 1.13–1.21 / 1.48 GB | 5.3–7.0 s | **1.35–1.43** | **0.62–0.82 s** |
| MOSS-TTS-Nano (ONNX Runtime CPU) | …-100M-ONNX @f52645c + …-Tokenizer-Nano-ONNX @ceff0d0, fp32 | 128/128 | 7.1 s | 1.73 / 3.0–3.3 GB | 7.7–9.0 s | **1.91–2.00** | 0.90–1.09 s |
| F5-TTS Russian | — | blocked | | | | | |
| MOSS-TTS Local (1.7B backbone) | MOSS-TTS-Local-Transformer @12aa734 (3.06B params, bf16) + MOSS-Audio-Tokenizer @3cd226b (1.77B, fp32) | smoke test (#04 ×2) | 11.9 s | ~1 GB (lazy mmap) / **12.1 GB** | 34–49 s | **13.9–17.0** | — |

Cold load = page cache dropped (`echo 3 > /proc/sys/vm/drop_caches`) before starting the worker. Licenses: MOSS-TTS-Nano,
its codec, the ONNX exports, MOSS-TTS Local and MOSS-Audio-Tokenizer are all **Apache-2.0**; reference clips CC-BY-4.0.
MOSS-TTS-Nano voices: `ru_female_fleurs`, `ru_male_fleurs`, plus `ru_female_fleurs+no-wetext` (see below).

### MOSS-TTS-Nano — CPU / on-device viability (`results/moss_nano_viability.json`)

- **Size:** 235 MB TTS + 88 MB codec (PyTorch, fp32); ONNX exports 672 MB + 91 MB (fp32 external data).
- **Not real-time on this CPU.** Median RTF is 1.35–1.43 (PyTorch) and 1.91–2.00 (ONNX Runtime), so generation is slower
  than playback. First audio arrives in about 0.6–1.1 s thanks to streaming, but playback would stall without buffering.
  The README's "realtime on a 4-core CPU" did not hold on this 2.1 GHz Xeon.
- **ONNX is slower here than PyTorch** and uses more memory as it runs (1.7 → 3.3 GB). The repo's Python ONNX runtime also
  imports torch + torchaudio (for reference-audio loading). The bare ONNX sessions (`ort_cpu_runtime`) load torch-free in
  4.7 s cold at **1.26 GB RSS**.
- **Browser:** official. `OpenMOSS/MOSS-TTS-Nano-Reader` runs the whole ONNX stack in a browser extension on
  onnxruntime-web (WASM, SIMD, multi-threaded), with no server. Its runtime notes that WeTextProcessing is unavailable
  in-browser (robust normalization only). This path was not executed here.
- **Android:** no official build. The credible route is the same ONNX graphs on ONNX Runtime Mobile plus SentencePiece.
  About 0.76 GB of fp32 assets and ~1.3 GB RSS is heavy for a phone, so quantization would be needed. Unofficial
  INT8/MNN/NPU ports exist on modelscope.cn; they were not tested here.
- **Output is 48 kHz stereo.**

### U+0301 findings (Phase 1B, measured)

- **MOSS-TTS-Nano (both paths).** U+0301 survives the repo's text pipeline. It is not in the SentencePiece vocab;
  byte fallback passes each mark as `<0xCC><0x81>` (no `<unk>`, nothing dropped). **Marked vs unmarked: 90/90 (PyTorch) and
  60/60 (ONNX) pairs give different audio**; unmarked controls (#25, #28) are byte-identical, so the marks alone change
  the output. Whether stress lands on the right syllable is for the listener.
- **MOSS-TTS-Nano text normalization problem.** With WeTextProcessing ON (the repo default), pure-Cyrillic text is routed to
  WeText's **Chinese** grammar: «3 бра́та» → «三 бра́та», «1250 рубле́й» → «一千二百五十 рубле́й»,
  «01.09.2026 в 14:30» → «二零二六年九月一日 в 十四点三十分» (items #14–#17). The `+no-wetext` voice config switches it off
  with the repo's own flag, so the same model can be heard without that step.
- **MOSS-TTS Local.** Qwen3 BPE keeps U+0301 as its own token; #04 with vs without marks gave different audio (smoke test only).
- **F5-TTS Russian.** Not measurable (no weights). Static facts: both Russian vocabs contain U+0301 (index 1574, inherited from
  the base vocab) and `+`. ESpeech's own pipeline writes stress as `+` before the vowel; `engines/f5_espeech.py` is ready with
  a third variant that converts the corpus marks to that notation.

### Blockers (exact)

- **F5-TTS Russian: blocked by the network.** The only Russian checkpoint listed in F5-TTS `SHARED.md`,
  `hotstone228/F5-TTS-Russian` (CC-BY-NC-SA-4.0 per its card; SHARED.md says cc-by-nc-4.0; Common Voice 17 + Golos + SOVA +
  RESD), has its weights only on huggingface.co's large-file CDNs (`us.aws.cdn.hf.co`, `cas-server.xethub.hf.co`: CONNECT 403).
  The alternative Russian F5 checkpoint `ESpeech/ESpeech-TTS-1_RL-V2` (Apache-2.0) exists byte-identical on modelscope.cn,
  but every GET redirects to `cdn-lfs-cn-1.modelscope.cn` (403) and its Git-LFS API refuses ("mirror→mirror loop detected").
  ESpeech's auto-stress models (`ruaccent/accentuator`) are Hugging Face-only too. No non-Russian substitute was used.
- **MOSS-TTS Local: resources.** The official CPU dtype (fp32) needs ~19.4 GB for weights alone, more than the 15.7 GB of RAM
  (no swap), so it was not attempted. In the weights' stored dtypes (bf16 model, fp32 codec) it loads and speaks
  (`results/moss_local_smoke.json`, clips in `output/moss-local-smoke/`), but at RTF 13.9–17 and 12.1 GB RSS the full corpus
  (>1 h) was stopped after the smoke test. It needs `transformers==5.0.0` + `torch==2.9.1` (its own venv), and torchaudio 2.9
  needs TorchCodec + FFmpeg to read files, so the reference was read with soundfile and encoded by the processor's own
  `encode_audios_from_wav`.
- **Environment notes.** To fit MOSS-TTS Local on disk, the Phase-1 venvs (`envs/xtts|chatterbox|qwen3|cosyvoice`) and the uv
  cache were deleted after all their results were final. `setup_neural.sh` rebuilds them. FLEURS came from
  `storage.googleapis.com`; ModelScope *dataset* downloads (via `cdn-lfs-cn-1.modelscope.cn`) are refused. For small files
  where ModelScope's copy differs from the pinned HF revision (`.gitattributes`, ONNX meta JSON), `fetch_models.py` now uses
  the official HF copy.
