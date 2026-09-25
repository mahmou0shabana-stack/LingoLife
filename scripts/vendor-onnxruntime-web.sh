#!/usr/bin/env bash
#
# LingoLife — ضمّ ONNX Runtime Web محلّيًّا (Supertonic المرحلة 1B)
#
#   bash scripts/vendor-onnxruntime-web.sh
#
# يُنزّل حزمة npm المُثبَّتة، ويتحقّق من بصمتها مقابل سجلّ npm (sha512)،
# وينسخ **ثلاثة ملفّات فقط** — ما يحتاجه مسارُ WASM بخيطٍ واحد:
#   ort.wasm.min.mjs                 مدخلُ الوحدة (بلا WebGPU/WebNN)
#   ort-wasm-simd-threaded.mjs       غراءُ Emscripten الذي يستورده المدخل
#   ort-wasm-simd-threaded.wasm      المحرّك (~13.5MB)
#
# ⚠️ **ولماذا «threaded» ونحن بخيطٍ واحد؟** لأنه البناءُ الوحيد في 1.27
#    لمسار WASM العاديّ؛ مع `numThreads = 1` ولا عزلَ مصدر لا يُنشئ خيطًا
#    ولا يحتاج SharedArrayBuffer. بناءا jsep وasyncify (WebGPU) لا يُنسخان.
#
# ⚠️ **وهذه الملفّات في git** (راجع `.gitignore`): النشرُ على GitHub Pages
#    يرفع المستودع كما هو، والتوليدُ بلا شبكة يحتاج المحرّك على الموقع
#    نفسِه لا على CDN. ترقيتُه = تعديلُ الرقم والبصمة هنا وإعادةُ التشغيل.

set -euo pipefail

VERSION="1.27.0"
INTEGRITY="sha512-ogDLsqIozHZwifPuN37OproAo0byX6t43/bP8GzeZWBWD6MOGExswFAx3up4NS/vvWBOg2u2PXomDt3rMmdQSg=="
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/onnxruntime-web"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -sSfL -o "$TMP/ort.tgz" "https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-${VERSION}.tgz"
GOT="sha512-$(openssl dgst -sha512 -binary "$TMP/ort.tgz" | base64 | tr -d '\n')"
if [ "$GOT" != "$INTEGRITY" ]; then
  echo "✗ بصمةُ الحزمة لا تطابق سجلّ npm" >&2
  exit 1
fi
tar xzf "$TMP/ort.tgz" -C "$TMP"

mkdir -p "$DEST"
for f in ort.wasm.min.mjs ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm; do
  cp "$TMP/package/dist/$f" "$DEST/$f"
done
{
  echo "onnxruntime-web ${VERSION} — https://www.npmjs.com/package/onnxruntime-web"
  echo "license: $(sed -n 's/.*"license": *"\([^"]*\)".*/\1/p' "$TMP/package/package.json") (package.json; the npm tarball ships no LICENSE file)"
  echo "Copyright (c) Microsoft Corporation — https://github.com/microsoft/onnxruntime/blob/main/LICENSE"
  echo "npm integrity: ${INTEGRITY}"
  echo "copied by scripts/vendor-onnxruntime-web.sh"
  echo
  (cd "$DEST" && sha256sum ort.wasm.min.mjs ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm)
} > "$DEST/VERSION.txt"
echo "✓ $(du -sh "$DEST" | cut -f1) → vendor/onnxruntime-web/"
