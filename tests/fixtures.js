/**
 * LingoLife — توليد بيانات اختبار صناعية
 *
 * ⚠️ لماذا صناعية ولا نستخدم بياناتك الحقيقية؟
 *
 *    المستودع **عام**. أي صورة أو تسجيل يدخل git يبقى في تاريخه للأبد
 *    حتى لو حُذف الملف لاحقًا. فالملفات الذهبية هنا مُولَّدة بالكامل:
 *    صور PNG بحجم بضع بايتات، وصوت وهمي، ونصوص مخترعة.
 *
 *    نسختك الحقيقية (`LingoLife-real.llife`) مكانها `.gitignore` والدرايف،
 *    وتُستخدم للاختبار اليدوي على حجم واقعي.
 *
 * راجع docs/07-backup-format.md §7.9
 */

import { newId, PREFIX } from '../js/utils/ids.js';

/** أصغر PNG صالح: بكسل واحد بلون محدّد. */
export function tinyPng(r = 200, g = 60, b = 120) {
  // نبنيه يدويًا لأن OffscreenCanvas غير متاح في كل بيئات الاختبار.
  const chunk = (type, data) => {
    const typeBytes = new TextEncoder().encode(type);
    const body = new Uint8Array(typeBytes.length + data.length);
    body.set(typeBytes, 0);
    body.set(data, typeBytes.length);

    const out = new Uint8Array(8 + data.length + 4);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length, false);
    out.set(body, 4);
    view.setUint32(out.length - 4, crc(body), false);
    return out;
  };

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc(bytes) {
    let c = 0xffffffff;
    for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)) >>> 0;
    return (c ^ 0xffffffff) >>> 0;
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, 1, false); // العرض
  ihdrView.setUint32(4, 1, false); // الارتفاع
  ihdr[8] = 8; // عمق البت
  ihdr[9] = 2; // RGB
  // خام مضغوط بـ zlib بلا ضغط فعلي (كتلة store)
  const rawRow = new Uint8Array([0, r, g, b]);
  const zlib = new Uint8Array(2 + 5 + rawRow.length + 4);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  zlib[2] = 0x01; // كتلة أخيرة بلا ضغط
  zlib[3] = rawRow.length & 0xff;
  zlib[4] = (rawRow.length >> 8) & 0xff;
  zlib[5] = ~rawRow.length & 0xff;
  zlib[6] = (~rawRow.length >> 8) & 0xff;
  zlib.set(rawRow, 7);
  // adler-32
  let a = 1;
  let b2 = 0;
  for (const byte of rawRow) {
    a = (a + byte) % 65521;
    b2 = (b2 + a) % 65521;
  }
  new DataView(zlib.buffer).setUint32(7 + rawRow.length, ((b2 << 16) | a) >>> 0, false);

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [signature, chunk('IHDR', ihdr), chunk('IDAT', zlib), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return new Blob([out], { type: 'image/png' });
}

/** بايتات صوت وهمية بحجم محدّد — المحتوى غير مهمّ، البقاء هو المهم. */
export function fakeAudio(bytes = 2048) {
  const data = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) data[i] = (i * 31 + 7) % 256;
  return new Blob([data], { type: 'audio/webm' });
}

const now = Date.now();

function base(id) {
  return { id, createdAt: now, updatedAt: now, rev: 1, state: 'active', deletedAt: null, dirty: 1 };
}

/**
 * يبني عالمًا صغيرًا لكنه كامل الروابط: مشاهد، وسائط مرتبطة، سكريبتات،
 * محادثة، تعبيرات بظهورات، ومقارنة خطأ/طبيعي.
 */
