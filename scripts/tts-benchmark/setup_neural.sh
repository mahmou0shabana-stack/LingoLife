#!/usr/bin/env bash
# Neural engines for the benchmark: one venv per engine under envs/ (their pinned
# torch/transformers versions conflict), weights under models/ via fetch_models.py.
# Nothing here touches LingoLife's app code or project dependencies.
#
# torch comes from PyPI: in the benchmark environment download.pytorch.org
# redirects to download-r2.pytorch.org, which the network policy refuses.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p envs tools logs
T="torch==2.6.0 torchaudio==2.6.0"

# XTTS v2 — coqui-tts (maintained idiap fork of Coqui TTS)
uv venv -q -p 3.11 envs/xtts
VIRTUAL_ENV=envs/xtts uv pip install -q $T "coqui-tts[codec]==0.27.5" "transformers==4.57.6" "spacy[ja]==3.8.16" soundfile psutil

# Chatterbox Multilingual V3 — GitHub master (the V3 loader), commit pinned
uv venv -q -p 3.11 envs/chatterbox
VIRTUAL_ENV=envs/chatterbox uv pip install -q $T \
  "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox@5de7a54aa4e5e2baadb0182dde554908b48b85c2" soundfile psutil

# Qwen3-TTS — official qwen-tts package
uv venv -q -p 3.11 envs/qwen3
VIRTUAL_ENV=envs/qwen3 uv pip install -q $T "qwen-tts==0.1.1" soundfile psutil

# CosyVoice 3 — official repo (no PyPI package), its requirements.txt minus the
# CUDA-only entries (deepspeed, onnxruntime-gpu, tensorrt, gradio/fastapi UI).
# torch 2.3.1 as pinned there: openai-whisper 20231117 needs triton<3.
if [ ! -d tools/CosyVoice ]; then
  git clone -q --recursive https://github.com/FunAudioLLM/CosyVoice.git tools/CosyVoice
  git -C tools/CosyVoice checkout -q 074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc
  git -C tools/CosyVoice submodule update -q --init --recursive
fi
uv venv -q -p 3.10 envs/cosyvoice
export VIRTUAL_ENV=envs/cosyvoice
uv pip install -q torch==2.3.1 torchaudio==2.3.1 numpy==1.26.4 "setuptools<70" wheel
uv pip install -q --no-build-isolation openai-whisper==20231117 pyworld==0.3.4
uv pip install -q torch==2.3.1 torchaudio==2.3.1 conformer==0.3.2 diffusers==0.29.0 hydra-core==1.3.2 \
  HyperPyYAML==1.2.3 inflect==7.3.1 librosa==0.10.2 lightning==2.2.4 modelscope==1.20.0 numpy==1.26.4 \
  omegaconf==2.3.0 onnx==1.16.0 onnxruntime==1.18.0 openai-whisper==20231117 protobuf==4.25 pyarrow==18.1.0 \
  pyworld==0.3.4 soundfile==0.12.1 transformers==4.51.3 x-transformers==2.11.24 wetext==0.0.4 \
  matplotlib==3.7.5 rich==13.7.1 gdown==5.1.0 wget==3.2 psutil
unset VIRTUAL_ENV

python3 fetch_models.py xtts chatterbox qwen3-1.7b cosyvoice3
echo "ready: python3 run.py xtts chatterbox qwen3 cosyvoice && .venv/bin/python build_page.py"
