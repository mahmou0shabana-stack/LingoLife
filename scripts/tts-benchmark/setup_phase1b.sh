#!/usr/bin/env bash
# Phase 1B engines: MOSS-TTS-Nano (PyTorch + ONNX), F5-TTS Russian (ESpeech-TTS-1 RL-V2).
# One venv per engine in envs/, weights via fetch_models.py (modelscope.cn, SHA-256 vs HF),
# official repos in tools/ at pinned commits. Nothing here touches LingoLife's app code.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p envs tools logs

# MOSS-TTS-Nano — official repo requirements.txt pins (torch 2.7.0, transformers 4.57.1, onnxruntime)
if [ ! -d tools/MOSS-TTS-Nano ]; then
  git clone -q https://github.com/OpenMOSS/MOSS-TTS-Nano.git tools/MOSS-TTS-Nano
  git -C tools/MOSS-TTS-Nano checkout -q 8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb
fi
uv venv -q -p 3.12 envs/moss-nano
VIRTUAL_ENV=envs/moss-nano uv pip install -q torch==2.7.0 torchaudio==2.7.0 transformers==4.57.1 \
  "numpy>=1.24" "sentencepiece>=0.1.99" soundfile "onnxruntime==1.30.0" "WeTextProcessing==1.2.0" psutil huggingface_hub
# the ONNX manifest expects the codec export in a sibling folder with this exact name
ln -sfn moss-audio-tokenizer-nano-onnx models/MOSS-Audio-Tokenizer-Nano-ONNX

# F5-TTS (PyPI f5-tts 1.1.22, same version as the GitHub repo at the pinned commit)
uv venv -q -p 3.11 envs/f5
VIRTUAL_ENV=envs/f5 uv pip install -q torch==2.7.0 torchaudio==2.7.0 "f5-tts==1.1.22" soundfile psutil

python3 fetch_models.py moss-nano moss-audio-tokenizer-nano moss-nano-onnx moss-audio-tokenizer-nano-onnx \
  espeech-rlv2 vocos-mel-24khz
echo "ready: python3 run.py moss-nano moss-nano-onnx f5-espeech && .venv/bin/python build_page.py"
