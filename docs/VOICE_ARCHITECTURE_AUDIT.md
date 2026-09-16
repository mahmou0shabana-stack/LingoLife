# Voice Center V0 — Audio Architecture & Provider Readiness Audit

**Baseline:** `13fadc4` · clean working tree · identical to `origin/main`
**Date:** 2026‑09‑16
**Scope:** AUDIT ONLY. No provider was installed, added, modified or removed. The only
repository change is this document.

**Status vocabulary used throughout**

| Tag | Meaning |
|---|---|
| **EXISTS** | Code is present in the repository |
| **VERIFIED** | Observed executing in a real browser during this audit |
| **PARTIAL** | Real implementation, but blocked by a missing prerequisite |
| **PLACEHOLDER** | Contract-shaped stub that deliberately returns "unavailable" |
| **NOT IMPLEMENTED** | Named somewhere but no implementation |
| **UNKNOWN** | Could not be checked in this environment |

> ⚠️ **Audibility disclaimer.** This audit ran in a headless Chromium container with
> **zero** system speech voices installed (`speechSynthesis.getVoices()` → `0`) and no
> audio output device. **No claim in this document about how any voice *sounds* is
> based on listening.** Nothing here ranks voice quality.

---

## 1 · Executive summary

LingoLife already contains a **complete TTS provider abstraction** (contract, registry,
five adapters, a shared generated-audio cache, an A/B/C comparison lab and an honest
availability model). That architecture is genuinely good and should be kept. What it does
**not** contain is a single working Russian synthesis engine beyond the device's own
speech synthesiser, and — more importantly — **the synthesis path does not flow through
the global audio-service.**

Five findings drive the V1 plan:

1. **`audio-service.js` is not the playback authority for Shadowing.** It is authority for
   the Memory/Workspace media player only. Shadowing, the TTS speaker adapter, Voice Lab
   and recording playback each construct their **own** `new Audio()` element. There are
   today **five independent playback paths**, arbitrated loosely by `audio-bus.js`
   — and the TTS adapter does not even join that bus. (§5)
2. **Exactly one provider can produce sound today: `browser`.** `rhvoice` and `cloud-ai`
   are deliberate placeholders. `xtts-bridge` is a real HTTP client, but its reference
   server raises `NotImplementedError`. `piper` is unregistered and its vendored runtime
   does not exist on disk. (§4)
3. **`isAvailable()` conflates "provider loads" with "provider can speak Russian."** The
   browser provider reported `available: true` in an environment with **zero** voices,
   and its very next `synthesize()` returned `synthesis-failed`. (§4, §13)
4. **The generated-audio cache key destroys Russian stress and ё.** Verified: `за́мок`
   and `замо́к` hash to the *same* key; so do `все` and `всё`. No provider populates the
   cache today, so this is latent — but it would silently serve the wrong pronunciation
   the moment a real generative provider is switched on. (§6, §8)
5. **One `voiceId` setting is shared by all providers.** It stores a browser
   `SpeechSynthesisVoice.name`, and is handed unchanged to every other provider as its
   `voiceId`. (§9)

**Recommended V1 scope** is in §13: unify playback ownership *first*, fix the cache key,
split per-provider voice settings, and only then add one genuinely-licensed offline
Russian engine.

---

## 2 · Current audio architecture

```
                        ┌──────────────────────────────────────┐
                        │  audio-bus.js — single-owner lock    │
                        │  claim(id, silence) / release(id)    │
                        └──────────────────────────────────────┘
       claims ▲            claims ▲          claims ▲        ✗ never claims
              │                   │                 │                 │
 ┌────────────┴───┐  ┌────────────┴────┐  ┌─────────┴──────┐  ┌───────┴─────────┐
 │ shadow-view    │  │ voice-attempts  │  │ voice-lab      │  │ speaker-adapter │
 │ 'session'      │  │ modal   'BUS'   │  │ 'voice-lab'    │  │  (TTS output)   │
 │ 'voice:<id>'   │  │                 │  │                │  │                 │
 │ new Audio()    │  │ audio-service   │  │ new Audio()    │  │ new Audio()     │
 │ (recordings)   │  │   .load()       │  │ URL not revoked│  │ URL revoked ✓   │
 └────────────────┘  └────────┬────────┘  └────────────────┘  └────────┬────────┘
                              │                                        │
                     ┌────────▼─────────────┐              ┌───────────▼─────────┐
                     │  audio-service.js    │              │ synthesizeWithCache │
                     │  ONE <audio> on body │              │  (generatedAudio)   │
                     │  queue · MediaSession│              └───────────┬─────────┘
                     │  rate/reps/loop/A-B  │                          │
                     └──────────────────────┘              ┌───────────▼─────────┐
                                                           │  registry.js        │
 ┌───────────────────────────────────────────┐             │  4 registered       │
 │ playback-controller.js (state machine)    │             │  +1 flag-gated      │
 │  cycle() · repeat · advance · phrase      │             └───────────┬─────────┘
 │  injects: speaker() · canceler()          │                         │
 │  own new Audio() for humanAudioUrl ──────────────┐    ┌─────────────┴───────────┐
 └───────────────────────────────────────────┘      │    │ browser · rhvoice ·     │
                                                    │    │ xtts-bridge · cloud-ai  │
                                                    │    │ [piper — not registered]│
                                              5th path    └─────────────────────────┘
```

