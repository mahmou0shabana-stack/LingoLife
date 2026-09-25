#!/usr/bin/env python3
"""Downloads model weights from modelscope.cn and verifies each file's SHA-256
against the OFFICIAL Hugging Face repo at a pinned revision.

    python3 fetch_models.py xtts chatterbox qwen3-0.6b qwen3-1.7b cosyvoice3

Why ModelScope: in this environment huggingface.co answers the API and small
files, but its large-file CDNs (us.aws.cdn.hf.co, cas-server.xethub.hf.co)
are refused by the network policy (CONNECT 403). modelscope.cn serves the
same files directly. Every LFS file is checked byte-for-byte (SHA-256)
against huggingface.co's own LFS metadata for the pinned revision — a
mismatch aborts. Standard library only.
"""

import hashlib
import json
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# id: (official HF repo, pinned HF revision, ModelScope mirror, files to fetch or None = all, excluded)
MODELS = {
    # AI-ModelScope/XTTS-v2 carries the files of the official v2.0.0/v2.0.1 tags (identical weights,
    # config and vocab); it has no speakers_xtts.pth, so XTTS runs with a reference clip.
    "xtts": ("coqui/XTTS-v2", "28ac75746581f0d43c249ad5e9907b8a32a2d1ab", "AI-ModelScope/XTTS-v2", None, ()),
    "chatterbox": ("ResembleAI/chatterbox", "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18", "ResembleAI/chatterbox",
                   ["ve.pt", "t3_mtl23ls_v3.safetensors", "s3gen.pt", "grapheme_mtl_merged_expanded_v1.json",
                    "conds.pt", "Cangjie5_TC.json", "README.md"], ()),
    "qwen3-0.6b": ("Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice", "85e237c12c027371202489a0ec509ded67b5e4b5",
                   "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice", None, ()),
    "qwen3-1.7b": ("Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice", "0c0e3051f131929182e2c023b9537f8b1c68adfe",
                   "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice", None, ()),
    # Excluded: the RL variant of the LLM, the batch tokenizer and the TensorRT-only fp32 ONNX estimator.
    "cosyvoice3": ("FunAudioLLM/Fun-CosyVoice3-0.5B-2512", "29e01c4e8d000f4bcd70751be16fa94bf3d85a18",
                   "FunAudioLLM/Fun-CosyVoice3-0.5B-2512", None,
                   ("llm.rl.pt", "speech_tokenizer_v3.batch.onnx", "flow.decoder.estimator.fp32.onnx")),
    # ---- Phase 1B ----
    # MOSS-TTS-Nano: HF renamed OpenMOSS-Team/MOSS-TTS-Nano → …-100M (the old id 307-redirects); same files.
    "moss-nano": ("OpenMOSS-Team/MOSS-TTS-Nano-100M", "44502f80dbf9743528fa921cc544d662c685ebec",
                  "openmoss/MOSS-TTS-Nano-100M", None, ()),
    "moss-audio-tokenizer-nano": ("OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano", "6aa02b01e445cc585582cf0ba480bc3ea6c8dd68",
                                  "openmoss/MOSS-Audio-Tokenizer-Nano", None, ()),
    "moss-nano-onnx": ("OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX", "f52645cb467506d8e18e746ddd59482685b74e58",
                       "openmoss/MOSS-TTS-Nano-100M-ONNX", None, ()),
    "moss-audio-tokenizer-nano-onnx": ("OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX", "ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae",
                                       "openmoss/MOSS-Audio-Tokenizer-Nano-ONNX", None, ()),
    # ESpeech-TTS-1 RL-V2: Russian F5-TTS checkpoint (the SHARED.md-listed hotstone228/F5-TTS-Russian is HF-only).
    "espeech-rlv2": ("ESpeech/ESpeech-TTS-1_RL-V2", "f582b6e5897fe8a5835059405a8439d13bdf7684",
                     "ESpeech/ESpeech-TTS-1_RL-V2", None, ()),
    # MOSS-TTS Local (MossTTSLocal, Qwen3-1.7B backbone; 3.06B params total, bf16) + its codec (1.77B, fp32)
    "moss-local": ("OpenMOSS-Team/MOSS-TTS-Local-Transformer", "12aa734e4f11a7b3fdf4eb0ad2aa2029675ffc2e",
                   "openmoss/MOSS-TTS-Local-Transformer", None, ()),
    "moss-audio-tokenizer": ("OpenMOSS-Team/MOSS-Audio-Tokenizer", "3cd226ba2947efa357ef453bcad111b6eafba782",
                             "openmoss/MOSS-Audio-Tokenizer", None, ("images/arch.png", "images/pesq-nb.png",
                                                                     "images/pesq-wb.png", "images/sim.png", "images/stoi.png")),
    # ---- Phase 1C ----
    # Supertonic 3 (Supertone): the official HF repos Supertone/supertonic-3 and supertone-oss-archive/supertonic-3
    # hold byte-identical ONNX/voice files; README images and audio samples are not needed.
    "supertonic3": ("Supertone/supertonic-3", "3cadd1ee6394adea1bd021217a0e650ede09a323", "Supertone/supertonic-3", None,
                    tuple(f"img/{x}" for x in ("Supertonic3_HeroImage.png", "metrics/model_size_comparison.png",
                          "metrics/runtime_cpu_gpu_latency_memory.png", "metrics/s3_vs_measured_wer_range_voxcpm2.png",
                          "metrics/supertonic2_vs_3_comparison.png"))),
    "omnivoice": ("k2-fsa/OmniVoice", "c5fdb5ccb189668d56333f77ba2629f4cd7535f4", "k2-fsa/OmniVoice", None, ()),
    "vocos-mel-24khz": ("charactr/vocos-mel-24khz", "0feb3fdd929bcd6649e0e7c5a688cf7dd012ef21",
                        "pengzhendong/vocos-mel-24khz", None, ()),
}


