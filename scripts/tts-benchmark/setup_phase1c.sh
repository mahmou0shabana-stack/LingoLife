#!/usr/bin/env bash
# Phase 1C: Supertonic 3 (fp32 ONNX, official helper), Supertonic 3 INT8 (sherpa-onnx), OmniVoice, Silero Stress.
# Nothing here touches LingoLife's app code.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p envs tools logs models/sherpa

# Supertonic — official repo (archived), torch-free: its py/requirements.txt pins onnxruntime 1.23.1
if [ ! -d tools/supertonic ]; then
  git clone -q https://github.com/supertone-inc/supertonic.git tools/supertonic
  git -C tools/supertonic checkout -q 1e9799e964ea4c0dad7cde993b65c3c813a7b373
fi
uv venv -q -p 3.12 envs/supertonic
VIRTUAL_ENV=envs/supertonic uv pip install -q onnxruntime==1.23.1 "numpy>=1.26.0" "soundfile>=0.12.1" "librosa>=0.10.0" "PyYAML>=6.0" psutil

# Supertonic 3 INT8 via sherpa-onnx (Android/iOS/WASM-capable runtime) — GitHub release asset
uv venv -q -p 3.12 envs/sherpa
VIRTUAL_ENV=envs/sherpa uv pip install -q sherpa-onnx==1.13.8 soundfile numpy
if [ ! -d models/sherpa/sherpa-onnx-supertonic-3-tts-int8-2026-05-11 ]; then
  curl -fsSL https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2 \
    -o models/sherpa/st3-int8.tar.bz2
  echo "82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427  models/sherpa/st3-int8.tar.bz2" | sha256sum -c
  tar xjf models/sherpa/st3-int8.tar.bz2 -C models/sherpa
fi

# OmniVoice (PyPI omnivoice 0.2.1; torch 2.8.0 per its README) + Silero Stress (MIT, PyPI)
uv venv -q -p 3.12 envs/omnivoice
VIRTUAL_ENV=envs/omnivoice uv pip install -q torch==2.8.0 torchaudio==2.8.0 omnivoice==0.2.1 "silero-stress==1.5" psutil soundfile

python3 fetch_models.py supertonic3 omnivoice
echo "ready: envs/omnivoice/bin/python silero_stress_test.py && python3 stage_a.py supertonic supertonic-int8 omnivoice"
echo "       && python3 run.py supertonic supertonic-int8 && .venv/bin/python build_page.py"