**The load-bearing observation:** `js/views/shadow-view.js` **does not import
`audio-service.js` at all.** VERIFIED by import graph — the only importers are
`app.js`, `components/audio-player.js`, `components/mini-player.js`,
`modals/voice-attempts.js`, `views/my-language-view.js`, `views/workspace-view.js`.

---

## 3 · Current Voice UI inventory

All voice controls live in the Shadowing **Tool Center drawer** (`settingsDrawer()` in
`js/views/shadow-view.js`), plus one modal.

| # | UI control | Location | Writes | Status |
|---|---|---|---|---|
| 1 | **مصدر النطق** — آلي / تسجيلي / ناطق أصلي | drawer §الصوت, `ccRow key:'audio'` | `session.audioSource` | **VERIFIED** — real effect on the engine |
| 2 | **صوت الجهاز** `<select>` | drawer §الصوت, `data-sh="voice-select"` | `session.voiceId` | **VERIFIED** — lists `speechSynthesis` Russian voices |
| 3 | **محرّك النطق الآليّ** chips | drawer §متقدّمة, `data-sh="tts-provider"` | `settings['shadow.ttsProvider']` | **VERIFIED** — chips render live `isAvailable()` text; disabled chips carry the honest reason |
| 4 | **جيب النبر من ويكاموس** toggle | drawer §متقدّمة, `data-sh="net-stress"` | stress network consent | **EXISTS** (stress lookup, not TTS) |
| 5 | **مختبر الأصوات A/B/C** | drawer §متقدّمة → `modals/voice-lab.js` | — | **VERIFIED** opens; synthesis blocked by provider availability |
| 6 | **Native-speaker audio consent** | separate flow, `native-audio.js` | `settings['shadow.nativeAudio']` | **EXISTS** — word-level only, off by default |
| 7 | 🎙 record button | stage transport, `data-v="myvoice"` | recording pipeline | **VERIFIED** |

**There is no "Voice Center" today.** There is no voice *browser*, no per-voice preview
outside the A/B/C lab, no download/progress UI, no ⓘ metadata surface.

### UI options that cannot currently produce sound

| Option shown to the user | Reality |
|---|---|
| `RHVoice — دون اتصال` | **PLACEHOLDER**. `isAvailable()` hard-returns false on web. Chip renders **disabled** with the true reason. Honest, not broken. |
| `صوتٌ سحابيّ (مستقبليّ)` | **PLACEHOLDER**. No service behind it; label itself says "future". |
| `XTTS — جسر تطويرٍ محلّي` | **PARTIAL**. Client is real; reference server's `synthesize_audio()` raises `NotImplementedError` → HTTP 501. |
| `Piper — عصبيّ محلّي (تجريبي)` | **NOT REACHABLE from the UI** — never registered by `bootstrap.js`. |

> No option in the UI is *dishonest*: each disabled chip states why. The gap is that
> **"available" does not imply "will make sound"** — see §4 finding 3.

---

## 4 · Provider readiness table

Registry contents VERIFIED at runtime: `browser · rhvoice · xtts-bridge · cloud-ai`.

