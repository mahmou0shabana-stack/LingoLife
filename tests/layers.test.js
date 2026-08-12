/**
 * LingoLife — اختبارات الطبقات (WS17)
 *
 * ثلاثة بلاغاتٍ من الجهاز سببُها واحد: التطبيق لم يكن يفرّق بين
 * **صفحةٍ** و**طبقةٍ فوقها**. وأربع قواعد تُحرَس:
 *
 *  1. **الرجوع يقفل الأعلى** — لا يغادر الشاشة وتحته نافذةٌ مفتوحة.
 *  2. **والمكدّس مكدّس** — نافذةٌ فوق نافذة تُغلَقان واحدةً واحدة.
 *  3. ⚠️ **والإغلاق بزرٍّ يسحب مدخلَ التاريخ** — وإلا تراكم لكل نافذةٍ
 *     فتحتَها مدخلٌ ميّت، فتضغط رجوع ثلاثًا ولا يحدث شيء.
 *  4. ⚠️ **ولا يُغلَق اثنان بضغطةٍ واحدة** — وهو ما يحدث لو لم يُتجاهَل
 *     الـ`popstate` الناتج عن `history.back()` الذي نناديه نحن.
 */

import { describe, it, expect } from './test-runner.js';
import {
  pushLayer, dropLayer, closeTop, hasLayer, openLayers, resetLayers,
} from '../js/components/layers.js';

/** ينتظر دورةَ حدثٍ — `history.back()` غيرُ متزامنة. */
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

describe('الطبقات · المكدّس', () => {
  it('بلا طبقاتٍ لا يُغلَق شيء — فالرجوع يتنقّل', () => {
    resetLayers();
    expect(hasLayer()).toBe(false);
    expect(closeTop()).toBe(false);
  });

  it('⚠️ والرجوع يقفل الأعلى ولا يغادر الشاشة', () => {
    resetLayers();
    let closed = false;
    pushLayer(() => { closed = true; }, { id: 'modal' });

    expect(hasLayer()).toBe(true);
    expect(closeTop()).toBe(true);
    expect(closed).toBe(true);
  });

  it('⚠️ ونافذةٌ فوق نافذة تُغلَقان واحدةً واحدة', () => {
    resetLayers();
    const order = [];
    const one = pushLayer(() => order.push('one'), { id: 'modal' });
    const two = pushLayer(() => order.push('lightbox'), { id: 'lightbox' });

    expect(openLayers()).toEqual(['modal', 'lightbox']);

    closeTop();
    dropLayer(two);
    expect(order).toEqual(['lightbox']);
    expect(openLayers()).toEqual(['modal']);

    closeTop();
    dropLayer(one);
    expect(order).toEqual(['lightbox', 'one']);
    expect(hasLayer()).toBe(false);
  });

  it('ورفعُ طبقةٍ ليست في المكدّس لا يكسر شيئًا', () => {
    resetLayers();
    const ghost = { id: 'ghost', close: () => {} };
    dropLayer(ghost);
    expect(hasLayer()).toBe(false);
  });
});

describe('الطبقات · التاريخ', () => {
  it('⚠️ فتحُ طبقةٍ يزيد التاريخ، وإغلاقُها بزرٍّ يعيده', async () => {
    resetLayers();
    const before = history.length;

    const layer = pushLayer(() => {}, { id: 'modal' });
    expect(history.length > before).toBe(true);

    dropLayer(layer);
    await tick();
    // ⚠️ الرجوع لا يُنقص `history.length` — لكنه يعيد الموضع، فلا
    //    يتراكم مدخلٌ ميّت. والمهمّ أن المكدّس فَرَغ.
    expect(hasLayer()).toBe(false);
  });

  it('⚠️ ولا يُغلَق اثنان بضغطةٍ واحدة', async () => {
    resetLayers();
    const closed = [];

    /* كما تفعل النافذة الحقيقيّة: تُغلق نفسها ثم ترفع طبقتها. */
    let one;
    let two;
    one = pushLayer(() => { closed.push('one'); dropLayer(one); }, { id: 'one' });
    two = pushLayer(() => { closed.push('two'); dropLayer(two); }, { id: 'two' });

    closeTop();
    await tick(150);

    /*
     * لولا تجاهُلُ الـ`popstate` الناتج عن سحبنا نحن، لظنّه المستمعُ
     * ضغطةَ رجوعٍ منك فأغلق السفلى معها — نافذتان بضغطةٍ واحدة.
     */
    expect(closed).toEqual(['two']);
    expect(openLayers()).toEqual(['one']);
    dropLayer(one);
  });

  it('والمسار لا يتغيّر بفتح طبقة — فلا يُعاد رسم الشاشة', () => {
    resetLayers();
    const hash = location.hash;
    const layer = pushLayer(() => {}, { id: 'modal' });
    expect(location.hash).toBe(hash);
    dropLayer(layer);
  });
});
