/**
 * LingoLife — لوحةُ التقدُّم (القاعدةُ العامّة للعمليّات الطويلة)
 *
 * ⚠️ **وما يُقاس هنا هو ما وعدت به القاعدةُ حرفًا بحرف:**
 *    أن اللوحةَ تبقى، وأن النسبةَ حقيقيّةٌ لا مُختلَقة، وأن الضغطةَ
 *    المزدوجةَ لا تشغّل العمليّةَ مرّتين، وأن «إلغاء» لا يظهر حيث لا
 *    يكون آمنًا.
 */

import { describe, it, expect } from './test-runner.js';
import { startProgress, withProgress, isRunning } from '../js/components/progress.js';

/** ينظّف ما بقي من لوحاتٍ بين الاختبارات. */
const sweep = () => {
  document.querySelectorAll('.pg-card').forEach((node) => node.remove());
};

/*
 * ⚠️ **واللوحةُ المغادِرةُ ليست اللوحةَ الحاليّة.**
 *    `close()` تضيف `pg-leaving` ثم تُزيل العنصرَ بعد الحركة. فلو
 *    أخذنا أوّلَ `.pg-card` لَقرأنا لوحةً في طريقها للخروج ونحن نسأل
 *    عن التي فُتحت للتوّ — وهو ما أسقط اختبارَ «إلغاء» أوّلَ مرّة.
 */
const card = () => {
  const all = [...document.querySelectorAll('.pg-card:not(.pg-leaving)')];
  return all[all.length - 1] || null;
};
const barFill = () => card()?.querySelector('.pg-bar > i');
const textOf = () => (card()?.textContent || '').replace(/\s+/g, ' ');

describe('لوحةُ التقدُّم · الأساس', () => {
  it('١ · تظهر فورًا وتحمل اسمَ العمليّة', () => {
    sweep();
    const bar = startProgress({ key: 't1', title: 'نسخة احتياطية' });
    expect(Boolean(card())).toBe(true);
    expect(textOf()).toContain('نسخة احتياطية');
    bar.close();
  });

  it('٢ · والنسبةُ تُحسَب من الأرقام الحقيقيّة لا من الوقت', () => {
    sweep();
    const bar = startProgress({ key: 't2', title: 'رفع' });
    bar.set({ done: 37, total: 91 });

    /* 37/91 = 40.6% → ٤١٪ */
    expect(textOf()).toContain('41%');
    expect(textOf()).toContain('37 / 91');
    expect(barFill().style.inlineSize).toBe('41%');
    bar.close();
  });

  it('٣ · والبايتاتُ تسبق عددَ الملفّات حين تُعرَف — لأنها أدقّ', () => {
    sweep();
    const bar = startProgress({ key: 't3', title: 'تنزيل' });
    /*
     * ملفّان من أربعة = ٥٠٪ بالعدّ. لكن البايتات تقول ١٠٪ — لأن
     * الملفَّين الأوّلين صغيران. والصادقُ هو البايتات.
     */
    bar.set({ done: 2, total: 4, bytes: 100, totalBytes: 1000 });
    expect(textOf()).toContain('10%');
    bar.close();
  });

  it('٤ · ⚠️ وبلا أرقامٍ لا تُختلَق نسبة — شريطٌ غيرُ محدَّدٍ ونصٌّ صريح', () => {
    sweep();
    const bar = startProgress({ key: 't4', title: 'ضغط' });
    bar.indeterminate('بيختم الملف…');

    expect(textOf()).toContain('بيختم الملف');
    /* ولا رقمَ مئويّ في أيّ موضع. */
    expect(/\d+%/.test(textOf())).toBe(false);
    expect(card().querySelector('.pg-bar.is-indef') !== null).toBe(true);
    bar.close();
  });

  it('٥ · والمراحلُ تُعرَض «٢ من ٤»', () => {
    sweep();
    const bar = startProgress({
      key: 't5', title: 'نسخة', stages: ['البيانات', 'الوسائط', 'الرفع', 'التحقّق'],
    });
    bar.stage('الوسائط');
    expect(textOf()).toContain('مرحلة 2 من 4');
    expect(textOf()).toContain('الوسائط');
    bar.close();
  });

  it('٦ · وتبديلُ المرحلة يصفّر عدّادَ السابقة فلا يُعرَض رقمٌ من مرحلةٍ ماضية', () => {
    sweep();
    const bar = startProgress({ key: 't6', title: 'نسخة', stages: ['أ', 'ب'] });
    bar.stage(0).set({ done: 9, total: 10 });
    expect(textOf()).toContain('90%');

    bar.stage(1);
    /* ⚠️ ولو بقي ٩٠٪ من المرحلة السابقة لَقرأ المستخدمُ تقدّمًا لم يحدث. */
    expect(/\d+%/.test(textOf())).toBe(false);
    bar.close();
  });
});