export function buildFixtureWorld({ scenes = 3, mediaPerScene = 2 } = {}) {
  const world = {
    scenes: [],
    media: [],
    mediaBlobs: new Map(),
    sceneMediaLinks: [],
    scripts: [],
    contentBlocks: [],
    conversations: [],
    conversationParts: [],
    expressions: [],
    expressionOccurrences: [],
    mistakeComparisons: [],
    people: [],
    places: [],
    settings: {
      'ui.theme': 'light',
      'ui.lastScene': null,
      'storage.persistRequested': { at: now, granted: true },
    },
  };

  const person = { ...base(newId(PREFIX.PERSON)), name: 'Дмитрий', role: 'زميل' };
  const place = { ...base(newId(PREFIX.PLACE)), name: 'مكتب الشركة' };
  world.people.push(person);
  world.places.push(place);

  const expression = {
    ...base(newId(PREFIX.EXPRESSION)),
    text: 'спасибо большое',
    meaningAr: 'شكرًا جزيلًا',
    register: 'neutral',
    masteryState: 'learning',
  };
  world.expressions.push(expression);

  for (let s = 0; s < scenes; s++) {
    const scene = {
      ...base(newId(PREFIX.SCENE)),
      titleAr: `مشهد اختبار ${s + 1}`,
      titleRu: `Тестовая сцена ${s + 1}`,
      date: new Date(now - s * 86400000).toISOString().slice(0, 10),
      type: 'work',
      placeId: place.id,
      context: 'سياق مُولَّد للاختبار — مش بيانات حقيقية.',
    };
    world.scenes.push(scene);

    world.contentBlocks.push({
      ...base(newId(PREFIX.BLOCK)),
      sceneId: scene.id,
      kind: 'rawTranscript',
      text: `Привет! Это тест номер ${s + 1}. مرحبًا.`,
    });

    const script = {
      ...base(newId(PREFIX.SCRIPT)),
      sceneId: scene.id,
      type: 'clean',
      isPrimary: 1,
      text: `Сценарий ${s + 1}`,
    };
    world.scripts.push(script);

    const conversation = { ...base(newId(PREFIX.CONVERSATION)), sceneId: scene.id };
    world.conversations.push(conversation);
    world.conversationParts.push({
      ...base(newId(PREFIX.CONV_PART)),
      conversationId: conversation.id,
      sceneId: scene.id,
      personId: person.id,
      order: 0,
      speaker: 'other',
      text: 'Спасибо большое!',
    });

    world.expressionOccurrences.push({
      ...base(newId(PREFIX.OCCURRENCE)),
      expressionId: expression.id,
      sceneId: scene.id,
      occurredAt: now - s * 86400000,
      kind: 'heard',
    });

    world.mistakeComparisons.push({
      ...base(newId(PREFIX.MISTAKE)),
      sceneId: scene.id,
      expressionId: expression.id,
      before: 'Спасибо большой',
      natural: 'Спасибо большое',
      mistakeType: 'agreement',
      explanationAr: 'الصفة لازم توافق المؤنث.',
    });

    for (let m = 0; m < mediaPerScene; m++) {
      const isAudio = m % 2 === 1;
      const id = newId(PREFIX.MEDIA);
      const blob = isAudio ? fakeAudio(1024 * (m + 1)) : tinyPng(60 * s, 90 * m, 200);
      const thumb = isAudio ? null : tinyPng(10, 10, 10);

      world.media.push({
        ...base(id),
        kind: isAudio ? 'audio' : 'image',
        mime: blob.type,
        filename: isAudio ? `تسجيل-${s}-${m}.weba` : `صورة-${s}-${m}.png`,
        bytes: blob.size,
        width: isAudio ? null : 1,
        height: isAudio ? null : 1,
        durationMs: isAudio ? 1500 : null,
        contentHash: null,
      });
      world.mediaBlobs.set(id, { blob, thumb });

      world.sceneMediaLinks.push({
        ...base(newId(PREFIX.LINK)),
        sceneId: scene.id,
        mediaId: id,
        order: m,
        roles: m === 0 ? ['cover'] : ['timeline'],
      });
    }
  }

  return world;
}
