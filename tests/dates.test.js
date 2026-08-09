/**
 * LingoLife — التواريخ
 *
 * ⚠️ لماذا ملفٌّ كامل لدالّة صغيرة؟ لأن `parseISODate` تحت **كل** عرض
 *    تاريخ في التطبيق: عنوان الذكرى، وشهر الخطّ الزمني، والتاريخ
 *    النسبي. سقوطها لا يُخفي تاريخًا — يُسقط الشاشة كلها.
 *
 *    وقد سقطت فعلًا: ترويسة الوحدة تقول إن التخزين «ISO **أو** طابع
 *    زمني رقمي»، بينما الدالّة تنادي `.split` على المدخل مباشرةً. رقمٌ
 *    في `scene.date` — من استيراد أو من نسخةٍ مسترجَعة — كان يعطي
 *    `iso.split is not a function` وشاشة ذكرى فارغة.
 */

import { describe, it, expect } from './test-runner.js';
import {
  parseISODate,
  toISODate,
  formatDate,
  formatMonth,
  monthKey,
  today,
} from '../js/utils/dates.js';

describe('التواريخ — ما تقبله الدالّة', () => {
  it('نصّ ISO عادي', () => {
    const d = parseISODate('2026-05-29');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(29);
  });

  it('نصّ ISO بجزء وقت يُقصّ إلى يومه', () => {
    const d = parseISODate('2026-05-29T22:15:00Z');
    expect(d.getDate()).toBe(29);
    expect(d.getMonth()).toBe(4);
  });

  it('طابع زمني رقمي — وهو ما كان يُسقط الشاشة', () => {
    const ts = new Date(2026, 4, 29, 13, 40).getTime();
    const d = parseISODate(ts);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(29);
    // دالّة **يوم** لا لحظة: الوقت يُسقَط.
    expect(d.getHours()).toBe(0);
  });

  it('كائن Date يمرّ كما هو', () => {
    const src = new Date(2026, 0, 3);
    expect(parseISODate(src).getTime()).toBe(src.getTime());
  });

  it('الفارغ والخاطئ يعودان null لا استثناءً', () => {
    expect(parseISODate(null)).toBe(null);
    expect(parseISODate('')).toBe(null);
    expect(parseISODate('مش تاريخ')).toBe(null);
    expect(parseISODate(NaN)).toBe(null);
    expect(parseISODate({})).toBe(null);
    expect(parseISODate(new Date('x'))).toBe(null);
  });
});

describe('التواريخ — العرض لا ينكسر', () => {
  const ts = new Date(2026, 4, 29).getTime();

  it('التاريخ الكامل واحدٌ للصيغتين', () => {
    expect(formatDate(ts)).toBe(formatDate('2026-05-29'));
    expect(formatDate('2026-05-29')).toBe('29 مايو 2026');
  });

  it('عنوان الشهر واحدٌ للصيغتين', () => {
    expect(formatMonth(ts)).toBe('مايو 2026');
  });

  it('المدخل الخاطئ يعطي نصًّا فارغًا لا استثناءً', () => {
    expect(formatDate(null)).toBe('');
    expect(formatMonth('مش تاريخ')).toBe('');
  });
});

describe('التواريخ — مفتاح الشهر', () => {
  it('يجمع الصيغتين في نفس المجموعة', () => {
    // ⚠️ `slice(0,7)` على رقمٍ كانت تعطي مفتاحًا لا يقابل أي شهر،
    //    فتنشأ في «حياتي» مجموعةٌ بعنوانٍ فارغ لا تفسّر نفسها.
    expect(monthKey(new Date(2026, 4, 29).getTime())).toBe('2026-05');
    expect(monthKey('2026-05-29')).toBe('2026-05');
  });

  it('المدخل الخاطئ يعطي فارغًا فيقع في «غير مؤرَّخ»', () => {
    expect(monthKey(null)).toBe('');
    expect(monthKey('مش تاريخ')).toBe('');
  });
});

describe('التواريخ — التطبيع', () => {
  it('يعيد كل مدخل مقبول إلى صيغة التخزين', () => {
    expect(toISODate(new Date(2026, 4, 9).getTime())).toBe('2026-05-09');
    expect(toISODate('2026-05-09T10:00:00Z')).toBe('2026-05-09');
    expect(toISODate('2026-05-09')).toBe('2026-05-09');
  });

  it('تاريخ اليوم يمرّ بالدورة كاملة بلا تبدّل', () => {
    expect(toISODate(today())).toBe(today());
  });
});