| Provider | Adapter | Real? | Russian? | Net? | Ext. app? | Reusable audio? | Voice select | Rate | Cancel | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| **browser** | `tts/browser-provider.js` → `tts-controller.js` | **Yes** | device-dependent | No | No | **No** — speaks directly, no bytes | Yes (`voice.name`) | Yes 0.3–2.0 | Yes (`speechSynthesis.cancel()`) | **VERIFIED functional** where voices exist |
| **rhvoice** | `tts/rhvoice-provider.js` | Contract only | n/a | No | Android host | No | `getVoices()` → `[]` | n/a | no-op | **PLACEHOLDER** |
| **xtts-bridge** | `tts/xtts-bridge-provider.js` | **Yes (client)** | delegated | localhost | **Yes** — `scripts/tts-bridge/server.py` | **Yes** — returns a Blob | Yes via `/voices` | Yes (`speed`) | **Yes** — `AbortController` | **PARTIAL** — server stub raises `NotImplementedError` |
| **cloud-ai** | `tts/cloud-provider.js` | Contract only | n/a | Yes | No | No | `[]` | n/a | no-op | **PLACEHOLDER** |
| **piper** | `tts/piper-provider.js` | **Partly** — full ONNX inference written | Would be | No | No | **Yes** — builds a WAV Blob | single id | via `lengthScale` | **No** — comment admits it | **NOT IMPLEMENTED (unreachable)** |

### Runtime evidence (VERIFIED, this container)

```
registered: browser · rhvoice · xtts-bridge · cloud-ai

✓ browser      [ready_offline]
    "لا صوت روسي مخصَّص مثبَّت — سيُستعمل الصوت الافتراضي"
✗ rhvoice      [unavailable_in_web]
✗ xtts-bridge  [requires_local_bridge]   http://localhost:8765
✗ cloud-ai     [requires_network]        "عقدٌ معماريّ فقط"

synthesize("Проверка.") →
  browser      error=synthesis-failed   playedDirectly=true
  rhvoice      error=unavailable-in-web
  xtts-bridge  error=bridge-unreachable
  cloud-ai     error=not-configured
```

**Finding — availability ≠ capability.** `browser.isAvailable()` returned
`available: true` with **zero** Russian voices and **zero** voices overall, then
`synthesize()` failed. Any V1 status UI that trusts `available` alone will show a green
light on a mute device.

**Finding — Piper's prerequisites are absent on disk.** `vendor/` contains only `pdfjs`.
`vendor/onnxruntime-web/` and `vendor/piper-voices/` **do not exist**. `isAvailable()`
would return `MODEL_NOT_DOWNLOADED` at its first check. Its own header also records that
no Russian phonemizer is wired — the model cannot be driven without one.

### Error reporting

Every adapter returns `{ error: <string> }` in a `TTSResult`; `speaker-adapter.js`
converts to the engine's `{ok, reason}`. Failure of one utterance never throws into
`cycle()`. This is sound and should be preserved.

---

## 5 · Global audio-service map

`js/services/audio-service.js` — 419 lines. **EXISTS / VERIFIED.**

**Responsibilities:** one `<audio>` element appended to `document.body` once, outliving
view re-renders; a queue (a single track is "a queue of one"); Media Session lock-screen
controls; repetition/loop/A↔B range; rate.

| Concern | Behaviour |
|---|---|
| **Public API** | `subscribe(listener)`, `api.state` (getter), `load(track)`, `loadQueue(tracks, i)`, `play()`, `pause()`, `toggle()`, `stop()`, `next()`, `previous()`, `seek(s)`, `seekRatio(r)`, `setRate`, `setReps`, `setLoop`, `setRange(a,b)`, `clear()`, `hasLockScreenControls()` |
| **Ownership** | Sole owner of its element. Identity is the **pair** `(mediaId, url)` — a deliberate fix so a re-recorded preview under a stable id is not treated as the same track |
| **Play/Pause/Resume** | `play()` returns `{ok, reason}`; a rejected `play()` is reported, not swallowed. `previous()` restarts the current track if >3 s elapsed |
| **Progress / seeking** | `requestAnimationFrame` loop emits state; A↔B checked per frame (not on `timeupdate`, deliberately) |
| **Repeat cycle** | `options.reps`/`played` — repetition resolves **before** queue advance |
| **Blob / URL lifecycle** | **Does not own object URLs.** Declares use via `pinMedia()`, releases via `unpinMedia()`; `media-service.js` owns creation and revocation |
| **Cancellation** | `clear()` unpins, drops `src`, calls `load()`, clears Media Session metadata |
| **Errors** | `error` event → `emit({error:true})`; blocked autoplay → `emit({blocked:true})` + `{ok:false, reason}` |
| **Shadowing** | **None.** Not imported by `shadow-view.js` |

### Where synthesized audio *should* enter — and where it enters today

Today, `speaker-adapter.js:playBlob()` does:

```js
if (!audioEl) { audioEl = new Audio(); audioEl.setAttribute('playsinline',''); }
if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
currentObjectUrl = URL.createObjectURL(blob);
```