describe('لوحةُ التقدُّم · البقاءُ ومنعُ التكرار', () => {
  it('٧ · ⚠️ وتبقى بعد إعادة رسم الشاشة — لأنها على `body` لا داخلها', () => {
    sweep();
    const main = document.createElement('div');
    main.id = 'pg-fake-main';
    document.body.append(main);
    main.innerHTML = '<p>شاشة</p>';

    const bar = startProgress({ key: 't7', title: 'مزامنة' });
    bar.set({ done: 1, total: 3 });

    /* هذا بالضبط ما يفعله `refresh()` أثناء العمليّة. */
    main.innerHTML = '<p>شاشة اترسمت من أول وجديد</p>';

    expect(Boolean(card())).toBe(true);
    expect(textOf()).toContain('33%');
    bar.close();
    main.remove();
  });

  it('٨ · ⚠️ وضغطتان على نفس الزرّ = عمليّةٌ واحدة', () => {
    sweep();
    const first = startProgress({ key: 'dup', title: 'رفع' });
    const second = startProgress({ key: 'dup', title: 'رفع' });

    expect(Boolean(first)).toBe(true);
    /* الثانيةُ تُرفَض صراحةً — لا لوحةَ ثانيةٌ ولا نداءٌ ثانٍ. */
    expect(second).toBe(null);
    expect(document.querySelectorAll('.pg-card:not(.pg-leaving)').length).toBe(1);
    first.close();
  });

  it('٩ · و`withProgress` لا تشغّل الجسمَ مرّتين', async () => {
    sweep();
    let runs = 0;
    const slow = () => withProgress({ key: 'once', title: 'عمليّة' }, async (bar) => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 60));
      bar.done('تمّ');
      return 'ok';
    });

    const [a, b] = await Promise.all([slow(), slow()]);
    expect(runs).toBe(1);
    expect(a).toBe('ok');
    expect(b.skipped).toBe(true);
    sweep();
  });

  it('١٠ · وبعد الإغلاق يُسمَح بتشغيلها من جديد', () => {
    sweep();
    const bar = startProgress({ key: 'again', title: 'رفع' });
    expect(isRunning('again')).toBe(true);
    bar.close();
    expect(isRunning('again')).toBe(false);
    const next = startProgress({ key: 'again', title: 'رفع' });
    expect(Boolean(next)).toBe(true);
    next.close();
  });
});

describe('لوحةُ التقدُّم · النهاياتُ', () => {
  it('١١ · النجاحُ يبقى على الشاشة بتفاصيلَ مفيدة', () => {
    sweep();
    const bar = startProgress({ key: 'e1', title: 'نسخة' });
    bar.done('اترفعت «نسخة الخميس» · 12 م.ب');

    expect(textOf()).toContain('اترفعت');
    expect(textOf()).toContain('12 م.ب');
    expect(card().className).toContain('is-ok');
    /* ولا شريطَ بعد الانتهاء — الشريطُ يقول «شغّال». */
    expect(card().querySelector('.pg-bar')).toBe(null);
    sweep();
  });

  it('١٢ · والفشلُ يعرض «جرّب تاني» ويناديها فعلًا', () => {
    sweep();
    let retried = 0;
    const bar = startProgress({ key: 'e2', title: 'رفع' });
    bar.fail('الشبكة قطعت', { retry: () => { retried += 1; } });

    expect(card().className).toContain('is-failed');
    expect(textOf()).toContain('الشبكة قطعت');

    const button = [...card().querySelectorAll('button')]
      .find((b) => b.textContent.includes('جرّب تاني'));
    expect(Boolean(button)).toBe(true);
    button.click();
    expect(retried).toBe(1);
    sweep();
  });

  it('١٣ · وفشلٌ بلا إعادةٍ ممكنة لا يعرض زرًّا كاذبًا', () => {
    sweep();
    const bar = startProgress({ key: 'e3', title: 'استرجاع' });
    bar.fail('النسخة دي مش صالحة');

    const retry = [...card().querySelectorAll('button')]
      .find((b) => b.textContent.includes('جرّب تاني'));
    expect(retry === undefined).toBe(true);
    sweep();
  });

  it('١٤ · ⚠️ و«إلغاء» لا يظهر إلّا حيث الإلغاءُ آمن', () => {
    sweep();
    /* بلا `onCancel` — كاسترجاع النسخة. */
    const strict = startProgress({ key: 'c1', title: 'استرجاع' });
    const noCancel = [...card().querySelectorAll('button')]
      .find((b) => b.textContent.includes('إلغاء'));
    expect(noCancel === undefined).toBe(true);
    strict.close();

    /* ومع `onCancel` — كتنزيل الملفّات. */
    let cancelled = 0;
    const soft = startProgress({
      key: 'c2', title: 'تنزيل', onCancel: () => { cancelled += 1; },
    });
    const button = [...card().querySelectorAll('button')]
      .find((b) => b.textContent.includes('إلغاء'));
    expect(Boolean(button)).toBe(true);
    button.click();
    expect(cancelled).toBe(1);
    soft.close();
  });

  it('١٥ · والخطأُ داخل الجسم يُعرَض ولا يُبتلَع', async () => {
    sweep();
    let threw = false;
    try {
      await withProgress({ key: 'boom', title: 'عمليّة' }, async () => {
        throw new Error('حاجة وقعت');
      });
    } catch (error) {
      threw = true;
      expect(error.message).toBe('حاجة وقعت');
    }
    expect(threw).toBe(true);
    /* واللوحةُ تقول السببَ بدل أن تختفي بصمت. */
    expect(textOf()).toContain('حاجة وقعت');
    expect(card().className).toContain('is-failed');
    sweep();
  });
});

