#!/usr/bin/env bash
#
# LingoLife — ضمّ Piper (ONNX Runtime Web + نموذج صوتٍ روسيّ) محلّيًّا
#
# ⚠️ **لم يُشغَّل هذا السكربت كاملًا داخل بيئة التطوير التي كُتب فيها.**
#    onnxruntime-web وُثِّق مسبقًا (npm متاحة هناك) — يقتصر عملُ هذا
#    السكربت على الجزء الذي لم يكن ممكنًا: تنزيل نموذج الصوت من
#    Hugging Face، المحجوبة كليًّا في تلك البيئة. شغّله أنت بإنترنتٍ
#    عاديّ ليكتمل مزوّد Piper فعليًّا (WS41-F).
#
#   bash scripts/vendor-piper.sh [voice-id]
#
# الافتراضي: ru_RU-irina-medium (صوتٌ روسيّ متوسّط الجودة معروف).
# راجع https://github.com/rhasspy/piper/blob/master/VOICES.md لأصواتٍ أخرى.
#
# بعده: مزوّد Piper (`js/services/shadow/tts/piper-provider.js`) لا يزال
# يحتاج محوّل نصٍّ إلى صوتيّات (phonemizer) — راجع تعليق رأس ذلك الملفّ.
# هذا السكربت ينزّل المحرّك والنموذج فقط، لا يحلّ مشكلة التصويت.

set -euo pipefail

VOICE_ID="${1:-ru_RU-irina-medium}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORT_DEST="$ROOT/vendor/onnxruntime-web"
VOICE_DEST="$ROOT/vendor/piper-voices/$VOICE_ID"
ORT_VERSION="1.27.0"

mkdir -p "$ORT_DEST" "$VOICE_DEST"

echo "── محرّك ONNX Runtime Web ($ORT_VERSION) ──"
if [ -f "$ORT_DEST/ort.wasm.min.mjs" ] && [ -f "$ORT_DEST/ort-wasm-simd-threaded.wasm" ]; then
  echo "  موجودٌ مسبقًا — تخطّيت."
else
  TMP="$(mktemp -d)"
  curl -sSfL -o "$TMP/ort.tgz" "https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-${ORT_VERSION}.tgz"
  tar xzf "$TMP/ort.tgz" -C "$TMP"
  cp "$TMP/package/dist/ort.wasm.min.mjs" "$ORT_DEST/"
  cp "$TMP/package/dist/ort-wasm-simd-threaded.mjs" "$ORT_DEST/"
  cp "$TMP/package/dist/ort-wasm-simd-threaded.wasm" "$ORT_DEST/"
  rm -rf "$TMP"
  echo "  ✓ $(du -sh "$ORT_DEST" | cut -f1)"
fi

echo
echo "── نموذج الصوت: $VOICE_ID ──"
echo "  ⚠️ مستضافٌ على huggingface.co حصرًا — لا بديل رسميّ آخر."

# بنية مسار Piper القياسية: <لغة>/<محليّة>/<اسم>/<جودة>/<محليّة>-<اسم>-<جودة>.onnx[.json]
# مثال ru_RU-irina-medium → ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx
LANG="${VOICE_ID%%_*}"
LOCALE="${VOICE_ID%%-*}"
REST="${VOICE_ID#*-}"
NAME="${REST%-*}"
QUALITY="${REST##*-}"
HF_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${LANG}/${LOCALE}/${NAME}/${QUALITY}"

curl -sSfL -o "$VOICE_DEST/model.onnx" "${HF_BASE}/${VOICE_ID}.onnx"
curl -sSfL -o "$VOICE_DEST/model.onnx.json" "${HF_BASE}/${VOICE_ID}.onnx.json"
echo "  ✓ $(du -sh "$VOICE_DEST" | cut -f1)"

echo
echo "تمّ. مزوّد Piper سيقول MODEL_NOT_DOWNLOADED حتى تُوصِّل phonemizer —"
echo "راجع تعليق رأس js/services/shadow/tts/piper-provider.js."
