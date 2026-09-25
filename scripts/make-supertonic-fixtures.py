#!/usr/bin/env python3
"""LingoLife — tiny stand-in ONNX graphs for the Supertonic 1B engine tests.

    python3 -m venv /tmp/onnxenv && /tmp/onnxenv/bin/pip install onnx==1.17.0 numpy
    /tmp/onnxenv/bin/python scripts/make-supertonic-fixtures.py

Writes tests/fixtures/supertonic-tiny/{duration_predictor,text_encoder,vector_estimator,vocoder}.int8.onnx
(~15 KB total). They are NOT a speech model: they have exactly the input/output names, dtypes and
ranks of the real Supertonic 3 graphs, so the real worker + onnxruntime-web run end to end in the test
suite without the 145 MB model. Each output depends on what the engine must get right:
  - duration   = 0.2 + 1e-5 * Σ id[t]·(t+1) + mean|style_dp|  → position-weighted over the token ids,
                 so за́мок and замо́к (same ids, U+0301 in a different place) give different lengths;
                 and F1/M1 differ through the style.
  - text_emb   = ids ⊗ mean(style_ttl)                           → voice- and text-dependent
  - denoised   = (0.8·noisy + 1e-3·mean(text_emb) + 0.01·step/total)·latent_mask → seeded noise flows through
  - wav        = tanh(mean_c(latent) ⊗ sin-table[3072])           → [B, 3072·L] like the real vocoder
onnx is a generator-time tool only; nothing in the app imports it.
"""

from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper as h, numpy_helper as nh

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "supertonic-tiny"
OPSET = [h.make_opsetid("", 17)]


def const(name, value, dtype=np.float32):
    return nh.from_array(np.asarray(value, dtype=dtype), name)


def save(name, nodes, inputs, outputs, inits=()):
    graph = h.make_graph(nodes, name, inputs, outputs, list(inits))
    model = h.make_model(graph, opset_imports=OPSET, producer_name="lingolife-fixture")
    model.ir_version = 8
    onnx.checker.check_model(model)
    OUT.mkdir(parents=True, exist_ok=True)
    onnx.save(model, OUT / f"{name}.int8.onnx")


F, I64 = TensorProto.FLOAT, TensorProto.INT64
text_ids = h.make_tensor_value_info("text_ids", I64, ["batch_size", "text_length"])
text_mask = h.make_tensor_value_info("text_mask", F, ["batch_size", 1, "text_length"])
style_dp = h.make_tensor_value_info("style_dp", F, ["batch_size", 8, 16])
style_ttl = h.make_tensor_value_info("style_ttl", F, ["batch_size", 50, 256])

save("duration_predictor", [
    h.make_node("Cast", ["text_ids"], ["ids_f"], to=F),
    h.make_node("Unsqueeze", ["ids_f", "ax1"], ["ids_3"]),
    h.make_node("CumSum", ["text_mask", "ax2"], ["pos"]),
    h.make_node("Mul", ["ids_3", "pos"], ["w"]),
    h.make_node("ReduceSum", ["w", "ax12"], ["s"], keepdims=0),
    h.make_node("Abs", ["style_dp"], ["a"]),
    h.make_node("ReduceMean", ["a"], ["st"], axes=[1, 2], keepdims=0),
    h.make_node("Mul", ["s", "k_s"], ["s2"]),
    h.make_node("Add", ["s2", "st"], ["d0"]),
    h.make_node("Add", ["d0", "k_base"], ["duration"]),
], [text_ids, style_dp, text_mask], [h.make_tensor_value_info("duration", F, ["batch_size"])],
    [const("ax1", [1], np.int64), const("ax2", 2, np.int64), const("ax12", [1, 2], np.int64),
     const("k_s", 1e-5), const("k_base", 0.2)])

save("text_encoder", [
    h.make_node("Cast", ["text_ids"], ["ids_f"], to=F),
    h.make_node("Mul", ["ids_f", "k"], ["ids_s"]),
    h.make_node("Unsqueeze", ["ids_s", "ax1"], ["ids_3"]),
    h.make_node("ReduceMean", ["style_ttl"], ["sm"], axes=[1], keepdims=1),
    h.make_node("Transpose", ["sm"], ["smt"], perm=[0, 2, 1]),
    h.make_node("Mul", ["smt", "ids_3"], ["e"]),
    h.make_node("Mul", ["e", "text_mask"], ["text_emb"]),
], [text_ids, style_ttl, text_mask], [h.make_tensor_value_info("text_emb", F, ["batch_size", 256, "text_length"])],
    [const("k", 1e-3), const("ax1", [1], np.int64)])

save("vector_estimator", [
    h.make_node("Mul", ["noisy_latent", "k_n"], ["a"]),
    h.make_node("ReduceMean", ["text_emb"], ["tm"], axes=[1, 2], keepdims=1),
    h.make_node("Mul", ["tm", "k_t"], ["b"]),
    h.make_node("Div", ["current_step", "total_step"], ["r"]),
    h.make_node("Mul", ["r", "k_r"], ["r2"]),
    h.make_node("Unsqueeze", ["r2", "ax12"], ["r3"]),
    h.make_node("Add", ["a", "b"], ["ab"]),
    h.make_node("Add", ["ab", "r3"], ["abr"]),
    h.make_node("Mul", ["abr", "latent_mask"], ["denoised_latent"]),
], [h.make_tensor_value_info("noisy_latent", F, ["batch_size", 144, "latent_length"]),
    h.make_tensor_value_info("text_emb", F, ["batch_size", 256, "text_length"]),
    style_ttl,
    h.make_tensor_value_info("latent_mask", F, ["batch_size", 1, "latent_length"]),
    text_mask,
    h.make_tensor_value_info("current_step", F, ["batch_size"]),
    h.make_tensor_value_info("total_step", F, ["batch_size"])],
    [h.make_tensor_value_info("denoised_latent", F, ["batch_size", 144, "latent_length"])],
    [const("k_n", 0.8), const("k_t", 1e-3), const("k_r", 0.01), const("ax12", [1, 2], np.int64)])

table = np.sin(np.arange(3072) * 2 * np.pi * 220 / 44100).astype(np.float32)
save("vocoder", [
    h.make_node("ReduceMean", ["latent"], ["m"], axes=[1], keepdims=1),
    h.make_node("Unsqueeze", ["m", "ax3"], ["m4"]),
    h.make_node("Mul", ["m4", "table"], ["x"]),
    h.make_node("Reshape", ["x", "shape"], ["y"]),
    h.make_node("Tanh", ["y"], ["wav_tts"]),
], [h.make_tensor_value_info("latent", F, ["batch_size", 144, "latent_length"])],
    [h.make_tensor_value_info("wav_tts", F, ["batch_size", "wav_length"])],
    [const("ax3", [3], np.int64), nh.from_array(table.reshape(1, 1, 1, 3072), "table"),
     const("shape", [0, -1], np.int64)])

for p in sorted(OUT.glob("*.onnx")):
    print(p.name, p.stat().st_size)
