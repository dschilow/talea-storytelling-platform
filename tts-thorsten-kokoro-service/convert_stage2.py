"""Build step: turn a kikiri-tts Stage 2 training checkpoint into Kokoro KModel weights.

Same conversion as kikiri-tts scripts/test_inference.py::convert_checkpoint: keep the five inference parts and
prefix their keys with "module.". Used for Kerstin, whose repo only ships the raw training checkpoints; her
voicepack alone on the base Kokoro-82M weights (as her model card suggests) speaks German with a strong accent.

Usage: python convert_stage2.py <hf repo> <checkpoint file in repo> <output .pth>
"""
import os
import sys

import torch
from huggingface_hub import hf_hub_download

INFERENCE_PARTS = ("bert", "bert_encoder", "predictor", "text_encoder", "decoder")


def main(repo: str, filename: str, output: str) -> None:
    checkpoint = hf_hub_download(repo, filename)
    net = torch.load(checkpoint, map_location="cpu", weights_only=False)["net"]
    missing = [part for part in INFERENCE_PARTS if part not in net]
    if missing:
        raise SystemExit(f"checkpoint lacks {missing}")
    weights = {
        part: {(k if k.startswith("module.") else f"module.{k}"): v for k, v in net[part].items()}
        for part in INFERENCE_PARTS
    }
    os.makedirs(os.path.dirname(output), exist_ok=True)
    torch.save(weights, output)
    # The raw checkpoint (~1.9 GB incl. optimizer state) is not needed at runtime.
    os.remove(os.path.realpath(checkpoint))
    print(f"converted {repo}/{filename} -> {output} ({os.path.getsize(output) / 2**20:.0f} MB)")


if __name__ == "__main__":
    main(*sys.argv[1:4])
