from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "housereference"
OUTPUT = ROOT / "public" / "money-level" / "art" / "houses"


ASSETS = {
    "temporary-camp-spring-summer.webp": ("봄여름 돗자리(1).png", "봄여름 돗자리.png"),
    "temporary-camp-fall.webp": ("fall 돗자리(1).png", "fall 돗자리.png"),
    "temporary-camp-winter.webp": ("winter 돗자리(1).png", "winter 돗자리.png"),
    "temporary-tent-neutral.webp": ("텐트(1).png", "텐트.png"),
    "temporary-tent-yellow.webp": ("노랑텐트(1).png", "노랑텐트.png"),
    "temporary-house-fall.webp": ("fall 집(1).png", "fall 집.png"),
    "temporary-house-winter.webp": ("winter 집(1).png", "winter 집.png"),
}

BLACK_MATTE_SOURCES = {"winter 돗자리(1).png", "winter 돗자리.png", "winter 집(1).png", "winter 집.png"}


def find_source(candidates: Iterable[str]) -> Path:
    for name in candidates:
        path = SOURCE / name
        if path.is_file():
            return path
    raise FileNotFoundError(f"Missing house source; tried: {', '.join(candidates)}")


def fill_core_holes(core: np.ndarray) -> np.ndarray:
    # Fill only dark regions enclosed by bright illustration pixels. This keeps
    # doors, ink outlines, lanterns and stone detail opaque while the exterior
    # black canvas remains removable.
    mask = Image.fromarray(np.where(core, 255, 0).astype(np.uint8), "L")
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    padded = Image.new("L", (mask.width + 2, mask.height + 2), 0)
    padded.paste(mask, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128, thresh=0)
    exterior = np.asarray(padded, dtype=np.uint8)[1:-1, 1:-1] == 128
    return ~exterior


def remove_connected_black_matte(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    brightness = rgb.max(axis=2)
    opaque_core = fill_core_holes(brightness >= 128)

    # The source is composited over black. Outside the protected opaque core,
    # recover a soft alpha and un-premultiply the edge color so no dark fringe
    # appears on the Forest background.
    alpha = np.where(opaque_core, 255, np.clip((brightness - 1) * 255 / 127, 0, 255)).astype(np.uint8)
    unmatte = np.where(alpha > 0, 255 / np.maximum(alpha, 1), 0).astype(np.float32)
    corrected = np.where(opaque_core[:, :, None], rgb, np.clip(rgb * unmatte[:, :, None], 0, 255))
    return Image.fromarray(np.dstack((corrected.astype(np.uint8), alpha)), "RGBA")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for output_name, candidates in ASSETS.items():
        source = find_source(candidates)
        with Image.open(source) as opened:
            opened.load()
            image = remove_connected_black_matte(opened) if source.name in BLACK_MATTE_SOURCES else opened.convert("RGBA")
            image.save(OUTPUT / output_name, "WEBP", lossless=True, quality=100, method=6, exact=True)
            print(f"{source.name} -> {output_name} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
