#!/usr/bin/env bash
#
# LingoLife — ضمّ pdf.js (عارضُ ملخّص القواعد الشخصيّ، WS-B)
#
#   bash scripts/vendor-pdfjs.sh [version]
#
# ⚠️ **وهذا السكربتُ للترقية لا للتثبيت.** بخلاف Tesseract وPiper،
#    ملفّاتُ pdf.js **مدفوعةٌ في git** — راجع الاستثناء في `.gitignore`
#    و`vendor/pdfjs/README.md`. فالنسخةُ في المستودع تكفي للعمل، وهذا
#    السكربتُ يجلب نسخةً أحدث حين تُقرّر الترقية.
#
# ⚠️ **ولا تُرقِّ بلا قياس.** 6.2.108 تفتح الملفَّ وتقرأ عددَ صفحاته ثم
#    تسقط عند أوّل رسمة على كروم اليوم:
#      TypeError: this[#Ra].getOrInsertComputed is not a function
#    فبعد النسخ: افتح ملفًّا حقيقيًّا في تبويب «الملخّص» وتأكّد أن
#    **الصفحة تُرسَم** — لا أن الملفّ «فُتح».

set -euo pipefail

VERSION="${1:-4.10.38}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/pdfjs"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "── pdfjs-dist $VERSION ──"
curl -sSfL -o "$TMP/pdfjs.tgz" \
  "https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${VERSION}.tgz"
tar xzf "$TMP/pdfjs.tgz" -C "$TMP"

mkdir -p "$DEST/standard_fonts"
cp "$TMP/package/build/pdf.min.mjs"        "$DEST/pdf.mjs"
cp "$TMP/package/build/pdf.worker.min.mjs" "$DEST/pdf.worker.mjs"
cp "$TMP/package/LICENSE"                  "$DEST/LICENSE"

# الخطوطُ القياسيّة: ملفٌّ لا يُضمّن Helvetica لا يُرسَم نصُّه بدونها.
rm -f "$DEST/standard_fonts/"*
cp "$TMP"/package/standard_fonts/* "$DEST/standard_fonts/"

# ⚠️ و`cmaps/` **لا تُنسَخ عمدًا**: 1.1 م.ب من ترميزات CJK لا يمسّها
#    ملخّصٌ عربيٌّ/روسيّ. حدٌّ معلومٌ مكتوبٌ في README.

echo "  ✓ $(du -sh "$DEST" | cut -f1)"
echo
echo "حدِّث الجدولَ في vendor/pdfjs/README.md بالإصدار الجديد،"
echo "ثم افتح ملفًّا حقيقيًّا وتأكّد أن الصفحة تُرسَم."