This bypasses `audio-service.js` entirely: no Media Session entry, no lock-screen
control, no queue, no `pinMedia` accounting, and **no `claimAudio()`** — so a synthesized
utterance neither silences nor is silenced by the bus.

**The correct future entry point** is `audio-service.api.load({mediaId, url, title})`,
with the object URL owned by `media-service.js` exactly as recordings are. That requires
`media-service` to be able to vend a URL for a `generatedAudio` blob (it currently keys
on the `media` store). This is a V1 design item, not something to bolt on.

> ⚠️ A complication that must be designed around, not ignored: `playback-controller`'s
> `speaker()` contract is **"resolve when the utterance finishes."** `audio-service` is
> event/subscription-shaped, not promise-shaped. A V1 bridge must await the service's
> `ended`, and must not fight the service's own `reps`/`loop` (the engine already owns
> repetition). Using both repetition mechanisms at once is the obvious way to break
> Shadowing.

---

## 6 · Russian pronunciation pipeline

| Capability | Where | Status |
|---|---|---|
| Stress marks (U+0301) | `services/shadow/stress.js` → `markSentence()`; `.sh-stress` spans | **VERIFIED** (7 spans rendered on the test sentence, gold `rgb(255,196,78)`) |
| Lexical stress resolution | `pronunciation/stress-resolver.js` + `stress/{lexicon-store,providers,resolver}.js` | **EXISTS** — layered: reviewed → context → offline lexicon → prediction, each with an origin + maturity |
| Homographs | `stress/providers.js` `contextProvider` — remembers `(prev, bare, next) → ordinal` | **EXISTS** — context-sensitive, learner-curated |
| Text normalization | `utils/normalization.js` `normalizeRussian()` | **EXISTS** — lowercases, **strips U+0301**, maps **ё→е** |
| Numbers / abbreviations | — | **NOT IMPLEMENTED** — no Russian number-to-words or abbreviation expander anywhere |
| Punctuation / pauses | — | **NOT IMPLEMENTED** — text passes verbatim to the provider |
| Connected speech | `pronunciation/sound-map.js` has a `'بطيء متصل'` label; `curriculum.test.js` guards it | **EXISTS** as teaching content, **not** a synthesis feature |
| Phonetic representation | `pronunciation/alphabet.js`, `syllabifier.js`, `arabic-ear.js` | **EXISTS** — pedagogical (Arabic-ear transliteration), **not** IPA/phoneme-id for a TTS model |

### Shared vs provider-specific

**Shared:** stress resolution, marking, the Arabic-ear layer. All operate on display text.
**Provider-specific:** *nothing yet* — every provider receives the same raw string.

### Can a future engine receive normalized text without losing stress? — **Yes for the text, no for the cache key**

- `playback-controller.currentText()` → `resolveTarget()` → `speaker(text)` →
  `provider.synthesize({text})`. **The raw string, stress marks intact, reaches the
  provider.** `normalizeRussian()` is *not* applied on this path. ✓
- **But** `audio-cache.js:normalizeForCache()` applies `normalizeRussian()` to build the
  hash. **VERIFIED collision:**

  ```
  за́мок → "замок" ┐ same cacheKey
  замо́к → "замок" ┘
  все   → "все"   ┐ same cacheKey
  всё   → "все"   ┘
  ```

  Two genuinely different pronunciations collapse into one cached file. Harmless today
  (`generatedAudio` count = 0, no generative provider runs); **a correctness bug the
  instant one does.**

The user's requirement — *"the visible learning text must remain independent from any
provider-specific synthesis representation"* — is **currently satisfied by accident**
(no provider does any conversion). It is not architecturally enforced: there is no
`SynthesisRequest` type separating *display text* from *engine input*. That is a V1 gap.

---

## 7 · Recording pipeline

```
🎙 tool 'myvoice' → openMyVoice() → modals/voice-attempts.js
        │
   MediaRecorder → Blob (audio/webm) → in-memory preview only
        │           (URL.createObjectURL, nothing written yet)
        │
   "save" → services/shadow/voice-attempts.js :: saveAttempt()
        ├── media.create({kind:'audio', blob, mime, durationMs, caption})
        ├── sceneMediaLinks.create({roles:[AUDIO_ROLE.MY_VOICE]})   ← only if sceneId
        └── practiceEvidence.create({
              targetType:'shadowVoice', targetId: target.key,
              scope, segmentId, rangeFrom/To, targetText,
              repetitions:0, meaning:'recorded',
              impliesRealUsage:false, impliesMastery:false })
```

