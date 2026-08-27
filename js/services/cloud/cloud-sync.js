/**
 * LingoLife — منسّقُ المزامنة السحابيّة (WS-H · بنود ٤ و١١ و٢٧ و٢٨ و٥٣)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **المكانُ الوحيدُ الذي يلتقي فيه المحرّكُ بالناقل**
 * ═══════════════════════════════════════════════════════════════
 *
 *   شاشة → **هذا الملفّ** → عقدُ النقل → مُنفِّذٌ بعينه
 *                ↓
 *          محرّكُ WS-G كما هو
 *
 * ولا شاشةٌ تنادي ناقلًا، ولا ناقلٌ يعرف حزمةً بمعناها، ولا سطرَ من
 * منطق الدمج يُعاد كتابته هنا. هذا الملفّ **يرتّب الخطوات** لا غير.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **خطُّ الأنابيب — والترتيبُ مقصود** (بند ١١)
 * ═══════════════════════════════════════════════════════════════
 *
 *   ١. تحقّق من الإذن والشبكة
 *   ٢. اكتشف الكونَ السحابيّ (أو أنشئه)
 *   ٣. **نزّل أوّلًا** ← ثم ارفع
 *   ٤. تحقّق من كلّ حزمةٍ (WS-G) قبل أيّ تخطيط
 *   ٥. خطّط، وقف إن كان فيه تعارض
 *   ٦. طبّق ذرّيًّا
 *   ٧. ارفع حزمتَك
 *   ٨. اكتب نقاطَ التفتيش
 *
 * **ولماذا التنزيلُ قبل الرفع؟** حتى تحمل حزمتُنا الصادرةُ ما دمجناه
 * للتوّ، فيصل الجارَ الثالثَ في جولةٍ واحدة بدل جولتين. وهو أيضًا ما
 * يجعل «زامن الآن» مرّتين متتاليتين بلا تغييرٍ لا يرفع شيئًا.
 */

import { withTx, req } from '../../db/database.js';
import { deviceId, deviceLabel, localDevice } from '../sync/device.js';
import { vectorOf } from '../sync/change-log.js';
import { createSyncPackage, inspectSyncPackage } from '../sync/sync-package.js';
import { planMerge } from '../sync/merge-planner.js';
import { applyMerge } from '../sync/merge-apply.js';
import { applicable, unresolved } from '../sync/conflicts.js';
import { runRebuilds } from '../sync/sync-service.js';
import { FAIL, TransportError, assertTransport, classify } from './transport.js';
import { SYNC, createStateMachine, autoSyncAllowed } from './sync-state.js';
import { detectReplacement, rememberVector, forgetVector } from './restore-guard.js';
import { INSTALL, readInstall, writeInstall } from './install-store.js';
import { JOURNAL, journal } from './sync-journal.js';

const PEERS = 'syncPeers';

/**
 * تأخيرُ التجميع قبل رفعٍ تلقائيّ (بند ٨).
 *
 * ⚠️ **والكتابةُ المحلّيّة لا تنتظره أبدًا.** الصفُّ يُكتَب في IndexedDB
 *    فورًا وسطرُ السجلّ معه؛ وهذا المؤقّتُ يؤجّل **الرفع** وحدَه. فلو
 *    سقطت الشبكةُ أو Google كلُّه، لا يتأخّر حرفٌ تكتبه.
 */
const DEBOUNCE_MS = 8000;

const readUniverse = () => readInstall(INSTALL.UNIVERSE);
const writeUniverse = (value) => writeInstall(INSTALL.UNIVERSE, value || null);

/**
 * ينشئ منسّقًا فوق ناقلٍ بعينه.
 *
 * ⚠️ **والناقلُ يُحقَن ولا يُستورَد.** هذا هو ما يجعل الاختبارَ يشغّل
 *    المحاكيَ والتطبيقَ يشغّل Drive **بنفس السطور بالضبط** — لا مسارَ
 *    اختبارٍ يوازي مسارَ الإنتاج فيتفرّقان.
 */