def get_json(url):
    return json.load(urllib.request.urlopen(url, timeout=60))


CHUNK = 32 << 20


def download(url, out, size):
    """Parallel ranged download — single streams from modelscope.cn run at ~0.3 MB/s here."""
    tmp = out.with_suffix(out.suffix + ".part")
    with open(tmp, "wb") as f:
        f.truncate(size)

    def part(start):
        end = min(start + CHUNK, size) - 1
        for attempt in range(8):
            try:
                req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                if len(data) != end - start + 1:
                    raise IOError(f"short read {len(data)}")
                with open(tmp, "r+b") as f:
                    f.seek(start)
                    f.write(data)
                return
            except Exception:  # noqa: BLE001 — retried, then re-raised
                if attempt == 7:
                    raise
                time.sleep(2 ** min(attempt, 4))

    with ThreadPoolExecutor(16) as pool:
        list(pool.map(part, range(0, size, CHUNK)))
    tmp.rename(out)


def fetch(model_id):
    hf, rev, ms, only, exclude = MODELS[model_id]
    dest = ROOT / "models" / model_id
    dest.mkdir(parents=True, exist_ok=True)
    hf_meta = get_json(f"https://huggingface.co/api/models/{hf}/revision/{rev}?blobs=true")
    hf_sha = {s["rfilename"]: (s.get("lfs") or {}).get("sha256") for s in hf_meta["siblings"]}
    ms_files = get_json(f"https://modelscope.cn/api/v1/models/{ms}/repo/files?Revision=master&Recursive=true")
    paths = [f["Path"] for f in ms_files["Data"]["Files"] if f["Type"] == "blob"]
    wanted = [p for p in paths if (only is None or p in only) and p not in exclude]
    report = {"hf_repo": hf, "hf_revision": rev, "modelscope_repo": ms, "files": {}}
    for p in wanted:
        out = dest / p
        out.parent.mkdir(parents=True, exist_ok=True)
        expected = hf_sha.get(p)
        if not out.exists():
            url = f"https://modelscope.cn/api/v1/models/{ms}/repo?Revision=master&FilePath={urllib.parse.quote(p)}"
            size = next(f.get("Size") for f in ms_files["Data"]["Files"] if f["Path"] == p)
            download(url, out, size)
        h = hashlib.sha256()
        with open(out, "rb") as f:
            while chunk := f.read(1 << 22):
                h.update(chunk)
        got = h.hexdigest()
        if expected:
            if got != expected:
                raise SystemExit(f"{model_id}/{p}: SHA-256 {got} != official {hf}@{rev[:10]} {expected}")
            verdict = "sha256 matches official HF LFS"
        elif p in hf_sha:
            hf_bytes = urllib.request.urlopen(f"https://huggingface.co/{hf}/resolve/{rev}/{urllib.parse.quote(p)}",
                                              timeout=60).read()
            if hashlib.sha256(hf_bytes).hexdigest() == got:
                verdict = "identical to official HF file"
            else:
                # small non-LFS files are served by huggingface.co itself: use the official copy
                out.write_bytes(hf_bytes)
                got = hashlib.sha256(hf_bytes).hexdigest()
                verdict = "ModelScope copy differed — replaced with the official HF file (non-LFS)"
        else:
            verdict = "ModelScope-only file (not in HF repo)"
        report["files"][p] = {"bytes": out.stat().st_size, "sha256": got, "check": verdict}
        print(f"[{model_id}] {p}: {verdict}")
    (dest / "_provenance.json").write_text(json.dumps(report, indent=1))
    return report


if __name__ == "__main__":
    for m in sys.argv[1:] or MODELS:
        fetch(m)
