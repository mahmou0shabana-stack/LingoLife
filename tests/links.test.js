/**
 * LingoLife — اختبارات الربط
 *
 * ⚠️ **لماذا لم يكن لهذه الخدمة اختبارٌ واحد قبل اليوم؟** لا سبب —
 *    وقد كلّف ذلك: `unlink` كانت تنادي `relationships.remove`، ودالّةٌ
 *    بهذا الاسم **غير موجودة في المستودع أصلًا**. فكل إلغاء ربطٍ
 *    يرمي، ويُسقط معه `Promise.all` في نافذة الربط — فلا يُحفظ حتى ما
 *    أضفتَه في نفس الجلسة.
 *
 *    عاش العطب لأن الاختبارات تستورد الخدمات التي كُتبت لها اختبارات،
 *    وفحص رسم الوحدات يستورد الملفّ ولا ينادي دوالّه. **استيراد ملفّ
 *    ليس اختبارًا له.**
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { relationships, media, scripts } from '../js/db/repositories.js';
import { STATE, STORES } from '../js/db/schema.js';
import { runMigrations } from '../js/db/migrations.js';
import {
  LINK,
  link,
  unlink,
  linksOf,
  resolveLinks,
  unlinkAll,
} from '../js/services/link-service.js';

async function fresh() {
  await openDB();
  for (const row of await relationships.getAll()) await relationships.destroy(row.id);
}

/** وسيطٌ وسكريبتٌ حقيقيّان — `resolveLinks` تقرأ الكيانات لا المعرّفات. */
async function pair() {
  const audio = await media.create({
    kind: 'audio', filename: 'a.wav', blob: new Blob([new Uint8Array(8)]), tags: [],
  });
  const script = await scripts.create({ sceneId: 'SC_x', title: 'نصّ', text: 'Привет.' });
  return { audio, script };
}

describe('الربط — الأساس', () => {
  it('يربط طرفين ويجدهما من الاتجاهين', async () => {
    await fresh();
    const { audio, script } = await pair();
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);

    // الرابط يُخزَّن مرّة واحدة ويُسأل عنه من أي طرف — تخزينه مرّتين
    // يعني احتمال بقاء نصفه عند الحذف.
    expect((await linksOf(audio.id)).map((r) => r.otherId)).toContain(script.id);
    expect((await linksOf(script.id)).map((r) => r.otherId)).toContain(audio.id);
  });

  it('لا يُنشئ نسختين لنفس الزوج', async () => {
    await fresh();
    const { audio, script } = await pair();
    const a = await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    const b = await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    expect(a.id).toBe(b.id);
    expect((await linksOf(audio.id)).length).toBe(1);
  });

  it('ولا حتى لو عُكس الاتجاه', async () => {
    await fresh();
    const { audio, script } = await pair();
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    await link(script.id, audio.id, LINK.AUDIO_SCRIPT);
    expect((await linksOf(audio.id)).length).toBe(1);
  });

  it('يرفض ربط عنصر بنفسه', async () => {
    await fresh();
    const { audio } = await pair();
    expect(await link(audio.id, audio.id, LINK.AUDIO_SCRIPT)).toBe(null);
  });

  it('التصفية بالنوع تفصل الروابط المختلفة', async () => {
    await fresh();
    const { audio, script } = await pair();
    const image = await media.create({ kind: 'image', filename: 'p.png', blob: new Blob(['x']), tags: [] });
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    await link(audio.id, image.id, LINK.AUDIO_IMAGE);

    expect((await linksOf(audio.id)).length).toBe(2);
    expect((await linksOf(audio.id, LINK.AUDIO_SCRIPT)).map((r) => r.otherId)).toEqual([script.id]);
    expect((await linksOf(audio.id, LINK.AUDIO_IMAGE)).map((r) => r.otherId)).toEqual([image.id]);
  });

  it('يجلب الكيانات نفسها لا معرّفاتها', async () => {
    await fresh();
    const { audio, script } = await pair();
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);

    const resolved = await resolveLinks(audio.id, LINK.AUDIO_SCRIPT);
    expect(resolved.length).toBe(1);
    expect(resolved[0].entity.title).toBe('نصّ');
    expect(resolved[0].kind).toBe(LINK.AUDIO_SCRIPT);
  });
});