| Question | Answer |
|---|---|
| Uses the global audio-service? | **Split.** `modals/voice-attempts.js` **does** (`audio-service.load()`). Shadowing's inline "أصوات" well does **not** — `shadow-view.js:7471` builds its own `new Audio(voice.url)` |
| Bound to the active target? | **Yes** — a frozen target snapshot at record-start; `targetKey(scope, segmentId, from, to)` |
| Session persistence | `practiceEvidence` row per attempt, `sessionId` + `sceneId` |
| Comparison playback | Attempts list per target (`listAttempts(key)`, one indexed query) |
| Cleanup | **Cancel writes nothing** — preview lives only in memory + object URL |
| Bus | Claims `voice:<mediaId>`; releases on `ended`/`error` |

**Not modified.** This pipeline is sound and V1 should not touch it.

---

## 8 · Cache and storage

| Store | Key | Indexes | Purpose | Backup | Count now |
|---|---|---|---|---|---|
| `generatedAudio` | `cacheKey` (SHA-256 hex) | `lastUsedAt`, `providerId` | TTS output cache | **excluded** | **0** |
| `nativeAudio` | `word` | `fetchedAt` | Wikimedia native-speaker clips | **excluded** | **0** |
| `media` | id | — | user recordings + all media | included | — |
| `practiceEvidence` | id | target indexes | attempt records | included | — |

**Storage quota** (VERIFIED, this container): `usage 2,146,126 B` of
`quota 1,040,150,456 B` (~1.04 GB). Real device quotas will differ and **must be
re-measured on the S24 Ultra and Tab S10+**.

| Concern | Finding |
|---|---|
| Is synthesized speech cached? | **Machinery EXISTS and is correct in shape** (`synthesizeWithCache` is the single ask→generate→store funnel). **Zero rows** because no generative provider runs |
| Cache key composition | `sha256(normalizedText + language + providerId + model + voiceId + settingsKey)`; `settingsKey` is an explicit string (`speed=0.8`) — deliberately not a serialized object |
| **Key defect** | Stress + ё destroyed before hashing (§6). **Must be fixed before any generative provider ships** |
| Model/version in key | `model` field exists but `synthesizeWithCache` passes `result.metadata?.model` — **no adapter sets `metadata`**, so it is always `null`. A model upgrade would silently reuse stale audio |
| Object URL cleanup | `speaker-adapter` revokes ✓ · `voice-lab` **does not** — `URL.createObjectURL(blob)` at line 123 is never revoked (**leak**, dev-tool scope) |
| Invalidation | `clearGeneratedCache()` exists (wipe-all). **No** LRU, no quota-pressure eviction, no per-provider/per-model invalidation |
| Offline availability | Cached blobs live in IndexedDB → offline-capable by construction, once populated |

---

## 9 · Voice settings and persistence map

| Setting | Authority | Persistence | Default | UI | Real effect | If provider unavailable |
|---|---|---|---|---|---|---|
| `session.voiceId` | per-session | `saveSessionSettings` → `shadowSessions` | `null` | "صوت الجهاز" `<select>` | → `speaker(text,{voiceName})` → provider `voiceId` | silently meaningless |
| `settings['shadow.ttsProvider']` | **global** | `settings` store | `'browser'` | provider chips | `ttsSpeaker.setProviderId()` — live, no engine rebuild | falls back per `fallbackOrder` |
| `session.audioSource` | per-session | `shadowSessions` | `'mine'` (normalized) | "مصدر النطق" segmented | chooses recording / native / TTS | announced fallback to TTS |
| `session.speed` | per-session | `shadowSessions` | `0.8` | speed slider | `rate` → provider `speed` | — |
| `settings['shadow.nativeAudio']` | global | `settings` store | `{enabled:false}` | consent flow | gates all outbound word lookups | — |
| `session.volume` / `ctx.volume` | per-session | `shadowSessions` | `1` | volume slider | applied at **playback**, excluded from cache key (correct) | — |

### Duplicate / disconnected controls (documented, **not** consolidated in V0)

1. **`voiceId` is provider-blind.** It holds a browser `SpeechSynthesisVoice.name` and is
   passed verbatim to XTTS/Piper/cloud as *their* `voiceId`. Switching providers carries a
   meaningless voice id across. **Needs `voiceByProvider: {providerId → voiceId}` in V1.**
