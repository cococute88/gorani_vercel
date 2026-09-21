from __future__ import annotations

import argparse
from collections.abc import Iterable
from math import sqrt
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

# The grass-bearing alpha-v2 camp is the visual master. These approved camps
# have very different outer silhouettes, so full-alpha area is not a useful
# proxy for perceived size. Start from the opaque illustration core (rug,
# firepit, stump/props), then verify the result in the real Forest preview.
CAMP_OUTPUTS = {
    "temporary-camp-spring-summer.webp",
    "temporary-camp-fall.webp",
    "temporary-camp-winter.webp",
}
# Browser comparison of the actual rug/firepit—not the full alpha footprint—
# showed the Spring/Summer illustration still about 20% too large after the
# first core-area fit. Fall and Winter already matched perceptually, so do not
# copy the Spring adjustment across seasons.
CAMP_VISUAL_SCALE_ADJUSTMENTS = {
    "temporary-camp-spring-summer.webp": 0.82,
    "temporary-camp-fall.webp": 1.0,
    "temporary-camp-winter.webp": 1.0,
}
CAMP_MASTER_CORE_BOUNDS = (199, 389, 1256, 917)
CAMP_CORE_ALPHA_THRESHOLD = 240


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


def normalize_camp_pixels(image: Image.Image, visual_adjustment: float) -> tuple[Image.Image, float, tuple[float, float]]:
    alpha = image.getchannel("A")
    source_bounds = alpha.point(lambda value: 255 if value >= CAMP_CORE_ALPHA_THRESHOLD else 0).getbbox()
    if source_bounds is None:
        raise ValueError("Camp illustration has no opaque visual core")
    sx0, sy0, sx1, sy1 = source_bounds
    tx0, ty0, tx1, ty1 = CAMP_MASTER_CORE_BOUNDS
    scale = sqrt(((tx1 - tx0) * (ty1 - ty0)) / ((sx1 - sx0) * (sy1 - sy0))) * visual_adjustment
    source_center_x = (sx0 + sx1) / 2
    target_center_x = (tx0 + tx1) / 2
    translate_x = target_center_x - scale * source_center_x
    translate_y = ty1 - scale * sy1
    # Resample premultiplied colors so transparent black canvas pixels cannot
    # bleed into anti-aliased illustration edges during the direct resize.
    normalized = image.convert("RGBa").transform(
        image.size,
        Image.Transform.AFFINE,
        (1 / scale, 0, -translate_x / scale, 0, 1 / scale, -translate_y / scale),
        resample=Image.Resampling.BICUBIC,
    ).convert("RGBA")
    return normalized, scale, (translate_x, translate_y)


def clear_exterior_dark_fringe(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image).copy()
    alpha = rgba[:, :, 3]
    # Browsers decode WebP through a premultiplied canvas. Sub-8 alpha can
    # quantize warm edge RGB to black there even when Pillow preserves it.
    # Drop only that visually invisible exterior fringe, then keep the source
    # illustration's dark opaque outlines untouched.
    invisible = alpha < 8
    dark_partial = (alpha < 240) & (rgba[:, :, :3].max(axis=2) < 16)
    rgba[invisible | dark_partial] = 0
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--camp-only", action="store_true", help="Rebuild only the three directly normalized camp assets")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for output_name, candidates in ASSETS.items():
        if args.camp_only and output_name not in CAMP_OUTPUTS:
            continue
        source = find_source(candidates)
        with Image.open(source) as opened:
            opened.load()
            image = remove_connected_black_matte(opened) if source.name in BLACK_MATTE_SOURCES else opened.convert("RGBA")
            if output_name in CAMP_OUTPUTS:
                image, scale, translation = normalize_camp_pixels(image, CAMP_VISUAL_SCALE_ADJUSTMENTS[output_name])
                if source.name in BLACK_MATTE_SOURCES:
                    image = clear_exterior_dark_fringe(image)
                print(f"  camp pixel normalization: scale={scale:.6f}, translate=({translation[0]:.2f}, {translation[1]:.2f})")
            image.save(OUTPUT / output_name, "WEBP", lossless=True, quality=100, method=6, exact=True)
            print(f"{source.name} -> {output_name} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