export function createCloudSync(transport, {
  debounceMs = DEBOUNCE_MS,
  /**
   * رافعُ البايتات — يُحقَن كما يُحقَن الناقلُ تمامًا.
   *
   * ⚠️ **ويبقى اختياريًّا** كي لا ينكسر مُنشِئٌ قائمٌ في اختبارٍ يبني
   *    المنسّقَ وحدَه. وحين يغيب، الدورةُ كما كانت: سجلّاتٌ بلا بايتات.
   */
  uploader = null,
  /** أقصى ما يُرفَع من ملفّاتٍ في الدورة الواحدة. */
  mediaPerSync = 12,
} = {}) {
  assertTransport(transport);

  const machine = createStateMachine(SYNC.DISCONNECTED);
  let debounceTimer = null;
  let running = null;
  /** خطّةٌ تنتظر قرارَك — تُحفَظ لتعرضها الشاشةُ ثم تُطبَّق أو تُلقى. */
  let pendingPlan = null;
  let pendingPackages = [];
  let lastSyncAt = null;
  const opLog = [];

  /*
   * ⚠️ **وسطرٌ واحدٌ يذهب إلى مكانين — والدفترُ هو الذي يُقرأ.**
   *    `opLog` تاريخٌ قصيرٌ داخل هذا المنسّق تقرؤه `diagnostics()`،
   *    و`journal` دفترُ التطبيق كلِّه الذي يجمع الناقلَ والوسائطَ معه.
   *    فمن يقرأ `diagnostics` يرى ترتيبَ الدورة، ومن يقرأ الدفترَ يرى
   *    ما قاله Drive بين كلّ خطوتين.
   */
  const note = (event, detail = {}) => {
    opLog.push({ event, at: Date.now(), ...detail });
    if (opLog.length > 200) opLog.shift();
  };

  /* ---------------------------------------------------------------- *
   * حالةُ الجيران — تُقرأ وتُكتَب في مخزن WS-G نفسِه
   * ---------------------------------------------------------------- */

  const peerRows = () =>
    withTx(PEERS, 'readonly', (tx) => req(tx.objectStore(PEERS).getAll()));

  const savePeer = (id, patch) =>
    withTx(PEERS, 'readwrite', async (tx) => {
      const store = tx.objectStore(PEERS);
      const existing = (await req(store.get(id))) || {
        id, label: '', vector: {}, packagedVector: {}, ackedVector: {},
        lastPackageId: null, lastExchangeAt: null,
      };
      const row = { ...existing, ...patch, id, updatedAt: Date.now() };
      await req(store.put(row));
      return row;
    });

  /** المتّجهُ الذي يعرفه كلُّ جارٍ عنّا — أعلى ما أقرّ به أيٌّ منهم. */
  async function knownEverywhere() {
    const rows = await peerRows();
    const out = {};
    for (const row of rows) {
      for (const [device, seq] of Object.entries(row.ackedVector || {})) {
        out[device] = Math.max(out[device] ?? 0, Number(seq) || 0);
      }
    }
    return out;
  }

  /** هل عندنا ما لم يصل أحدًا؟ */
  async function localPending() {
    const [mine, known] = await Promise.all([
      withTx('changeLog', 'readonly', (tx) => vectorOf(tx)),
      knownEverywhere(),
    ]);
    let pending = 0;
    for (const [device, seq] of Object.entries(mine)) {
      pending += Math.max(0, Number(seq) - Number(known[device] ?? 0));
    }
    return { pending, vector: mine };
  }

  /* ---------------------------------------------------------------- *
   * الاتّصال
   * ---------------------------------------------------------------- */

  async function connect() {
    machine.to(SYNC.CONNECTING);
    try {
      const result = await transport.connect();
      machine.patch({ account: result?.account ?? null });

      /*
       * ⚠️ **وفحصُ الاسترجاع قبل أيّ تبادل** (بند P). لو دخلنا الخطَّ
       *    مباشرةً بعد استرجاعٍ قديم لَعادت الحالةُ الحديثة قبل أن
       *    تُسأل — وهو ما لا يُصلَح بعد وقوعه.
       */
      const replacement = await detectReplacement();
      if (replacement.replaced) {
        note('restore-detected', replacement);
        journal(JOURNAL.RESTORE_HOLD, { replaced: true });
        machine.to(SYNC.RESTORED_HOLD, { replacement });
        return machine.snapshot();
      }

      const { pending } = await localPending();
      machine.to(pending ? SYNC.LOCAL_PENDING : SYNC.READY, { pending });
      return machine.snapshot();
    } catch (error) {
      machine.to(stateForFailure(error), { error: describe(error) });
      return machine.snapshot();
    }
  }

  /**
   * فكُّ الارتباط (بند ٢٠ من WS-H).
   *
   * ⚠️ **ولا يمسّ بياناتك ولا هُويّةَ جهازك ولا ملفّاتِ Drive.** يعني
   *    شيئًا واحدًا: توقّف عن استعمال السحابة. وحذفُ ما في Drive فعلٌ
   *    آخرُ منفصلٌ لا يُدمَج مع هذا أبدًا.
   */
  async function disconnect() {
    clearTimeout(debounceTimer);
    await transport.disconnect().catch(() => {});
    machine.to(SYNC.DISCONNECTED, { account: null, pending: 0 });
    return machine.snapshot();
  }

  const stateForFailure = (error) => {
    const category = classify(error);
    if (category === FAIL.AUTH || category === FAIL.PERMISSION) return SYNC.AUTH_REQUIRED;
    if (category === FAIL.OFFLINE) return SYNC.OFFLINE;
    return SYNC.ERROR;
  };

  const describe = (error) => ({
    category: classify(error),
    message: error?.message || String(error),
  });

  /* ---------------------------------------------------------------- *
   * الكونُ السحابيّ
   * ---------------------------------------------------------------- */

  /**
   * يجد الكونَ أو ينشئه، ويكشف تبدُّلَه.
   *
   * ⚠️ **ولا يُدمَج كونان بصمت** (بند ٢١): لو كان هذا الجهازُ في كونٍ
   *    ووجد آخر — لأنك بدّلتَ حسابَ Google، أو لأن جهازًا اعتمد نسخةً
   *    مسترجَعة — فالسؤالُ يُطرَح ولا يُفتَرَض جواب.
   */
  async function ensureUniverse({ allowCreate = true } = {}) {
    const found = await transport.discover();
    const mine = readUniverse();

    if (!found.found) {
      if (!allowCreate) return { universeId: null, fresh: false, mismatch: false };
      const created = await transport.createUniverse();
      writeUniverse(created.universeId);
      note('universe-created', created);
      journal(JOURNAL.UNIVERSE, { created: true, universeId: created.universeId });
      return { universeId: created.universeId, fresh: true, mismatch: false };
    }

    if (mine && mine !== found.universeId) {
      return {
        universeId: found.universeId,
        fresh: false,
        mismatch: true,
        mine,
        supersededBy: found.supersededBy ?? null,
      };
    }

    if (!mine) writeUniverse(found.universeId);
    journal(JOURNAL.UNIVERSE, { found: true, universeId: found.universeId, joined: !mine });
    return { universeId: found.universeId, fresh: false, mismatch: false, joined: !mine };
  }

  /* ---------------------------------------------------------------- *
   * الدورة
   * ---------------------------------------------------------------- */

  /**
   * دورةٌ كاملة. **حتميّةٌ، وإعادتُها بلا تغييرٍ لا تفعل شيئًا** (بند ١١).
   *
   * @param {{ resolutions?: Array, force?: boolean }} options
   */
  async function syncNow({ resolutions = [], force = false } = {}) {
    if (running) return running;
    if (machine.state === SYNC.DISCONNECTED) {
      journal(JOURNAL.SYNC_SKIPPED, { why: 'غير متصل' });
      return { ok: false, reason: 'غير متصل' };
    }
    if (machine.state === SYNC.RESTORED_HOLD && !force) {
      return { ok: false, reason: 'المزامنة موقوفة بعد استرجاع — محتاجة قرارك', held: true };
    }

    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **وفحصُ الاسترجاع هنا أيضًا — لا في `connect` وحدَه**
     * ═══════════════════════════════════════════════════════════════
     *
     * كُتب الفحصُ أوّلَ مرّةٍ في `connect()` فقط، على افتراضٍ لم يُقَل
     * صراحةً: أن الاسترجاع يُتبَع دائمًا بإقلاعٍ جديدٍ فربطٍ جديد.
     * وأسقطه الاختبار: لو استُرجعت نسخةٌ **والجلسةُ قائمةٌ و`READY`**،
     * لم يكن شيءٌ يُعيد الفحص — فتمضي أوّلُ دورةٍ تلقائيّةٍ (أو ضغطةُ
     * «زامن الآن») إلى الدمج، فتعود الحالةُ الحديثة **وتُلغى النسخةُ
     * المسترجَعة في ثوانٍ، بصمت**. أي الكارثةُ نفسُها التي بُني
     * `restore-guard` لمنعها، من بابٍ آخر.
     *
     * ⚠️ **وقبل `SYNCING` لا بعدها**: الانتقالُ من حالةٍ ساكنةٍ إلى
     *    `RESTORED_HOLD` مسموح، ومن `SYNCING` ممنوع — ولا نوسّع جدولَ
     *    الحالات لنستوعب فحصًا كان مكانُه أبكر.
     */
    if (!force) {
      const replacement = await detectReplacement().catch(() => null);
      if (replacement?.replaced) {
        note('restore-detected', replacement);
        journal(JOURNAL.RESTORE_HOLD, { replaced: true });
        machine.to(SYNC.RESTORED_HOLD, { replacement });
        return {
          ok: false, held: true, replacement,
          reason: 'المزامنة موقوفة بعد استرجاع — محتاجة قرارك',
        };
      }
    }

    running = (async () => {
      const started = performance.now();
      const before = transport.stats();
      journal(JOURNAL.SYNC_START, {
        device: deviceId(), transport: transport.id, force,
        resolutions: resolutions.length,
      });
      machine.to(SYNC.SYNCING, { step: 'يتحقّق' });

      try {
        const universe = await ensureUniverse();
        if (universe.mismatch) {
          machine.to(SYNC.ERROR, {
            universeMismatch: universe,
            error: { category: FAIL.CONFLICT, message: 'الحساب ده فيه مجموعة مزامنة تانية' },
          });
          return { ok: false, universeMismatch: universe };
        }

        /* ---- ٣. نزّل ---- */
        machine.patch({ step: 'بيجيب التغييرات' });
        const outcome = await pullAndApply(resolutions);
        if (outcome.conflicts) {
          journal(JOURNAL.CONFLICT, { count: outcome.conflicts.length });
          machine.to(SYNC.CONFLICT, {
            conflicts: outcome.conflicts,
            step: null,
          });
          return { ok: false, conflicts: outcome.conflicts, plan: pendingPlan };
        }

        /* ---- ٦½. البايتاتُ قبل السجلّات ---- */
        const media = await pushMedia();

        /* ---- ٧. ارفع ---- */
        machine.patch({ step: 'بيرفع تغييراتك' });
        const pushed = await pushLocal();

        /* ---- ٨. نقاطُ التفتيش ---- */
        const { pending, vector } = await localPending();
        rememberVector(vector, { universe: universe.universeId });
        lastSyncAt = Date.now();

        const after = transport.stats();
        const ops = opDelta(before, after);
        const ms = Math.round(performance.now() - started);
        note('sync', { ops, ms });
        journal(JOURNAL.SYNC_END, {
          ms,
          apiCalls: ops.total || 0,
          ops,
          packagesApplied: outcome.applied.packages,
          uploadedPackage: Boolean(pushed.uploaded),
          changesPushed: pushed.changes || 0,
          mediaUploaded: media.uploaded,
          pendingAfter: pending,
        });

        machine.to(pending ? SYNC.LOCAL_PENDING : SYNC.READY, {
          pending, lastSyncAt, step: null, error: null,
          applied: outcome.applied, pushed, media,
        });

        return {
          ok: true, applied: outcome.applied, pushed, media, pending,
          ops, ms,
        };
      } catch (error) {
        note('sync-failed', describe(error));
        journal(JOURNAL.SYNC_FAILED, describe(error));
        machine.to(stateForFailure(error), { error: describe(error), step: null });
        return { ok: false, error: describe(error) };
      } finally {
        running = null;
      }
    })();

    return running;
  }

  /**
   * ينزّل الحزمَ البعيدةَ ويدمجها.
   *
   * ⚠️ **وحزمةٌ فاسدةٌ تُعزَل ولا تُوقف الباقي** (بند ٤٨): ملفٌّ واحدٌ
   *    تالفٌ على Drive لا يجوز أن يمنع وصولَ عشرةٍ سليمة. ولا يُقَرّ به
   *    مطبَّقًا أبدًا.
   */
  async function pullAndApply(resolutions) {
    const me = deviceId();
    const listed = await transport.listPackages({ exclude: me });
    const states = await transport.listDeviceStates();

    for (const { device, state } of states) {
      if (device === me) continue;
      await savePeer(device, {
        label: state?.label || '',
        vector: state?.vector || {},
        lastExchangeAt: Date.now(),
      });
    }

    const applied = { packages: 0, creates: 0, updates: 0, deletes: 0, quarantined: [] };

    journal(JOURNAL.PKG_DISCOVERED, {
      count: listed.length,
      peers: states.filter((s) => s.device !== me).length,
      /* أرقامُ التسلسل — وهي ما يُقارَن بين الجهازين حين يُشتبَه في فجوة. */
      seqs: listed.map((entry) => entry.seq ?? null).filter((s) => s !== null).slice(0, 20),
    });

    for (const entry of listed) {
      /* eslint-disable-next-line no-await-in-loop -- حزمةٌ بعد حزمةٍ عمدًا */
      const pkg = await transport.pullPackage(entry.fileId).catch((error) => {
        applied.quarantined.push({ fileId: entry.fileId, why: describe(error).message });
        journal(JOURNAL.PKG_QUARANTINED, { seq: entry.seq ?? null, why: 'التنزيل فشل' });
        return null;
      });
      if (!pkg) continue;

      journal(JOURNAL.PKG_DOWNLOADED, {
        from: pkg.sourceDeviceId,
        seq: entry.seq ?? pkg.maxSeq ?? null,
        changes: pkg.changes?.length ?? 0,
      });

      const inspection = inspectSyncPackage(pkg);
      if (!inspection.ok) {
        applied.quarantined.push({
          fileId: entry.fileId,
          why: inspection.issues.filter((i) => i.level === 'fatal').map((i) => i.message).join(' · '),
        });
        note('quarantined', { fileId: entry.fileId });
        continue;
      }

      /* eslint-disable-next-line no-await-in-loop */
      const plan = await planMerge(pkg);
      if (!plan.ok) {
        applied.quarantined.push({ fileId: entry.fileId, why: 'الخطّة غير صالحة' });
        continue;
      }

      for (const { id, resolution, value } of resolutions) {
        const conflict = plan.conflicts.find((c) => c.id === id);
        if (conflict) {
          conflict.resolution = resolution;
          conflict.resolvedValue = resolution === 'MANUAL_VALUE' ? value : undefined;
        }
      }

      if (!applicable(plan)) {
        /*
         * ⚠️ **ونقف عند أوّل خطّةٍ تحتاج قرارًا.** المضيُّ إلى الحزمة
         *    التالية يبني قرارَها على حالةٍ لم تُحسَم بعد — فتُعرَض
         *    عليك تعارضاتٌ قد تختفي بعد قرارك الأوّل.
         */
        pendingPlan = plan;
        pendingPackages = [pkg];
        return { conflicts: unresolved(plan), applied };
      }

      const hasWork = plan.creates.length || plan.updates.length || plan.deletes.length
        || plan.relationshipAdds.length || plan.relationshipRemoves.length
        || plan.entityCoalesces.length || plan.acceptedChanges.length;

      if (hasWork) {
        /* eslint-disable-next-line no-await-in-loop */
        await applyMerge(plan, { rebuild: runRebuilds });
        applied.creates += plan.creates.length;
        applied.updates += plan.updates.length;
        applied.deletes += plan.deletes.length;
        journal(JOURNAL.RECORDS_APPLIED, {
          from: pkg.sourceDeviceId,
          creates: plan.creates.length,
          updates: plan.updates.length,
          deletes: plan.deletes.length,
          relationships: plan.relationshipAdds.length + plan.relationshipRemoves.length,
        });
      } else {
        /*
         * ⚠️ **وحزمةٌ بلا عملٍ ليست عطبًا — هي دليلُ الحتميّة.**
         *    إعادةُ تطبيق حزمةٍ رأيناها من قبل تنتهي هنا: الخطّةُ خاليةٌ
         *    لأن المحرّكَ يعرف أن كلَّ تغييرٍ فيها مطبَّقٌ سلفًا. فهذا
         *    السطرُ هو ما يُقرأ حين يُسأل «هل تكرّرت السجلّات؟».
         */
        journal(JOURNAL.RECORDS_SKIPPED, {
          from: pkg.sourceDeviceId,
          why: 'كلُّ تغييراتها مطبَّقةٌ سلفًا',
          changes: pkg.changes?.length ?? 0,
        });
      }
      applied.packages += 1;

      /* eslint-disable-next-line no-await-in-loop */
      await savePeer(pkg.sourceDeviceId, {
        label: pkg.sourceDeviceLabel || '',
        vector: pkg.sourceVector || {},
        lastExchangeAt: Date.now(),
      });
    }

    pendingPlan = null;
    pendingPackages = [];
    return { conflicts: null, applied };
  }

  /**
   * يرفع بايتاتِ الوسائط التي لم تُرفَع بعد — **قبل** حزمةِ السجلّات.
   *
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **وهذه الخطوةُ كانت ناقصةً بالكامل، ولم يكشفها اختبار**
   * ═══════════════════════════════════════════════════════════════
   *
   * `media-upload.js` مكتوبٌ منذ WS-H وسليم، لكن **لم يكن يناديه إلّا
   * زرٌّ في `cloud-actions`**. أي أن الدورةَ التلقائيّة ترفع السجلّاتِ
   * وحدَها. فيصل الموبايلَ صفُّ تسجيلٍ صوتيّ كامل — اسمُه ومدّتُه
   * وارتباطُه بالجملة — ويضغط تشغيل، فيسأل Drive عن بايتاتٍ لم يضعها
   * أحدٌ هناك. وهو أسوأُ من ألّا يظهر الصفّ: وعدٌ مكتوبٌ بلا وفاء.
   *
   * ومرّت لأن الاختبارات كانت تنادي `uploadPending` **صراحةً** قبل أن
   * تتحقّق — فأثبتت أن الرافع يعمل، لا أن أحدًا يناديه.
   *
   * ⚠️ **والترتيب: البايتاتُ ثم السجلّ.** لو رفعنا الحزمةَ أوّلًا لَكان
   *    بين اللحظتين نافذةٌ يرى فيها الجارُ الصفَّ بلا بايتاته. وهي
   *    ثوانٍ، لكنها بالضبط الثواني التي يضغط فيها المستخدمُ «شغّل».
   *
   * ⚠️ **وبحدٍّ أعلى في الدورة الواحدة.** أربعون تسجيلًا في دورةٍ
   *    تلقائيّةٍ تحبس الشبكةَ دقائق؛ والباقي يلحق في الدورة التالية،
   *    و«نزّل كل الملفّات» يبقى للدفعات الكبيرة الصريحة.
   */
  async function pushMedia() {
    if (!uploader || mediaPerSync <= 0) return { uploaded: 0, skipped: 0, failed: 0, ran: false };

    /*
     * ⚠️ **ولا نداءَ شبكةٍ إن لم يكن ثمّة ما يُرفَع.** `pending()` قراءةٌ
     *    محلّيّةٌ بحتة، فالدورةُ الساكنة تخرج من هنا بصفر نداءات — وهو
     *    شرطُ «مزامنةٌ بلا تغييرٍ لا ترفع شيئًا» بحرفه.
     */
    const waiting = await uploader.pending().catch(() => []);
    if (!waiting.length) return { uploaded: 0, skipped: 0, failed: 0, ran: false };

    machine.patch({ step: 'بيرفع الملفّات' });
    journal(JOURNAL.MEDIA_HASH_WANTED, {
      waiting: waiting.length,
      limit: mediaPerSync,
      audio: waiting.filter((row) => row.kind === 'audio').length,
    });

    const report = await uploader.uploadPending({ limit: mediaPerSync }).catch((error) => {
      journal(JOURNAL.SYNC_FAILED, { at: 'media', ...describe(error) });
      return { uploaded: 0, skipped: 0, failed: 0, errors: [] };
    });

    journal(JOURNAL.MEDIA_UPLOADED, {
      uploaded: report.uploaded, skipped: report.skipped,
      failed: report.failed, bytes: report.bytes || 0,
      stoppedBy: report.stoppedBy || null,
    });
    return { ...report, ran: true };
  }

  /**
   * يرفع حزمةً بما لم يصل الجيران.
   *
   * ⚠️ **ولا يُرفَع شيءٌ إن لم يتغيّر شيء** (بند ٢٨). ومعرفةُ ذلك
   *    **محلّيّةٌ بالكامل** — مقارنةُ متّجهي: ما عندي وما أقرّوا به —
   *    فلا تكلّف نداءَ شبكةٍ واحدًا.
   */
  async function pushLocal() {
    const known = await knownEverywhere();
    const pkg = await createSyncPackage({ peerVector: known, peerId: null });
    if (!pkg.changes.length) {
      journal(JOURNAL.PKG_SKIPPED, { why: 'مفيش تغييرٌ لم يصل الجيران' });
      return { uploaded: false, changes: 0 };
    }

    pkg.maxSeq = Math.max(0, ...Object.values(pkg.sourceVector || {}).map(Number));
    const result = await transport.pushPackage(pkg);
    journal(JOURNAL.PKG_UPLOADED, {
      seq: pkg.maxSeq,
      changes: pkg.changes.length,
      deduped: Boolean(result.deduped),
    });

    await transport.pushDeviceState(deviceId(), {
      label: deviceLabel(),
      vector: pkg.sourceVector,
      at: Date.now(),
    });

    /*
     * ⚠️ **والإقرارُ هنا إقرارُ الناقل لا إقرارُ الجار** (بند ٦٨ من
     *    WS-G). «وصلت Drive» غيرُ «قرأها الموبايل». ونعامل الرفعَ
     *    الناجحَ معاملةَ التسليم **لأن Drive هو نقطةُ الالتقاء** —
     *    ومَن يقرأ منها يقرأ ما وصلها. وهذا هو الفرقُ بين ناقلٍ
     *    مركزيٍّ وتسليمٍ مباشرٍ بين جهازين.
     */
    for (const row of await peerRows()) {
      await savePeer(row.id, {
        packagedVector: pkg.sourceVector,
        ackedVector: pkg.sourceVector,
        lastPackageId: pkg.packageId,
        lastExchangeAt: Date.now(),
      });
    }
    if (!(await peerRows()).length) {
      await savePeer('CLOUD', {
        label: 'Drive',
        packagedVector: pkg.sourceVector,
        ackedVector: pkg.sourceVector,
        lastPackageId: pkg.packageId,
        lastExchangeAt: Date.now(),
      });
    }

    return { uploaded: true, changes: pkg.changes.length, fileId: result.fileId, deduped: result.deduped };
  }

  const opDelta = (before, after) => {
    const out = {};
    let total = 0;
    for (const [key, value] of Object.entries(after)) {
      const delta = value - (before[key] || 0);
      if (delta > 0) { out[key] = delta; total += delta; }
    }
    out.total = total;
    return out;
  };

  /* ---------------------------------------------------------------- *
   * التعارضاتُ المعلَّقة
   * ---------------------------------------------------------------- */

  /** الخطّةُ المنتظِرة — تقرؤها الشاشةُ ولا تكتب فيها. */
  const currentPlan = () => pendingPlan;

  /**
   * يُلغي المراجعةَ — **بلا كتابةٍ واحدة** (بند ١٣).
   *
   * ⚠️ والخطّةُ كائنٌ في الذاكرة لم يلمس القاعدة أصلًا، فالإلغاءُ
   *    نسيانُها. وهذه ليست حيلةً بل هي بنيةُ WS-G: التخطيطُ يقرأ ولا
   *    يكتب، والكتابةُ خطوةٌ واحدةٌ لاحقة.
   */
  function cancelConflicts() {
    pendingPlan = null;
    pendingPackages = [];
    machine.to(SYNC.LOCAL_PENDING, { conflicts: null });
    return machine.snapshot();
  }

  /** يطبّق الخطّةَ المعلَّقة بعد أن حُلّت تعارضاتُها. */
  async function applyPending() {
    if (!pendingPlan) return { ok: false, reason: 'لا توجد خطّةٌ منتظِرة' };
    if (!applicable(pendingPlan)) {
      return { ok: false, reason: 'لسه فيه تعارض محتاج قرارك', blocked: unresolved(pendingPlan) };
    }
    machine.to(SYNC.SYNCING, { step: 'بيطبّق قرارك' });
    const result = await applyMerge(pendingPlan, { rebuild: runRebuilds });
    for (const pkg of pendingPackages) {
      await savePeer(pkg.sourceDeviceId, {
        label: pkg.sourceDeviceLabel || '',
        vector: pkg.sourceVector || {},
        lastExchangeAt: Date.now(),
      });
    }
    pendingPlan = null;
    pendingPackages = [];
    machine.to(SYNC.LOCAL_PENDING, { conflicts: null, step: null });
    return { ok: true, result };
  }

  /* ---------------------------------------------------------------- *
   * ما بعد الاسترجاع
   * ---------------------------------------------------------------- */

  /** يُنفّذ قرارَك بعد اكتشاف استرجاع (بند P). */
  async function resolveRestore(choice) {
    if (machine.state !== SYNC.RESTORED_HOLD) {
      return { ok: false, reason: 'مفيش استرجاع منتظر' };
    }

    if (choice === 'LOCAL_ONLY') {
      await withTx(PEERS, 'readwrite', (tx) => req(tx.objectStore(PEERS).clear()));
      writeUniverse(null);
      forgetVector();
      await transport.disconnect().catch(() => {});
      machine.to(SYNC.DISCONNECTED, { replacement: null, account: null });
      return { ok: true, choice, left: true };
    }

    if (choice === 'ADOPT_EVERYWHERE') {
      const previous = readUniverse();
      const created = await transport.createUniverse({ supersedes: previous });
      if (previous && typeof transport.supersedeUniverse === 'function') {
        await transport.supersedeUniverse(created.universeId).catch(() => {});
      }
      writeUniverse(created.universeId);
      /*
       * ⚠️ **ونُنسى ما كان الجيرانُ يعرفونه.** الكونُ جديد، فحزمتُنا
       *    القادمة خطُّ أساسٍ كامل. وكلُّ جهازٍ آخر سيجد كونًا مختلفًا
       *    عن كونه فيُسأل — ولا يتبنّى شيئًا وحدَه.
       */
      await withTx(PEERS, 'readwrite', (tx) => req(tx.objectStore(PEERS).clear()));
      forgetVector();
      machine.to(SYNC.LOCAL_PENDING, { replacement: null, universe: created.universeId });
      return { ok: true, choice, universeId: created.universeId };
    }

    if (choice === 'RESUME_SYNC') {
      forgetVector();
      machine.to(SYNC.LOCAL_PENDING, { replacement: null });
      return { ok: true, choice };
    }

    return { ok: false, reason: `قرارٌ غير معروف: ${choice}` };
  }

  /* ---------------------------------------------------------------- *
   * الجدولة
   * ---------------------------------------------------------------- */

  /**
   * يُعلم المنسّقَ أن شيئًا تغيّر محلّيًّا (بند ٨).
   *
   * ⚠️ **ولا يُنادى من داخل الكتابة.** الكتابةُ تنتهي، ثم يُقال للمنسّق.
   *    فلو تعطّل هذا كلُّه، لا يتأخّر حفظُ حرفٍ واحد.
   */
  function markDirty() {
    if (!autoSyncAllowed(machine.state)) return;
    machine.to(SYNC.LOCAL_PENDING);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncNow().catch(() => {});
    }, debounceMs);
  }

  return {
    /* الحالة */
    subscribe: machine.subscribe.bind(machine),
    snapshot: machine.snapshot.bind(machine),
    get state() { return machine.state; },

    /* الاتّصال */
    connect, disconnect,
    device: localDevice,

    /* الدورة */
    syncNow, markDirty,

    /* التعارضات */
    currentPlan, cancelConflicts, applyPending,

    /* ما بعد الاسترجاع */
    resolveRestore,

    /* التشخيص (بند ٣٥) — بلا أسرار */
    async diagnostics() {
      const { pending, vector } = await localPending();
      return {
        device: localDevice(),
        state: machine.state,
        universe: readUniverse(),
        lastSyncAt,
        pendingChanges: pending,
        vector,
        peers: (await peerRows()).map((row) => ({
          id: row.id, label: row.label, lastExchangeAt: row.lastExchangeAt,
        })),
        unresolvedConflicts: pendingPlan ? unresolved(pendingPlan).length : 0,
        transport: transport.id,
        transportOps: transport.stats(),
        trail: machine.trail(),
        recent: opLog.slice(-20),
      };
    },
  };
}