2. **Scope mismatch.** Provider is **global**; voice is **per-session**. Changing provider
   globally leaves every session pointing at a stale voice.
3. **Two overlapping "what do I hear" settings.** `audioSource` (tts/mine/native) and
   `ttsProvider` (which TTS) are separate axes presented in different drawer sections,
   with no cross-validation.
4. **`repeatMode: 'continuous'` vs the removed `practiceMode: 'continuous'`** — resolved
   in the previous pass; noted so V1 does not reintroduce the confusion.

---

## 10 · External provider feasibility and licensing

> ⚠️ **Weights ≠ code.** Several candidates below ship permissive *code* and
> non-commercial *weights*. Licence claims are from the cited sources on 2026‑09‑16 and
> should be re-verified before any adoption decision. **No model was downloaded,
> installed or listened to.**

| Candidate | Version / repo | Russian | Weights licence | Offline | Runtime | Browser? | Via bridge? | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Browser / device TTS** | platform | device-dependent | n/a | Yes | none | **native** | n/a | **Already integrated.** Zero cost. Quality/voice availability varies per device — Samsung devices ship Russian voices; **UNKNOWN until device-tested** |
| **RHVoice** | `Olga-Yakovleva/RHVoice` | **Yes** (original target language) | **GPL‑3.0‑or‑later** (LGPL‑2.1 lib + GPL‑3 MAGE ⇒ GPL‑3) | Yes | native C++ | **No** | Yes (as a bridge engine) | **Android‑only or bridge.** GPL‑3 is a real consideration for app distribution. Contract already in place |
| **Piper** | `rhasspy/piper` archived MIT (Oct 2025) → `OHF-Voice/piper1-gpl` **GPL‑3.0** | **Yes** — `ru_RU-{irina,dmitri,ruslan,denis}-medium` on HF, MIT‑tagged | code split MIT/GPL‑3; voices MIT | Yes | ONNX (VITS) | **Plausible** — adapter written, ORT‑Web proven | Yes | **Strongest offline candidate.** Blockers: vendor the runtime + a voice, and **write a Russian phonemizer** (espeak‑ng‑class problem) |
| **Silero** | `snakers4/silero-models` v3/v4/v5 (`v5_5_ru`) | **Yes**, flagship | **CC‑BY‑NC** repo‑wide; **only `base` cis‑tts models are MIT** | Yes | **PyTorch 2.0+** | **No** | Yes | **Bridge‑only.** v4/v5 advertise *automated stress and homographs* — very attractive for this app. NC licence must be checked against intended use |
| **XTTS‑v2** | `coqui/XTTS-v2` | Yes (17 langs) | **CPML — non‑commercial**; Coqui Inc. shut down Jan 2024 so **no commercial licence can be bought** | Yes | PyTorch, heavy | **No** | Yes — the existing bridge targets it | Client already written. Licence is a dead end for anything commercial; heavyweight for a phone workflow |
| **F5‑TTS (Russian)** | `Misha24-10/F5-TTS_RUSSIAN`, `agiws/…`, `hotstone228/…` | **Yes** — trained ~5,000 h RU+EN, **explicit stress‑mark support** | **CC‑BY‑NC(‑SA) 4.0** (Emilia training data) | Yes | PyTorch, diffusion/flow‑matching | **No** | Yes | Stress support aligns unusually well with LingoLife. NC licence; heaviest compute of the set |
| **VITS2 / Dialogs‑RU** | `shigabeev/vits2-emotional`; Dialogs corpus (~21 h, 3 speakers) | Yes | **Dialogs corpus: OpenRAIL** (commercial permitted). **Trained‑checkpoint licence UNKNOWN** | Yes | PyTorch | No | Yes | Interesting for expressive conversational RU. **Do not assume the checkpoint inherits the corpus licence** |
| **Kokoro‑82M** ⭐ *not on the original list* | `onnx-community/Kokoro-82M-v1.0-ONNX`, `kokoro-js` | **Not officially.** Community RU export `zaakirio/kokoro-ru` exists — **licence UNVERIFIED** | **Apache‑2.0** (base weights) | Yes | ONNX Runtime Web | **Yes — runs 100 % in‑browser via transformers.js**, fp32/fp16/q8/q4 | n/a | **Only candidate that is both permissively licensed and browser‑native.** Russian support is the open question — worth a spike |

**Download sizes:** not documented in the sources consulted, except Kokoro's 82 M
parameters and LingoLife's own note that ONNX Runtime Web vendors at ~13.5 MB. **All
other sizes: UNKNOWN — do not quote estimates.**