/* ================================================================== *
 * الحارسُ: لا عمليّةَ طويلةٌ تعود إلى إشعارٍ عابر
 * ================================================================== */

describe('القاعدةُ العامّة · حارسٌ بنيويّ', () => {
  const sourceOf = (path) => fetch(`../js/${path}`).then((r) => {
    if (!r.ok) throw new Error(`ملفٌّ غير موجود: ${path}`);
    return r.text();
  });

  const codeOf = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

  it('١٦ · ⚠️ ولا `toast` بمدّةٍ طويلةٍ بديلًا عن لوحة (BUSY)', async () => {
    /*
     * ⚠️ **والنمطُ الممنوعُ بعينه: `toast(..., { duration: BUSY })`.**
     *    كان هذا هو حيلةَ «إشعارٌ يعيش ٣٠ ثانية» في كلّ عمليّةٍ طويلة —
     *    وهو ما تمنعه القاعدةُ نصًّا: نصٌّ ثابتٌ بلا مرحلةٍ ولا رقمٍ ولا
     *    نهايةٍ واضحة. فمن احتاج بقاءً فليأخذ لوحة.
     */
    const offenders = [];
    for (const path of ['views/settings-view.js', 'views/cloud-actions.js']) {
      /* eslint-disable-next-line no-await-in-loop */
      const code = codeOf(await sourceOf(path));
      const hits = [...code.matchAll(/duration:\s*BUSY/g)];
      if (hits.length) offenders.push(`${path}: ${hits.length}`);
    }
    if (offenders.length) {
      throw new Error(`إشعارٌ طويلٌ بدل لوحة:\n${offenders.join('\n')}`);
    }
    expect(offenders.length).toBe(0);
  });

  it('١٧ · وكلُّ عمليّةٍ طويلةٍ تمرّ بـ`withProgress` بمفتاحٍ خاصٍّ بها', async () => {
    const wanted = [
      'backup-export', 'backup-restore',
      'cloud-sync', 'cloud-backup', 'cloud-restore',
      'cloud-download-all', 'cloud-upload-pending',
    ];
    const code = codeOf(await sourceOf('views/settings-view.js'))
      + codeOf(await sourceOf('views/cloud-actions.js'));

    const missing = wanted.filter((key) => !code.includes(`'${key}'`));
    if (missing.length) throw new Error(`عمليّاتٌ بلا لوحة: ${missing.join('، ')}`);
    expect(missing.length).toBe(0);

    /* ⚠️ والمفاتيحُ متمايزة — مفتاحان متطابقان يمنعان تشغيلَ الثاني بالخطأ. */
    expect(new Set(wanted).size).toBe(wanted.length);
  });

  it('١٨ · ⚠️ ولا نسبةٌ تُشتَقّ من الوقت في المكوِّن نفسِه', async () => {
    const code = codeOf(await sourceOf('components/progress.js'));
    /* لا مؤقّتَ يحرّك رقمًا، ولا `Date.now()` يدخل حسابَ نسبة. */
    expect(/setInterval/.test(code)).toBe(false);
    expect(/Date\.now\(\)[^;]*percent|percent[^;]*Date\.now\(\)/.test(code)).toBe(false);
    /* والنسبةُ من `done/total` وحدَها. */
    expect(code.includes('Math.round((done / total) * 100)')).toBe(true);
  });
});