describe('الربط — فكّ الربط', () => {
  /*
   * ⚠️ **هذا هو الاختبار الذي كان غيابه يكلّف.** `unlink` كانت تنادي
   *    اسمًا لا وجود له، فترمي في كل مرّة.
   */
  it('يفكّ الرابط فعلًا ولا يرمي', async () => {
    await fresh();
    const { audio, script } = await pair();
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);

    expect(await unlink(audio.id, script.id, LINK.AUDIO_SCRIPT)).toBe(true);
    expect((await linksOf(audio.id)).length).toBe(0);
    // ولا يبقى السجلّ عالقًا في القاعدة: الرابط يُزال لا يُؤرشَف.
    expect((await relationships.getAll()).length).toBe(0);
  });

  it('يفكّ من الاتجاه المعكوس أيضًا', async () => {
    await fresh();
    const { audio, script } = await pair();
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    expect(await unlink(script.id, audio.id, LINK.AUDIO_SCRIPT)).toBe(true);
    expect((await linksOf(audio.id)).length).toBe(0);
  });

  it('فكّ رابطٍ غير موجود يعيد false ولا يرمي', async () => {
    await fresh();
    const { audio, script } = await pair();
    expect(await unlink(audio.id, script.id, LINK.AUDIO_SCRIPT)).toBe(false);
  });

  it('لا يفكّ نوعًا آخر بين نفس الطرفين', async () => {
    await fresh();
    const { audio, script } = await pair();
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    await unlink(audio.id, script.id, LINK.MEDIA_BLOCK);
    expect((await linksOf(audio.id)).length).toBe(1);
  });

  /*
   * سيناريو نافذة الربط بحرفه: تُبقي رابطًا، وتفكّ آخر، وتضيف ثالثًا —
   * كلها في `Promise.all` واحد. رميةٌ من أيٍّ منها كانت تُسقط الحفظ
   * كلّه، فلا يُحفظ حتى ما أضفتَه.
   */
  it('إضافةٌ وفكٌّ معًا في دفعة واحدة', async () => {
    await fresh();
    const { audio, script } = await pair();
    const other = await scripts.create({ sceneId: 'SC_x', title: 'تاني', text: 'Как дела.' });
    const third = await scripts.create({ sceneId: 'SC_x', title: 'تالت', text: 'Хорошо.' });

    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    await link(audio.id, other.id, LINK.AUDIO_SCRIPT);

    await Promise.all([
      link(audio.id, third.id, LINK.AUDIO_SCRIPT),   // جديد
      link(audio.id, script.id, LINK.AUDIO_SCRIPT),  // باقٍ كما هو
      unlink(audio.id, other.id, LINK.AUDIO_SCRIPT), // مفكوك
    ]);

    const ids = (await linksOf(audio.id)).map((r) => r.otherId).sort();
    expect(ids).toEqual([script.id, third.id].sort());
  });

  it('`unlinkAll` تُزيل كل روابط العنصر من الاتجاهين', async () => {
    await fresh();
    const { audio, script } = await pair();
    const image = await media.create({ kind: 'image', filename: 'p.png', blob: new Blob(['x']), tags: [] });
    await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    await link(image.id, audio.id, LINK.AUDIO_IMAGE);

    expect(await unlinkAll(audio.id)).toBe(2);
    expect((await linksOf(audio.id)).length).toBe(0);
    expect((await linksOf(image.id)).length).toBe(0);
  });
});