Sources: [silero-models](https://github.com/snakers4/silero-models) ·
[RHVoice](https://github.com/Olga-Yakovleva/RHVoice) ·
[RHVoice on F-Droid](https://f-droid.org/packages/com.github.olga_yakovleva.rhvoice.android/) ·
[piper-voices ru_RU](https://huggingface.co/rhasspy/piper-voices) ·
[coqui/XTTS-v2](https://huggingface.co/coqui/XTTS-v2) ·
[CPML discussion](https://github.com/coqui-ai/TTS/discussions/4304) ·
[F5-TTS_RUSSIAN](https://huggingface.co/Misha24-10/F5-TTS_RUSSIAN) ·
[F5-TTS](https://github.com/SWivid/F5-TTS) ·
[Dialogs corpus](https://arxiv.org/html/2607.14310) ·
[vits2_ru_natasha](https://huggingface.co/frappuccino/vits2_ru_natasha) ·
[Kokoro-82M ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) ·
[kokoro-js](https://www.npmjs.com/package/kokoro-js) ·
[kokoro-ru](https://huggingface.co/zaakirio/kokoro-ru)

---

## 11 · Device and deployment feasibility

Deployment: static PWA on GitHub Pages · IndexedDB · targets **Galaxy S24 Ultra**
(412×915) and **Galaxy Tab S10+** (1280×800) · optional local computer.

| Approach | Plausibility | Notes |
|---|---|---|
| **A · Browser‑native speech** | **Proven** | Already shipped. Quality is the device's, not ours. **Requires real‑device testing** — this container has zero voices |
| **B · Local bridge** | **Plausible; client already built** | Unlocks Silero/XTTS/F5/RHVoice at desktop quality. **Hard limit: the phone must reach the desktop.** `localhost:8765` is unreachable from a phone; LAN use needs a host/port setting the client does not have, plus HTTPS mixed‑content handling for a Pages‑served PWA. **Not solved today** |
| **C · Browser‑executed models** | **Plausible only for ONNX‑class models** | ORT‑Web verified working from local files (protobuf-parse error, not a WASM-load error — engine ran). Kokoro/`kokoro-js` is the most credible route. Piper needs a phonemizer. Unknown: on‑device latency for a 5‑second sentence on an S24 — **must be measured** |
| **D · Android adapter** | **Architecturally prepared, does not exist** | `AVAILABILITY.AVAILABLE_NATIVE_ANDROID` and the RHVoice contract are already in `types.js`. No wrapper, no build, no Play listing |

### Requires real-device testing (cannot be settled here)

1. Which Russian voices Samsung/Google TTS actually provides on each device.
2. Whether `speechSynthesis` rate 0.3–0.5 behaves (this is where the old keep‑alive bug bit).
3. IndexedDB quota and eviction behaviour under a real audio cache.
4. On-device ONNX inference latency and thermal behaviour.
5. Lock-screen / background-audio behaviour once TTS routes through `audio-service`.
6. Whether a phone can reach a desktop bridge on a home network at all.

---

## 12 · Architectural gaps

| # | Gap | Present? | Severity |
|---|---|---|---|
| 1 | **Unified playback ownership** — 5 independent `new Audio()` paths; TTS never claims the bus | ✗ | **Highest** |
| 2 | **Cache key preserving stress + ё** | ✗ (actively wrong) | **Highest** |
| 3 | **Provider contract** | ✅ `types.js` — good, keep | — |
| 4 | **Provider registry** | ✅ `registry.js` with ordered fallback | — |
| 5 | **Availability that implies capability** | ✗ — `available:true` with 0 voices | High |
| 6 | **Per-provider voice settings** | ✗ — one global `voiceId` | High |
| 7 | **Model/version in the cache key** | ✗ — `metadata.model` never set | High |
| 8 | **Display text vs synthesis input separation** | ✗ — no `SynthesisRequest` type | High |
| 9 | **Provider metadata + ⓘ explanations** | ✗ — only `name` + `reason` | Medium |
| 10 | **Voice discovery / browsing UI** | ✗ — `getVoices()` exists, no surface | Medium |
| 11 | **Synthesis jobs + progress** | ✗ — `synthesize()` is fire-and-await | Medium |
| 12 | **Cancellation** | ⚠️ partial — XTTS ✓, browser ✓, Piper ✗ | Medium |
| 13 | **Cache eviction / quota pressure** | ✗ — wipe-all only | Medium |
| 14 | **Voice comparison** | ⚠️ A/B/C lab exists; leaks object URLs; dev-only | Low |
| 15 | **Graceful fallback** | ✅ `resolvePreferredProvider` — explicit, no silent switch | — |
| 16 | **Russian text normalization for TTS** (numbers, abbreviations, pauses) | ✗ | Medium |
| 17 | **Remote bridge host config** | ✗ — `localhost` only | Medium (blocks B) |

---

## 13 · Risks, open questions, recommended sequence

### Risks

1. **Routing TTS into `audio-service` could break Shadowing repetition.** The service has
   its own `reps`/`loop`; the engine owns repetition. Both at once = double-counting.
2. **GPL-3 (RHVoice, current Piper) and CC-BY-NC (Silero, XTTS, F5)** constrain
   distribution. The only clearly permissive path is Piper's MIT voices or Kokoro's
   Apache-2.0 weights.
3. **A bridge that works on a laptop may be unreachable from the phone** — the primary
   target device. Bridge-based quality risks being desktop-only.
4. **Fixing the cache key changes existing keys.** Harmless now (0 rows); must ship
   *before* any generative provider.
5. **Background audio + synthesized blobs is untested.** `background-audio.js` keeps the
   page alive via `AudioContext`; interaction with a second `<audio>` is unknown.

### Open questions

1. Does Kokoro have usable Russian, and under what licence is `zaakirio/kokoro-ru`?
2. Is a Russian phonemizer feasible in-browser, or does it force the bridge?
3. Is non-commercial licensing acceptable for this app's distribution?
4. Should the bridge become LAN-capable, or is it desktop-only by design?
5. What do the two target devices actually offer for Russian `speechSynthesis`?

### Recommended V1 sequence

**V1.0 — foundations, no new provider** *(fixes what is wrong before adding surface)*
1. Make **one** playback authority for Shadowing. Either route the TTS adapter through
   `audio-service`, or state explicitly that `audio-bus` is the authority and make the
   adapter claim it. **Do not leave five unowned paths.**
2. Fix the cache key: preserve U+0301 and ё; add real `model`/version.
3. Make `isAvailable()` report *capability* (browser: zero Russian voices ⇒ degraded).
4. Introduce `voiceByProvider` and migrate the legacy `voiceId` (the `normalizePracticeMode`
   pattern from the previous pass is the precedent).
5. Revoke the Voice Lab object URL.

**V1.1 — Voice Center surface** — provider list with honest status, per-provider voice
browser, ⓘ metadata, cache size + clear, preview through the unified path.

**V1.2 — one real engine, chosen on licence first.** Recommended spike order:
**(a)** Kokoro/ONNX in-browser (Apache-2.0, no bridge) → **(b)** Piper + phonemizer
(MIT voices, offline) → **(c)** bridge-based Silero v5 (best Russian stress handling,
NC licence).

**V1.3 — bridge hardening** (host/port config, LAN, reachability diagnostics) only if
V1.2(c) is chosen.

**Explicitly deferred:** Android wrapper · cloud providers · voice cloning · quality
benchmarking (needs real listening, impossible here).

---

## Appendix A — Files audited

`js/services/audio-service.js` · `audio-role-service.js` · `media-service.js` ·
`js/services/shadow/{audio-bus,background-audio,native-audio,tts-controller,playback-controller,voice-attempts,practice-target}.js` ·
`js/services/shadow/tts/{types,registry,bootstrap,speaker-adapter,audio-cache,browser-provider,rhvoice-provider,xtts-bridge-provider,cloud-provider,piper-provider}.js` ·
`js/services/pronunciation/**` · `js/utils/normalization.js` · `js/db/schema.js` ·
`js/modals/{voice-lab,voice-attempts}.js` · `js/components/{audio-player,audio-button,mini-player}.js` ·
`js/views/shadow-view.js` · `scripts/tts-bridge/server.py` · `vendor/`

## Appendix B — Reproducing the runtime evidence

An ephemeral Playwright probe was used (scratchpad, **not committed**). It:
imports `bootstrap.js`, calls `allAvailability()`, calls `getVoices()` and
`synthesize()` on every registered provider, computes cache keys for
`за́мок`/`замо́к` and `все`/`всё`, reads `generatedAudio`/`nativeAudio` counts and
`navigator.storage.estimate()`, and greps the adapter/lab sources for
`audio-service`, `new Audio()` and `revokeObjectURL`.

**Not run:** the full test suite — this pass changed no application code, so no
behavioural regression was possible. **CI and Pages status: not observed for this
change.**
