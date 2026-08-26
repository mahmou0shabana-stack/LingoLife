/**
 * LingoLife — محلّلُ المتحدّثين (WS-F · بنود ٣٦…٤١ و٦٨ و٦٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **نموذجُ عرضٍ لا نوعُ محتوًى** (بند ٣٦)
 * ═══════════════════════════════════════════════════════════════
 *
 * «Speaker 1:» و«Speaker 2:» بنيةٌ **داخل** النصّ، لا بنيةٌ **فوقه**.
 * فلا مخزنَ جديدًا، ولا عقدةَ شجرةٍ لكلّ دور (بند ٦٩): النصُّ المخزَّن
 * يبقى حرفًا بحرف، وهذه الدالّةُ تصف كيف يُرسَم لا ماذا يُحفَظ.
 *
 * ⚠️ **ولا تعديلَ للمخزَّن أبدًا** (بند ٤١): التبديلُ بين «نصّ» و
 *    «محادثة» تبديلُ عدسةٍ لا تبديلُ بيانات. ولو أعاد الرسمُ كتابةَ
 *    النصّ لَما أمكنك أبدًا أن ترى ما لصقتَه فعلًا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والدَّورُ يمتدّ حتى المتحدّث التالي** (بند ٣٩)
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا هو البندُ الحامل. فقراتٌ كثيرةٌ بعد «Speaker 1:» كلُّها له:
 *
 *     Speaker 1: نبدأ...
 *
 *     Упаковка يعني...
 *     Защитная...
 *
 *     Speaker 2: ...
 *
 * فرضُ «كلُّ سطرٍ دورٌ» يقطّع شرحًا متّصلًا إلى فقاعاتٍ لا تُقرَأ.
 */

/**
 * صيغُ إعلان المتحدّث المقبولة.
 *
 * ⚠️ **ولا يُخترَع «راوٍ»** (بند ٤٠): ما لا يحمل علامةً صريحةً ينتمي
 *    للمتحدّث الفعّال، وما قبل أوّلِ علامةٍ يبقى تمهيدًا بلا اسم.
 *    اختراعُ متحدّثٍ لم تكتبه نسبةُ قولٍ إلى من لم يقله.
 */
const SPEAKER_RE = new RegExp(
  '^[ \\t>*_-]*'
  + '(?:speaker|спикер|говорящий|المتحدث|المتحدّث|متحدث|متحدّث)'
  + '[ \\t]*([0-9٠-٩]{1,2})[ \\t]*[:：\\-—–][ \\t]*(.*)$',
  'i'
);

/**
 * «س١:» و«A:» و«B:» — صيغٌ قصيرةٌ شائعةٌ في التفريغ.
 *
 * ⚠️ **ولا رقمَ عاريًا هنا.** أوّلُ صياغةٍ قبلت «1:» و«2:»، وهي صيغةُ
 *    **قائمةٍ مرقّمة** قبل أن تكون صيغةَ متحدّث. نصٌّ فيه:
 *
 *        1: افتح الكرتونة
 *        2: افحص السيليكاجيل
 *
 *    كان يصير «محادثةً» من متحدّثَين — وهو زخرفةٌ فوق معنًى غير موجود.
 *    فالرقمُ يحتاج كلمةً قبله («س»/«speaker»)، والحرفُ وحدَه مقبولٌ
 *    لأنّ «A:» في أوّل السطر لا تكون قائمةً مرقّمة.
 */
const SHORT_RE = /^[ \t>*_-]*(?:(?:س|s|speaker)[ \t]*([١٢٣12345])|([AB]))[ \t]*[:：][ \t]*(.*)$/i;

const NUM = { '١': '1', '٢': '2', '٣': '3', '٤': '4', A: '1', a: '1', B: '2', b: '2' };
const normNumber = (raw) => NUM[raw] || String(raw).replace(/[٠-٩]/g, (d) => String(d.codePointAt(0) - 0x0660));

/**
 * هل يفتح هذا السطرُ دورَ متحدّث؟
 * @returns {{ speaker: string, rest: string }|null}
 */
