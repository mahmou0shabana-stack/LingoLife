#!/usr/bin/env bash
#
# LingoLife — ضمّ Tesseract للمستودع ليعمل استخراج النصّ بلا إنترنت
#
# الملفات ~20MB ولذلك ليست في git افتراضيًا. شغّل السكربت مرّة واحدة
# ثم ادفع النتيجة، فيصير OCR يعمل offline على كل جهاز.
#
#   bash scripts/vendor-tesseract.sh
#
# بدونه يظلّ OCR يعمل — لكن عبر CDN، أي بحاجة إلى شبكة عند أوّل تحميل.
# راجع docs/08-shadowing.md §8.9

set -euo pipefail

VERSION="5.1.1"
DEST="$(cd "$(dirname "$0")/.." && pwd)/vendor/tesseract"

mkdir -p "$DEST"
cd "$DEST"

echo "بيتنزّل في: $DEST"
echo

fetch() {
  local url="$1" name="$2"
  echo -n "  $name … "
  if curl -sSfL --max-time 300 -o "$name" "$url"; then
    echo "✓ $(du -h "$name" | cut -f1)"
  else
    echo "✗ فشل"
    return 1
  fi
}

fetch "https://unpkg.com/tesseract.js@${VERSION}/dist/tesseract.min.js"            "tesseract.min.js"
fetch "https://unpkg.com/tesseract.js@${VERSION}/dist/worker.min.js"               "worker.min.js"
fetch "https://unpkg.com/tesseract.js-core@${VERSION}/tesseract-core-simd.wasm.js" "tesseract-core-simd.wasm.js"
fetch "https://unpkg.com/tesseract.js-core@${VERSION}/tesseract-core.wasm.js"      "tesseract-core.wasm.js"

# بيانات اللغة — الروسية أساسية، والإنجليزية تفيد النصوص المختلطة.
fetch "https://tessdata.projectnaptha.com/4.0.0/rus.traineddata.gz" "rus.traineddata.gz"
fetch "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz" "eng.traineddata.gz"

echo
echo "الإجمالي: $(du -sh "$DEST" | cut -f1)"
echo
echo "دلوقتي:"
echo "  git add vendor/tesseract && git commit -m 'ضمّ Tesseract للعمل بلا إنترنت'"
echo
echo "⚠️ الملفات دي كبيرة وهتفضل في تاريخ git للأبد. لو مش عايزها،"
echo "   سيبها وOCR هيشتغل من CDN بإنترنت."
