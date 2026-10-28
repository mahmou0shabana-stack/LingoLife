# LingoLife Android (Flutter) Track: Audit and Architecture

**Status:** audit and architecture only. No Flutter project exists yet, no PWA code was changed, and no models were downloaded.
**Baseline audited:** `feeb8a5` (PWA, schema v18, 51 IndexedDB stores, ~93.5k lines of JS, 100 test files).
**Upstream verified:** `k2-fsa/sherpa-onnx` master @ `040afe3` (2026-09-22). The Flutter package `sherpa_onnx` is **1.13.8**.
**Date:** 2026-09-25

Evidence tags used below:
- **VERIFIED**: read in source or observed.
- **INFERRED**: reasoned from source, not executed.
- **UNKNOWN**: needs a proof-of-concept (PoC).

---

## 0. Headline findings (read these first)

1. **The PWA already defines the Android interop layer.** It is not only IndexedDB. It has four versioned, documented, transport-neutral formats:
   - `.llife` backup ZIP (`BACKUP_FORMAT_VERSION 1`, with golden fixtures).
   - `lingolife-sync` change packages (`SYNC_VERSION 1`, version vectors, per-store merge policy).
   - The import package (`PACKAGE_FORMAT_VERSION 1`).
   - `living-language-memory` exchange (v2).

   The Android app should become **another device in the existing sync model**, not a new data model. This is the single most important decision in this document (§5).