export function speakerAt(line) {
  const hit = SPEAKER_RE.exec(line);
  if (hit) return { speaker: normNumber(hit[1]), rest: hit[2] };

  /*
   * ⚠️ **والصيغةُ القصيرةُ مشروطةٌ بقِصَر السطر.** «B: 12 كرتونة» نعم،
   *    أمّا سطرٌ طويلٌ فيه نقطتان في وسطه فنصٌّ عاديّ. وبلا هذا الشرط
   *    كان كلُّ سطرٍ فيه «:» يصير دورًا.
   */
  const short = SHORT_RE.exec(line);
  if (short) return { speaker: normNumber(short[1] || short[2]), rest: short[3] };
  return null;
}

/**
 * هل يبدو هذا النصُّ محادثةً؟ — شرطُ إتاحةِ تبويب «محادثة» (بند ٩٧).
 *
 * ⚠️ **ومتحدّثٌ واحدٌ ليس محادثة.** نصٌّ فيه «Speaker 1:» مرّةً واحدةً
 *    شرحٌ لا حوار، ورسمُه فقاعاتٍ يزيّن بلا فائدة. فالشرطُ **دوران
 *    اثنان على الأقلّ**.
 */
export function looksLikeDialogue(text) {
  const turns = parseDialogue(text);
  return turns.filter((t) => t.speaker).length >= 2;
}

/**
 * يقسّم نصًّا إلى أدوارٍ متتابعة.
 *
 * @param {string} text
 * @returns {{ speaker: string|null, lines: string[], text: string }[]}
 *          `speaker: null` للتمهيد الذي يسبق أوّلَ علامة.
 */
export function parseDialogue(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const turns = [];
  let current = null;

  for (const line of lines) {
    const hit = speakerAt(line);
    if (hit) {
      current = { speaker: hit.speaker, lines: [] };
      if (hit.rest.trim()) current.lines.push(hit.rest);
      turns.push(current);
      continue;
    }
    /*
     * ⚠️ **وهنا يعيش البندُ ٣٩.** السطرُ بلا علامةٍ ينضمّ للدور الفعّال
     *    مهما تباعدت الفقرات، ولا يفتح دورًا جديدًا أبدًا.
     */
    if (!current) {
      if (!turns.length || turns[0].speaker !== null) turns.unshift({ speaker: null, lines: [] });
      turns[0].lines.push(line);
      continue;
    }
    current.lines.push(line);
  }

  return turns
    .map((turn) => ({ ...turn, text: turn.lines.join('\n').trim() }))
    .filter((turn) => turn.text || turn.speaker);
}

/**
 * أسماءُ المتحدّثين الظاهرة — لتلوينٍ ثابتٍ لا عشوائيّ (بند ٣٨).
 *
 * ⚠️ والهُويّةُ بالرقم لا بالترتيب: «المتحدث ٢» يأخذ لونَه هو حتى لو
 *    كان أوّلَ من تكلّم في هذه العقدة.
 */
export function speakersIn(text) {
  return [...new Set(parseDialogue(text).map((t) => t.speaker).filter(Boolean))].sort();
}

/**
 * ⚠️ **حارسُ عدمِ فقدان الحرف** — يُستعمَل في الاختبار لا في الواجهة.
 *
 * كلُّ ما ليس علامةَ متحدّثٍ يجب أن يظهر في أدوارٍ. والعلامةُ نفسُها
 * (`Speaker 1:`) تُستهلَك عمدًا، لأنها إعلانٌ لا محتوى.
 */
export function dialogueAccounting(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  const turns = parseDialogue(source);
  const kept = turns.map((t) => t.text).join('\n');
  const strip = (s) => s.replace(/\s+/g, '');
  const markers = source.split('\n').filter((l) => speakerAt(l)).length;
  return {
    markers,
    sourceChars: strip(source.split('\n').map((l) => {
      const hit = speakerAt(l);
      return hit ? hit.rest : l;
    }).join('\n')).length,
    keptChars: strip(kept).length,
  };
}
