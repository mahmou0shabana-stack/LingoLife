#!/usr/bin/env bash
# Installs the benchmark's engines inside scripts/tts-benchmark/ only.
# Nothing here touches LingoLife's app code or project dependencies.
set -euo pipefail
cd "$(dirname "$0")"

# RHVoice — Ubuntu/Debian archive (system package; needs root).
if ! command -v RHVoice-test >/dev/null; then
  apt-get install -y rhvoice rhvoice-russian
fi

# Piper — official GitHub release binary + the one Russian voice published there.
# (The other Russian Piper voices exist only on huggingface.co/rhasspy/piper-voices.)
mkdir -p tools models/piper
if [ ! -x tools/piper/piper ]; then
  curl -fsSL https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz | tar xz -C tools
fi
if [ ! -f models/piper/ru-irinia-medium.onnx ]; then
  curl -fsSL https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-ru-irinia-medium.tar.gz | tar xz -C models/piper
fi

# Page builder only: lossless FLAC packs for the listening page.
python3 -m venv .venv
.venv/bin/pip install -q soundfile

echo "ready: python3 run.py && .venv/bin/python build_page.py"