2. **Supertonic in sherpa-onnx has a Russian-correctness bug in older versions. It is fixed only from 1.13.5 on (Aug 2026).** Before commit `30df603` ("Fix dropped diacritics in Supertonic TTS text frontend", #3750), the C++ frontend decomposed only Latin-1 characters. Any other precomposed character mapped to "unknown" and was **silently dropped**. That includes **`ё` (U+0451)**, so `ёлка` → `лка`.

   A standalone U+0301 was never affected. It is its own code point and passes straight to the indexer.

   **If your listening benchmark used sherpa-onnx < 1.13.5, stress marks would have worked but `ё` would not.** Re-run the ё check on the pinned version (PoC-3).
3. **An official, maintained Flutter binding exposes Supertonic.** It is `package:sherpa_onnx` (Dart FFI, prebuilt per-ABI Android packages) with `OfflineTtsSupertonicModelConfig` and `generateWithConfig(... extra: {'lang': 'ru', 'num_steps': N})`. No hand-written JNI or FFI is needed for the TTS path. **VERIFIED** in `flutter/sherpa_onnx/lib/src/tts.dart` and `dart-api-examples/tts/bin/supertonic-en.dart`.
4. **Generation in sherpa-onnx's Dart API is synchronous and blocking.** It must run in a dedicated worker isolate. Cancellation happens only at the progress callback, which fires **once per text chunk** (≤300 chars for `ru`). It does not fire per diffusion step. For sentence-sized Shadowing units, "cancel" therefore means "stop at the next chunk boundary, discard the result". **VERIFIED** in `offline-tts-supertonic-impl.cc`.
5. **The PWA's TTS architecture was built for this.** `AVAILABILITY.AVAILABLE_NATIVE_ANDROID` and the `isAndroidNative()` hook in `rhvoice-provider.js` are reserved. The generated-audio cache key (`a2` format) already preserves U+0301, `ё` and case, and includes the model id and version. The Android app should port these contracts exactly and not redesign them.
6. **A cheaper route to native TTS exists and should be consciously rejected or accepted:** a thin Android WebView host around the existing PWA, plus a native sherpa-onnx bridge. See §3.3. It delivers the stated main goal (native TTS speed) for a fraction of the cost. It does not deliver a native app.

---

## 1. Current PWA architecture map

### 1.1 Shape

| Layer | Where | Size | Notes |
|---|---|---|---|
| Shell / routing | `index.html`, `js/app.js`, `js/router.js` | 1.2k | Hash router with ~33 routes (`/`, `/life`, `/scene/:id`, `/shadow/:id`, `/workspace/:id`, `/settings`, `/river`, `/day/:date`, `/studio`, `/dev`, …) |
| Views | `js/views/*.js` | **31.2k** | Imperative DOM rendering. `shadow-view.js` alone is **14,919 lines** and `workspace-view.js` is 3,952 |
| Components / modals | `js/components`, `js/modals` | 8.6k | Audio player, mini-player, lightbox, PDF viewer, voice-lab, voice-attempts, … |
| Styling | `css/*.css` | 21.3k | Tokens, RTL Arabic + LTR Russian, dark "immersive" Shadowing theme |
| Services (domain logic) | `js/services/**` | ~40k | See below |
| DB layer | `js/db/*` | 2.2k | `database.js` (open/migrate/tx), `repository.js` (stamping, rev, dirty, **changeLog append on every write**), `schema.js`, `migrations.js` (v1→v18, forward-only), `db-slots.js` (A/B slot for atomic restore) |
| Offline | `service-worker.js` | — | Code-only cache (`lingolife-<build>`). Network-first for code, cache-first for fonts and images. It **never touches IndexedDB** |
| Tests | `tests/*.test.js` | 55.5k, 100 files | Browser-based runner plus a Playwright headless runner in CI; golden `.llife` fixtures |

### 1.2 Data: IndexedDB `lingolife`, schema v18, 51 stores (**VERIFIED**)

- **Content core:** `scenes`, `media` (Blob + thumbBlob inline), `sceneMediaLinks` (multiEntry `roles`), `scripts`, `scriptVersions`, `contentBlocks`, `contentVersions`, `conversations`, `conversationParts`
- **Language:** `expressions`, `sentencePatterns`, `words` (all with `normalizedText` **unique**), `expressionOccurrences`, `mistakeComparisons`
- **Organization:** `eventTypes`, `eventThreads`, `audioRoles`, `people`, `places`, `journeys`, `topics`, `tags`, `relationships` (a generic graph edge store: `fromId`/`toId`/`kind`, compound indexes)
- **Shadowing:** `shadowSessions`, `shadowSegments`, `practiceEvidence`, `savedItems`, `studyDrafts`, `referenceRules`
- **Audio caches:** `generatedAudio` (key `cacheKey`), `nativeAudio` (key `word`). Both are **LOCAL_ONLY**
- **Review / search / analysis:** `reviewItems`, `reviewHistory`, `searchIndex` (derived inverted index), `analysisRuns`, `analysisProposals`, `analysisItems`, `analysisEvidence`, `memoryOccurrences`, `memorySources`
- **Sync / system:** `changeLog` (origin device + seq, unique), `syncPeers`, `syncQueue`, `settings` (key/value), `backupHistory`, `projectContext`, `promptVersions`, and `dev*` stores

Index profile: 22 compound indexes, 5 unique, 1 multiEntry. Records are schemaless JS objects with common stamps (`id` ULID with type prefix, `createdAt`, `updatedAt`, `rev`, `state` active/archived/trashed, `deletedAt`, `dirty`).

**Access patterns (INFERRED from services):** by-id gets, by-foreign-key lists (`sceneId`, `sessionId`, `scriptId`), ordered compound lookups (`scene_order`, `session_order`, `state_date`), unique natural-key dedup (`normalizedText`), graph lookups on `relationships`, prefix and token search on `searchIndex`, multi-store atomic transactions (import apply, restore, merge apply), and pagination (40 per batch in "Life"). This is **relational** access over **document-shaped** rows.

### 1.3 Storage services
- `repository.js` is the only writer. It stamps records, bumps `rev`, sets `dirty`, and appends to `changeLog` (policy from `sync-policy.js`).
- `media-service.js` owns object URLs (`pinMedia` / `unpinMedia`). Recording uses `MediaRecorder`, preferring `audio/webm;codecs=opus`, then `audio/webm`, then `audio/mp4`.
- `trash-service.js`, `delete-service.js`, `link-service.js` (relationships), `search-service.js`.

### 1.4 Shadowing
- **Engine:** `shadow/playback-controller.js` (899 lines). This is a DOM-free state machine with a run token (prevents overlapping cycles) and a 60 ms anti-overlap gap. It has repeat modes (count / continuous), practice modes (sentence / word / continuous / myRole) and audio sources (`tts` / `mine` / `native`). It is injected with `speaker()` and `canceler()`.
- **Session persistence:** `shadow-session-service.js` (`shadowSessions`, `shadowSegments`, `practiceEvidence`).
- **Text:** `segmenter.js`, `sentence-identity.js` (stable sentence ids across edits), `sentence-material.js`, `practice-target.js`, `bilingual.js`, `text-cleanup.js`, `dialect.js`.
- **Russian stress:** `shadow/stress.js`, `pronunciation/stress-resolver.js`, and `pronunciation/stress/{resolver,providers,lexicon-store}.js`. Layers are reviewed → context → offline lexicon (10.5 MB `assets/stress-lexicon.json`, CC BY-SA, OpenRussian) → prediction, each tagged with origin and maturity.
- **UI:** `shadow-view.js` (split "book", immersive dark theme, Tool Center drawer, word/phrase/sentence interactions, full-text modes).

### 1.5 Draft V2
`study-draft.js` (store `studyDrafts`), `shadow/draft-v2.js` (role-based parser: MICRO CORE, EXPANSION, VARIATION, FULL BUILD headings with Arabic/English synonyms; support headings; cue/answer), `draft-structure.js`, `draft-targets.js`, `draft-learning.js`. These are pure text logic, heavily tested (`draft-*.test.js` ×11).

### 1.6 Audio bus and playback
- `shadow/audio-bus.js`: a single-owner lock (`claimAudio(id, silence)` / `releaseAudio`). Every sound source must claim, and a claim silences the previous owner.
- `audio-service.js`: one `<audio>` element outside views, with a queue, Media Session (lock-screen controls), rate, reps, loop, A↔B, and a rAF progress loop.
- Voice Center V1.0C (latest commits) put "every audio path under an owner on the bus".

### 1.7 TTS provider architecture
`shadow/tts/`:
- **Contract:** `types.js` defines `TTSProvider` (`isAvailable` → `{available, status, reason}`, `getVoices`, `synthesize` → `TTSResult`, `cancel`, capability flags, optional `modelId` / `modelVersion`), `AVAILABILITY` (includes `AVAILABLE_NATIVE_ANDROID`) and `PROVENANCE`.
- **Registry:** `registry.js` and `bootstrap.js`.
- **Adapters:** browser, rhvoice (real, via local bridge), xtts-bridge, cloud (placeholder), piper (onnxruntime-web, unregistered). `speaker-adapter.js` maps `TTSResult` to the engine's `{ok, reason}`.
- **Generated-audio cache:** `audio-cache.js`, with `synthesizeWithCache` as the only ask → generate → store path. The `a2` key is `sha256('a2' ⊕ NFC-trimmed text ⊕ lang ⊕ providerId ⊕ model ⊕ modelVersion ⊕ voiceId ⊕ settingsKey)`. It **preserves U+0301, ё and case** (the earlier collision bug documented in `docs/VOICE_ARCHITECTURE_AUDIT.md` §6 is fixed).
- **Voice identity:** `voice-identity.js` stores `voiceByProvider: {providerId → voiceId}`, migrated at read time from the legacy flat `voiceId`.

### 1.8 Voice Center
Quick voice panel in the Shadowing screen, voice browser (details, favourites / recent, mini comparison), current-source line, "test the voice" with four guards, and the A/B/C lab (`modals/voice-lab.js`).

### 1.9 Recordings
`modals/voice-attempts.js` and `shadow/voice-attempts.js`. A recording saves as `media` (audio blob) + `sceneMediaLinks` (role `MY_VOICE`) + `practiceEvidence` (`targetType: 'shadowVoice'`, frozen target key). Cancel writes nothing.

### 1.10 Offline, backup, sync, cloud
- **Offline:** code in Cache Storage, data in IndexedDB. The origin is sacred: a URL change means an empty world (README).
- **Backup:** `services/backup/` (serialize / deserialize / validate / migrations / restore). `.llife` is a STORE-method ZIP (ZIP64 capable) containing `manifest.json`, `data/<store>.json` and `blobs/`. It has CRC-32 plus SHA-256, three-level validation, and an atomic restore via DB slot swap. Derived stores and `normalized*` fields are excluded.
- **Sync (WS-G):** `services/sync/`.
  - Device id (ULID, outside the DB).
  - `changeLog` per write, with version vectors.
  - `sync-policy.js` puts every store in one category: `CANONICAL` / `APPEND_ONLY` / `RELATIONSHIP` / `DERIVED` / `BLOB_METADATA` / `LOCAL_ONLY`, with `localFields`. A test guard ensures no store lacks a policy.
  - The planner does a three-way merge, reports conflicts to the user, and applies atomically.
- **Cloud (WS-H):** `services/cloud/`. Google Drive transport, lazy media transfer by `contentHash`, offline packs.

### 1.11 Tests and behavioural guards
There are 100 test files. Guards include:
- a module-graph import check;
- a static escape check;
- store-policy completeness;
- "nothing disappears from trash";
- golden `.llife` fixtures that must restore forever;
- a no-Google-in-sync boundary check;
- audio ownership;
- audio-cache key tests;
- font coverage for Cyrillic with combining marks.

---

## 2. Reuse classification

| Class | What | Approx. size |
|---|---|---|
| **A. Shared conceptually** (rules, not code) | Single audio owner; provider contract and honest availability states; provenance labelling (generated ≠ human); store-policy matrix; forward-only migrations; "plan never writes, apply is atomic"; practice ≠ mastery; display text ≠ synthesis text; the no-silent-loss principles | — |
| **B. Reused directly** (bytes / specs, no rewrite) | `.llife` / `lingolife-sync` / import / memory-exchange **formats**; golden fixtures `tests/fixtures/*.llife`; `assets/stress-lexicon.json` (10.5 MB); fonts; icons and images (webp); prompt catalog text; curriculum **data** (after extraction to JSON); docs | ~11 MB assets |
| **C. Ported** (same semantics, Dart, verified by shared test vectors) | `utils/ids`, `normalization`, `dates`, `plural`; `segmenter`, `sentence-identity`, `text-cleanup`, `bilingual`, `draft-v2`, `draft-structure`, `draft-targets`, `study-draft` logic; stress resolver, providers and lexicon store; `playback-controller` state machine; `session-progress`; `practice-target`; `voice-identity`; `audio-bus`; the `audio-cache` key; the pronunciation engine and rules; the sync change-log, policy, package, planner and apply; the backup serialize, validate and migrations; import plan and apply | ~18–22k JS lines (the ~45 pure modules in `shadow/`, `pronunciation/`, `utils/`, plus `sync/`, `backup/`, `import/`) |
| **D. Rewritten for Flutter** | All views, components, modals and CSS (~60k lines of UI); DB layer (IndexedDB → SQLite); media service (Blobs → files); recording (`MediaRecorder` → native recorder); `audio-service` (HTMLAudio → ExoPlayer via plugin); TTS adapters (browser → Android TTS; Piper / XTTS / bridge → native); service worker (not applicable); Drive auth (GIS → Android sign-in); OCR (Tesseract.js → native; Russian support **UNKNOWN**); PDF viewer | ~60k+ |

**On reusing JS directly in Flutter** (an embedded QuickJS such as `flutter_js`): this is technically possible for the pure parsers. It is **not recommended** as the default. It adds a second runtime, async marshalling, debugging pain and memory. Keep it as a fallback only for `bilingual.js` / `draft-v2.js` if the port stalls. The recommended route is porting plus **conformance vectors**: JSON input → expected output files generated by running the PWA's own JS in its CI (§8), consumed by Dart tests.

---

## 3. Flutter vs Kotlin vs WebView host (for THIS project)

### 3.1 Requirement fit

| Requirement | Flutter | Kotlin / Compose |
|---|---|---|
| Supertonic via sherpa-onnx | Official Dart FFI plugin, prebuilt ABIs, Supertonic config **VERIFIED** | Official Kotlin API (`Tts.kt` has Supertonic) plus an official Android Supertonic 3 demo (#3612) |
| Background Shadowing loop + lock screen | `audio_service` + `just_audio` (ExoPlayer underneath). Workable; another plugin layer | Media3 `MediaSessionService` + ExoPlayer natively. **Best-in-class** |
| Precise repeat / gap timing | Adequate (UNKNOWN until PoC-4) | Adequate |
| Recording | `record` plugin (AAC / Opus / WAV) | `MediaRecorder` / `AudioRecord` directly |
| Mixed RTL Arabic + LTR Russian, combining U+0301 rendering, 10 display fonts | HarfBuzz shaping via Skia/Impeller; good, needs a font-coverage check | Android text stack; good |
| UI volume (18+ screens, a very rich Shadowing screen, tablet + phone) | **Faster to build and iterate**; hot reload | Slower for this amount of custom UI |
| Porting ~20k lines of JS logic | Dart is closest to JS (async/await, maps, closures) | Kotlin is also fine; slightly more ceremony |
| SQLite with JSON columns | `drift` / `sqlite3` (bundles modern SQLite with JSON1 + FTS5) | Room / SQLite (the system SQLite version varies by device) |
| Your workflow (Claude Code on a tablet, CI builds) | CI builds the APK; tests run headless on Linux (`flutter test`) | Same; JVM unit tests are also easy |
| Future iOS / desktop | Yes | No |

### 3.2 Verdict
**Flutter is a sound choice, but not a decisive winner.** It wins on UI throughput, which is the largest body of work. Kotlin wins on audio/background lifecycle, which is the most delicate. The deciding risk for Flutter is **background audio plus native-inference lifecycle**, and it can be tested cheaply (PoC-4 and PoC-5). If those PoCs pass, Flutter's UI advantage dominates. If they fail, the fallback is Flutter UI with a small Kotlin `MediaSessionService` plugin, not a full Kotlin rewrite.

### 3.3 The option to consciously decide on: WebView host
A minimal Android app hosting the existing PWA in a WebView (custom or Capacitor), with a JS bridge to a native sherpa-onnx `TTSProvider`:
- It reuses 100% of the PWA and gets native Supertonic speed within weeks. The PWA's `isAndroidNative()` / `AVAILABLE_NATIVE_ANDROID` seams already exist.
- Costs:
  - The WebView origin is a **different IndexedDB** from the GitHub Pages PWA, so data moves via `.llife` / sync, the same as with Flutter.
  - It inherits the web audio and background limits.
  - It is not a native app.
- **Recommendation:** proceed with Flutter as requested. Keep the native TTS engine code isolated (§6) so that a WebView host remains possible later without rework.

---

## 4. Recommended Android architecture

```
lib/
  app/            shell, routing (go_router), theming (tokens ported from css/tokens.css), l10n (ar/ru)
  features/       life, scene, shadowing, draft, voice_center, recordings, settings, backup, sync
  domain/         PURE Dart ports: ids, normalization, segmenter, sentence_identity, stress,
                  draft_v2, bilingual, playback_controller (state machine), voice_identity,
                  audio_cache_key, sync/*, backup/*    ← no Flutter imports, 100% unit tested
  data/
    db/           SQLite (drift): one table per PWA store, JSON document + indexed columns
    repo/         Repository<T>: stampNew / stampUpdate / rev / dirty / changeLog append (port of repository.js)
    media/        content-addressed file store for blobs (recordings, images, thumbs)
    formats/      .llife reader/writer, lingolife-sync reader/writer, import package
  audio/
    bus/          AudioBus (single owner) — exact port of audio-bus.js semantics
    player/       PlaybackService (just_audio + audio_service), owns the ONE player
    recorder/     Recorder (record plugin)
  tts/
    contract/     TtsProvider, TtsRequest/SynthesisRequest, TtsResult, Availability, Provenance
    registry/     ProviderRegistry + fallback order
    cache/        GeneratedAudioCache (a2 key, files + LOCAL_ONLY table)
    text/         RussianTextPipeline (display → synthesis), per-provider preprocessors
    providers/    android_system, supertonic_sherpa, (later) rhvoice, piper_sherpa, bridge, cloud
    engine/       SherpaWorker — long-lived isolate owning native TTS handles
  models/         ModelCatalog (pinned manifest), Downloader, Sha256Verifier, Installer
```

State management: Riverpod, or plain `ChangeNotifier` + services. Keep the domain layer framework-free so the choice stays cheap to change.

---

## 5. Data compatibility plan

### 5.1 Decision
**Preserve the current logical schema exactly. Store it in SQLite as "document tables". Use the existing `.llife` and `lingolife-sync` formats as the only interchange. Do not invent a new portable format.**

Why this, against the alternatives:
- **A new shared JSON interchange format:** unnecessary. `.llife` (full state) and `lingolife-sync` (deltas) already exist, are versioned, validated, documented and fixture-tested. A third format would create exactly the incompatibility you want to avoid.
- **Remodel into a "proper" relational schema (Drift entities, one column per field):** rejected. PWA records are schemaless and evolve per workstream. Per-field mapping silently drops fields Android doesn't know yet, which breaks round-trips and sync.
- **Isar / ObjectBox (object stores):** rejected.
  - The access patterns need compound and unique indexes, multi-store atomic transactions, graph lookups on `relationships`, and token search. SQLite does all of these.
  - Isar's original maintainer abandoned it (a community fork exists), which is a longevity risk for a "memory for life" app.
  - Neither brings JSON1 or FTS5.
- **SQLite (via `drift`, or the `sqlite3` package with bundled `sqlite3_flutter_libs`):**
  - It maps IndexedDB 1:1: one table per store, `id TEXT PRIMARY KEY`, `doc TEXT` (the record JSON exactly as the PWA shapes it, **unknown fields preserved**), plus real columns for each IndexedDB index keyPath with the same compound, unique and multiEntry semantics (a side table for `roles`).
  - Multi-table transactions give atomic import, restore and merge.
  - FTS5 can later replace the derived `searchIndex`.
  - The bundled library gives the same SQLite version on every device.

### 5.2 Rules
1. **Same ids** (ULID + the `PREFIX` table), **same stamps** (`rev`, `dirty` as 0/1, `state`), **same store names**, **same field names**.
2. **Schema version parity:** Android's DB records which PWA schema version (`TARGET_VERSION`) its logical model corresponds to. Android never invents a store or field unilaterally. New stores or fields go through the shared contract first (§8).
3. **Blobs:** `media.blob` / `thumbBlob` become files in `app_support/media/<contentHash or id>`, and the row keeps the metadata. This mirrors the PWA's own `BLOB_METADATA` policy (`blob`, `thumbBlob`, `blobPending`, `driveFileId` are local fields).
4. **Device id** lives outside the DB and outside backups (the same rule as the PWA's `localStorage` device id).
5. **LOCAL_ONLY stores** (`generatedAudio`, `nativeAudio`, `syncQueue`, `changeLog`, `syncPeers`, …) exist on Android with their own local meaning and never leave the device.
6. **Recording formats:** Android records AAC in MP4 (`audio/mp4`, already in the PWA mime→extension table) or Opus in Ogg. Chrome plays both, and ExoPlayer plays the PWA's WebM/Opus. **UNKNOWN:** verify on the S24 and Tab S10+ (PoC-6).

### 5.3 Incremental compatibility ladder (lowest risk first)
1. **Read-only replica:** Android imports a `.llife` from the PWA (streaming the STORE ZIP) and renders it. No writes back.
2. **Append-only writer:** Android writes only `APPEND_ONLY` data (`practiceEvidence`, recordings as new `media`) plus local-only caches. These merge trivially (union by id).
3. **Full peer:** port `sync-package` / `merge-planner` / `merge-apply`. Android exchanges `lingolife-sync` packages (file first, Drive later), and conflicts surface in the same model.
4. **Backup writer:** Android emits `.llife` that the PWA restores. This is guarded by cross-restore tests in both directions.

---

## 6. Native audio / TTS architecture

### 6.1 Playback and bus
- One `PlaybackService` owns the only player (`just_audio`), wrapped by `audio_service` for MediaSession, lock screen and a foreground service of type `mediaPlayback` (required on Android 14+).
- `AudioBus.claim(ownerId, silence)` / `release(ownerId)` is ported literally. **Every** source goes through it: session TTS, word tap, recordings, Voice Center preview. This is the lesson of PWA WS29 and V1.0C.
- **The Shadowing engine owns repetition.** The player plays one item and reports completion. `speaker()` resolves on `completed` (the promise-shaped contract from `playback-controller`). The player's own loop or repeat is never used at the same time (the warning in `VOICE_ARCHITECTURE_AUDIT.md` §5).
- Recording pauses playback via the bus. Audio focus and ducking go through `audio_session`.

### 6.2 TTS contract (ported, with one addition)
```dart
abstract class TtsProvider {
  String get id; String get name; ProviderType get type;
  String? get modelId; String? get modelVersion;          // enter cache key BEFORE synthesis
  Capabilities get caps;                                  // offline, streaming, word, sentence, longText
  Future<AvailabilityReport> availability();              // honest: status + reason, and "canSpeakRussian"
  Future<List<VoiceInfo>> voices({String lang = 'ru'});
  TextPreprocessor get preprocessor;                      // provider-specific, versioned
  Future<TtsResult> synthesize(SynthesisRequest r, {CancelToken? cancel});
  Future<void> cancel(String requestId);
}
class SynthesisRequest {                                  // display text is NEVER mutated
  final String displayText;      // what the learner sees (NFC, U+0301, ё intact)
  final String synthesisText;    // what the engine gets (after provider preprocessing)
  final String preprocessorId;   // e.g. 'supertonic-ru@1' → part of settingsKey
  final String lang, providerId; final String? voiceId; final double speed;
}
```
- Addition 1: **availability ≠ capability** is fixed in the contract (`canSpeakRussian`, `voicesInstalled`). This addresses the PWA audit's finding 3.
- Addition 2: `SynthesisRequest` makes "display ≠ synthesis" structural, not accidental (audit §6).
- The cache key uses the PWA `a2` algorithm with `settingsKey = 'speed=…;steps=…;pre=supertonic-ru@1'`. It is shared through test vectors, so both apps compute the same key for the same request. (The cache itself stays LOCAL_ONLY; parity is for correctness, not sharing.)
- Cached audio is stored as a WAV/PCM16 file (or Opus later) in `cache/tts/`, with a row in `generatedAudio` holding size, `lastUsedAt` and provenance. Eviction is LRU with a byte budget.

### 6.3 Providers, in order
1. `android_system` (`flutter_tts`, speaks directly, not cacheable) is the always-available fallback. Its Russian voice presence is detected honestly.
2. `supertonic_sherpa` (§7).
3. Later: `rhvoice` (installed RHVoice Android app via system TTS, or a sherpa-compatible engine; note the GPL-3 implications), `piper_sherpa` (sherpa-onnx runs Piper VITS models with espeak-ng phonemization built in, which removes the PWA's missing-phonemizer blocker), `lan_bridge` (the existing `scripts/tts-bridge` HTTP contract), `cloud`.

### 6.4 Russian correctness pipeline
```
stored text (NFC) ──► DisplayText            (never altered; U+0301 and ё rendered)
        │
        ├─ StressResolver (ported): manual U+0301 > reviewed > context > lexicon > [Silero Stress, optional] > none
        │     only fills words WITHOUT a manual mark; never moves or removes one
        ▼
   canonicalize stress: U+00B4 / U+02CA / U+0341 → U+0301 (Supertonic's frontend turns U+00B4 into an apostrophe!)
        ▼
   provider.preprocessor (versioned): supertonic-ru@1 = NFC, keep U+0301, keep ё, no case folding,
        numbers/abbrev expansion (later), chunk at sentence boundaries ≤ 300 chars
        ▼
   SynthesisRequest.synthesisText  ──► engine
```
- **Guard tests** (Dart):
  - Every preprocessor preserves every U+0301 and every ё/Ё of its input (property test over the stress benchmark corpus in `tests/fixtures/stress-benchmark-corpus.js`).
  - Minimal pairs `за́мок/замо́к`, `все/всё`, `му́ка/мука́` produce distinct cache keys.
  - No module outside `tts/text/` may call the search normalizer (`normalizeRussian`, which strips stress and folds ё) on a synthesis path. This is a static scan, like the PWA's own boundary guards.
- **Silero Stress** would be an optional provider inside `StressResolver`. It fills unmarked words only. Its output is tagged `origin: model` and is never written back as "manual". Licence: re-verify (Silero models are largely CC-BY-NC).

---

## 7. Exact Supertonic + sherpa-onnx integration route

**Route:** Flutter → `package:sherpa_onnx` (official Dart FFI) → `libsherpa-onnx-c-api.so` + `libonnxruntime.so` (prebuilt per ABI) → Supertonic 3 INT8. **No custom JNI or FFI.**

| Item | Decision | Evidence |
|---|---|---|
| Version | Pin `sherpa_onnx: 1.13.8` exactly (**≥ 1.13.5 is mandatory**: the ё/diacritics fix, and a use-after-free fix in async TTS callbacks) | CHANGELOG 1.13.5 **VERIFIED** |
| Model | `sherpa-onnx-supertonic-3-tts-int8-2026-05-11`: `duration_predictor.int8.onnx` 3.7 MB, `text_encoder.int8.onnx` 36.4 MB, `vector_estimator.int8.onnx` 78.4 MB, `vocoder.int8.onnx` 26.0 MB, `tts.json`, `unicode_indexer.bin` 256 KB, `voice.bin` 505 KB. **≈145 MB total** | HF listing **VERIFIED** |
| Licence | The sherpa repack ships an MIT LICENSE (Supertone code). The upstream model card `Supertone/supertonic-3` declares **`license: openrail`**. Treat the **weights as OpenRAIL** (use restrictions, attribution) until confirmed | **VERIFIED**; legal review **UNKNOWN** |
| Config | `OfflineTtsSupertonicModelConfig(durationPredictor, textEncoder, vectorEstimator, vocoder, ttsJson, unicodeIndexer, voiceStyle)` using **filesystem paths** of the downloaded model | **VERIFIED** |
| Generation | `generateWithConfig(text, OfflineTtsGenerationConfig(sid, speed, extra: {'lang':'ru','num_steps':N}), onProgress)`. `lang` must be one of 32 codes (`ru` included). `num_steps` defaults to 5 (the example uses 8). Quality/latency to be tuned in PoC | **VERIFIED** |
| Voice selection | `sid` indexes preset styles in `voice.bin` (`numSpeakers`). Invalid sid falls back to 0 with a log line. Map sid ↔ names (M1…/F1…) from the model card. Stored per provider in `voiceByProvider['supertonic-3-int8']` | **VERIFIED** (the name mapping is **UNKNOWN**) |
| Threading | **One long-lived worker isolate owns the `OfflineTts` handle** (load once). Main isolate ↔ worker via `SendPort` messages (`load`, `synthesize{id}`, `cancel{id}`, `unload`). Serialize requests with a queue and prefetch the next sentence while the current one plays. `numThreads` 2–4 per device (PoC) | INFERRED from the sync Dart API |
| Cancellation | `generateWithConfig` blocks the worker isolate, so a `cancel` message cannot be read mid-generation. Use a **native shared flag** (`calloc<Int32>` allocated by the main isolate; its address is passed to the worker). The `onProgress` callback returns `0` (stop) when the flag is set. Granularity: one chunk (≤300 chars), which is effectively one sentence. Stale results are also discarded by request id (the same idea as the PWA's run token) | **VERIFIED** callback semantics; approach INFERRED, PoC-2 |
| Streaming | At chunk level only (the callback gets each chunk's samples). The app streams **at sentence level** by segmenting itself (it already does) and prefetching | **VERIFIED** |
| Output | `Float32List` samples + `sampleRate` → PCM16 WAV file in the cache → `just_audio` plays the file. Never pass raw PCM across the bus | INFERRED |
| Memory | About 0.22 GB resident after load (your benchmark). The worker owns it. Free the handle (`tts.free()`) on `didHaveMemoryPressure` / `onTrimMemory` when not playing, and after N minutes idle in background. Reload lazily. Reload latency is **UNKNOWN** (PoC-5) | — |
| ABI packaging | S24 Ultra and Tab S10+ are both arm64-v8a. Set `abiFilters 'arm64-v8a'` (optionally x86_64 for the emulator), or `--split-per-abi`. The model is **never in the APK** | INFERRED |
| Download on demand | A pinned manifest, per file: URL at a fixed **HF commit revision** (`/resolve/<sha>/…`), size, SHA-256 (the HF LFS oid *is* the file's SHA-256). Use `background_downloader` (resumable, runs while backgrounded) into `app_support/models/.staging/<modelId>/`. Stream SHA-256 in an isolate (`crypto` chunked). Then atomically rename the directory to `models/<modelId>/` and write `installed.json` last. Availability = `MODEL_NOT_DOWNLOADED` until then. A corrupt file is deleted and re-fetched, never loaded | INFERRED; PoC-7 |
| Model identity | `modelId = 'supertonic-3-int8'`, `modelVersion = '2026-05-11+hf:<sha>'`; both enter the cache key | — |

---

## 8. Parallel Git / repository strategy

Facts that constrain this:
- `deploy.yml` publishes the **whole repo root** to GitHub Pages on every push to `main`.
- `tests.yml` runs PWA browser tests on `main`, `claude/**` and PRs.
- Workflows are read from the pushed branch's own files.

**Recommended (in order of preference):**
1. **Best: a separate repository** `lingolife-android`. It has no Pages or CI interference, independent history and independent issues. This needs your approval and GitHub setup.
2. **Acceptable now: an orphan branch in this repository**, e.g. `android/main` (created with `git switch --orphan`). It shares no history with `main`, so it is never merged into it. It carries its own `.github/workflows/android.yml` (Flutter analyze/test/build APK) and none of the PWA workflows, so PWA CI and Pages are untouched. Feature work goes on `android/<topic>` branches, with PRs into `android/main` only.
   - The current session branch `claude/compassionate-cori-3wwms6` holds **only this audit document**. Moving the audit there (or into the new repo) is the first step of Phase 0.

**Shared contracts, evolved intentionally (never by cherry-picking UI):**
- Add `contracts/` on PWA `main` (a small, reviewed PR, doc and data only):
  - `schema.json`: stores, index keyPaths, unique/multiEntry, sync policy category and localFields, exported from `schema.js` + `sync-policy.js` by a script.
  - `formats/`: `.llife` and `lingolife-sync` specs (links to docs 07 and 20).
  - `vectors/*.json`: input → expected output generated **by the PWA's own JS in its CI** (segmenter, sentence-identity, stress resolution, draft-v2 parse, voice-identity, a2 cache key, ids/prefixes, normalization, merge planner cases).
  - `fixtures/*.llife` (the existing golden files).
  - `CONTRACT_VERSION` and a changelog.
- Android pins a contracts version (a submodule at a tag such as `contracts-v1`, or a fetch script pinned to a commit) and runs all vectors in `flutter test`. Updating the pin is a deliberate Android PR.
- Rule: a new store, field or format change lands **in the PWA contract first**. Android follows. Android never writes fields the contract doesn't know.
- A PWA CI guard fails if `schema.js` changes without regenerating `contracts/schema.json`, so drift is caught at the source.

---

## 9. Incremental migration phases (each ends with a runnable APK)

The order is derived from the audit: data safety first, then the TTS value path, then the heaviest UI.

| Phase | Deliverable (runnable) | Exit criteria |
|---|---|---|
| **P0 Spikes** | Throwaway Flutter app on device running Supertonic ru from a downloaded model | PoC-1…7 answered (§10) |
| **P1 Shell + contract harness** | App shell (ar/ru, RTL/LTR, tokens), `domain/` package with ids/normalization ported, contracts vectors running in CI, APK artefact | CI green; vectors pass |
| **P2 Read-only replica** | Import `.llife` → SQLite document tables; browse scenes, scripts and conversations; view images; play recordings | Both golden fixtures and a real export import losslessly (re-export diff = ∅ modulo excluded fields) |
| **P3 Sentence rendering + stress** | Segmenter, sentence identity, stress resolver + lexicon, word/phrase/sentence tap with U+0301 rendering in all fonts | Vectors pass; font-coverage test; manual marks never altered |
| **P4 Audio bus + player** | `PlaybackService` + `AudioBus` + MediaSession; any recording plays with lock-screen control | Ownership tests ported from `audio-ownership.test.js` |
| **P5 TTS contract + system TTS** | Provider registry, availability report, `android_system` provider, a2 cache, Voice Center "current source" line | Honest availability on a device with and without Russian voices |
| **P6 Supertonic native** | Model catalog, download + SHA-256 + atomic install, `SherpaWorker`, the `supertonic_sherpa` provider, cancel and prefetch | RTF / latency / RAM within budget on the S24 and Tab S10+; ё and stress minimal pairs audible |
| **P7 Shadowing core** | `playback-controller` port (run token, repeat modes, practice modes, myRole), session persistence, practice evidence (APPEND_ONLY writes) | Engine vectors pass; 30-minute background loop without drops |
| **P8 Recording** | Voice attempts bound to a frozen target, compare playback, save as media + link + evidence | Recordings made on Android restore in the PWA (via P11 or a partial export) |
| **P9 Draft V2** | Study drafts, V2 parser, targets, draft learning view | All `draft-*` vectors pass |
| **P10 Voice Center** | Voice browser, per-provider voice, favourites/recent, test-the-voice guards, A/B compare | — |
| **P11 Interop writer + sync peer** | `.llife` export from Android; `lingolife-sync` package exchange (file); then Drive transport | Cross-restore PWA↔Android both ways; merge vectors pass |
| Later | Life / river / atlas views, organize, prompts, analysis, dev lab, OCR | By demand |

---

## 10. Risks and unknowns → PoC tests

| # | Risk / unknown | PoC |
|---|---|---|
| PoC-1 | Supertonic ru latency on the S24 Ultra and Tab S10+ via `sherpa_onnx` 1.13.8 (your 0.4 RTF was measured elsewhere); `num_steps` 5 vs 8; `numThreads` 2/4 | Time 20 real Shadowing sentences: first-audio latency, RTF, thermal behaviour over 10 minutes |
| PoC-2 | Cancellation via a shared native flag across isolates actually stops generation at the chunk boundary, with no crash (use-after-free history) | Rapid next/next/next on sentences plus long text; no overlapping audio, no crash |
| PoC-3 | **ё and U+0301 fidelity on ≥1.13.5**; homograph minimal pairs; U+00B4 canonicalization | Listening set + optional on-device ASR back-check; compare against a pre-1.13.5 build to confirm the ё bug and the fix |
| PoC-4 | Background loop: Shadowing TTS repeat for 30 minutes with the screen off; Samsung battery optimisation | `audio_service` foreground service; check for process death / gaps |
| PoC-5 | Memory pressure: 0.22–0.34 GB model + app on the phone; reload cost after `free()` | Load, background, open a camera app, return; measure reload time and RSS |
| PoC-6 | Recording interop: Android AAC/MP4 or Opus/Ogg plays in PWA Chrome; PWA WebM/Opus plays in ExoPlayer | Round-trip files |
| PoC-7 | 145 MB resumable background download, interrupted network, SHA-256 mismatch path, atomic install | Kill the app mid-download; flip a byte |
| PoC-8 | `.llife` streaming import of a real (large, media-heavy) export into SQLite within memory limits | Import your actual backup |
| PoC-9 | Flutter rendering of Cyrillic + U+0301 across the 10 PWA display fonts, mixed with Arabic RTL | Golden screenshots |
| R-10 | Supertonic weights licence (OpenRAIL vs MIT) | Legal read before any distribution beyond personal use |
| R-11 | Porting drift: Dart ports silently diverge from the JS | Contract vectors generated by the PWA CI (§8) |
| R-12 | Scope: 60k lines of UI; Shadowing view is 15k lines | Phase order keeps the value path (P6–P7) early; the rest is by demand |
| R-13 | Russian OCR on Android (ML Kit coverage uncertain) | Deferred; UNKNOWN |

---

## 11. Smallest first implementation phase after this audit

**P0-a: "Supertonic says a Russian sentence on your phone, correctly".** Scope:
1. Create the Android branch or repo per §8 (orphan `android/main` or a new repo), with a Flutter skeleton and a CI job that builds an arm64 debug APK.
2. One screen: a text field prefilled with minimal pairs (`Это за́мок. Это замо́к. Всё хорошо. Все пришли. Ёлка.`), a Download-model button, a Speak button and a Cancel button.
3. Model download from a pinned HF revision with SHA-256 verification into app storage (no bundling).
4. `SherpaWorker` isolate: load once, `generateWithConfig(lang:'ru')`, write WAV, play with `just_audio`, cancel via the shared flag.
5. On-screen metrics: load time, first-audio latency, RTF, RSS.

It answers PoC-1, 2, 3, 5 and 7 with about 300–500 lines of throwaway code, and touches nothing in the PWA. Everything after it (P1+) is gated on its numbers.

---

### Sources
- sherpa-onnx source @ `040afe3`: `flutter/sherpa_onnx/lib/src/tts.dart`, `sherpa-onnx/csrc/offline-tts-supertonic-{impl,unicode-processor}.cc`, `sherpa-onnx/kotlin-api/Tts.kt`, `dart-api-examples/tts/bin/supertonic-en.dart`, `CHANGELOG.md`, commit `30df603`
- [sherpa_onnx on pub.dev](https://pub.dev/packages/sherpa_onnx) · [changelog](https://pub.dev/packages/sherpa_onnx/changelog)
- [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) · [Supertonic support discussion #2833](https://github.com/k2-fsa/sherpa-onnx/discussions/2833)
- [csukuangfj2/sherpa-onnx-supertonic-3-tts-int8-2026-05-11](https://huggingface.co/csukuangfj2/sherpa-onnx-supertonic-3-tts-int8-2026-05-11) · [Supertone/supertonic-3](https://huggingface.co/Supertone/supertonic-3)
- PWA: `docs/03`, `docs/07`, `docs/08`, `docs/20`, `docs/21`, `docs/VOICE_ARCHITECTURE_AUDIT.md`, `js/db/schema.js`, `js/services/sync/sync-policy.js`, `js/services/shadow/tts/*`