describe('الربط — `kind` هو الحقل («د-5»)', () => {
  it('السجل الجديد يحمل `kind` ولا يحمل `type`', async () => {
    await fresh();
    const { audio, script } = await pair();
    const row = await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    expect(row.kind).toBe(LINK.AUDIO_SCRIPT);
    // انتهت دورة الكتابة المزدوجة في ترقية v8.
    expect(row.type).toBe(undefined);
  });

  it('سجلٌّ قديم يحمل `type` وحده يبقى مقروءًا بعد الردم', async () => {
    await fresh();
    const { audio, script } = await pair();
    // نُعيد إنتاج سجلٍّ كُتب قبل v4: `type` بلا `kind`، ثم نردمه كما
    // تفعل الترقية. بدون الردم يصير غير مرئيّ للاستعلام الجديد.
    const legacy = await relationships.create({
      fromId: audio.id, toId: script.id, type: LINK.AUDIO_SCRIPT, note: '',
    });
    expect((await linksOf(audio.id, LINK.AUDIO_SCRIPT)).length).toBe(0);

    await relationships.update(legacy.id, { kind: legacy.type });
    expect((await linksOf(audio.id, LINK.AUDIO_SCRIPT)).length).toBe(1);
  });

  it('المؤرشف والمحذوف لا يظهران كروابط حيّة', async () => {
    await fresh();
    const { audio, script } = await pair();
    const row = await link(audio.id, script.id, LINK.AUDIO_SCRIPT);
    await relationships.update(row.id, { state: STATE.TRASHED });
    expect((await linksOf(audio.id)).length).toBe(0);
    expect((await linksOf(audio.id, LINK.AUDIO_SCRIPT)).length).toBe(0);
  });
});

/* ================================================================== *
 * ترقية v8 — الردم
 * ================================================================== */

const PROBE_DB = 'v8-links-migration-probe';

function wipeProbe() {
  return new Promise((done) => {
    const req = indexedDB.deleteDatabase(PROBE_DB);
    req.onsuccess = req.onerror = req.onblocked = done;
  });
}

function openAt(version, { bare = false } = {}) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(PROBE_DB, version);
    open.onupgradeneeded = (event) => {
      const db = open.result;
      const tx = open.transaction;
      if (event.oldVersion === 0 && bare) {
        // قاعدةٌ كما كانت قبل v8: فهارس `type` وحدها على العلاقات.
        for (const [name, def] of Object.entries(STORES)) {
          const skip = name === 'relationships';
          const store = db.createObjectStore(name, { keyPath: def.keyPath || 'id' });
          for (const [i, kp, o] of def.indexes || []) {
            if (skip && /kind/.test(i)) continue;
            store.createIndex(i, kp, o || {});
          }
        }
        return;
      }
      runMigrations(db, tx, event.oldVersion, version);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

describe('ترقية v8 — العلاقات', () => {
  it('تردم `kind` من `type` فيعود السجل القديم مرئيًّا', async () => {
    await wipeProbe();
    let db = await openAt(7, { bare: true });
    expect(db.transaction('relationships').objectStore('relationships')
      .indexNames.contains('from_kind')).toBe(false);

    await new Promise((res, rej) => {
      const tx = db.transaction('relationships', 'readwrite');
      const store = tx.objectStore('relationships');
      // ① سجلٌّ قديم جدًّا: `type` بلا `kind`.
      store.put({ id: 'R_old', fromId: 'A', toId: 'B', type: 'audio:script', state: 'active' });
      // ② سجلٌّ من دورة الكتابة المزدوجة: الاثنان معًا.
      store.put({ id: 'R_both', fromId: 'A', toId: 'C', type: 'audio:image', kind: 'audio:image', state: 'active' });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();

    db = await openAt(8);
    const store = db.transaction('relationships').objectStore('relationships');
    expect(store.indexNames.contains('from_kind')).toBe(true);
    expect(store.indexNames.contains('to_kind')).toBe(true);
    // الفهارس المهجورة تبقى: حذف فهرسٍ منشور ممنوع (§3.6).
    expect(store.indexNames.contains('from_type')).toBe(true);

    const rows = await new Promise((res, rej) => {
      const r = db.transaction('relationships').objectStore('relationships').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    // ③ القديم صار مقروءًا…
    expect(byId.get('R_old').kind).toBe('audio:script');
    // …و`type` **لم يُحذف منه**: حذف حقل من بيانات قائمة ترقيةٌ إتلافية.
    expect(byId.get('R_old').type).toBe('audio:script');
    // ④ ومَن كان سليمًا لم يُمَسّ.
    expect(byId.get('R_both').kind).toBe('audio:image');

    db.close();
    await wipeProbe();
  });
});
