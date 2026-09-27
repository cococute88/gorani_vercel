#!/usr/bin/env python3
"""Remove a generated neutral checkerboard that is connected to the canvas edge.

This intentionally targets only AI-generated review outputs. Production source
art is never passed through this helper.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def extract(input_path: Path, output_path: Path) -> None:
    rgb = np.asarray(Image.open(input_path).convert("RGB"))
    channel_range = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16)
    value = rgb.max(axis=2)

    # Generated checkerboards are neutral gray. Restrict deletion to neutral
    # pixels connected to the canvas edge so outlined cream stone stays intact.
    candidate = ((channel_range <= 9) & (value >= 45)).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    edge_labels = np.unique(
        np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))
    )
    background = np.isin(labels, edge_labels[edge_labels != 0])
    foreground = (~background).astype(np.uint8)

    # Retain the dominant connected illustrated object and fill enclosed gaps.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground, 8)
    keep = np.zeros_like(foreground)
    if count > 1:
        min_area = max(64, int(foreground.size * 0.00004))
        for label in range(1, count):
            if stats[label, cv2.CC_STAT_AREA] >= min_area:
                keep[labels == label] = 1

    flood = keep.copy()
    padded = np.pad(flood, 1)
    cv2.floodFill(padded, None, (0, 0), 1)
    holes = 1 - padded[1:-1, 1:-1]
    keep = np.maximum(keep, holes)

    alpha = cv2.GaussianBlur(keep * 255, (0, 0), 0.45)
    alpha[alpha < 6] = 0
    rgba = np.dstack((rgb, alpha.astype(np.uint8)))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    extract(args.input, args.output)


if __name__ == "__main__":
    main()
