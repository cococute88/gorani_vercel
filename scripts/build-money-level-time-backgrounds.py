"""Build geometry-preserving Money Level time-of-day backgrounds.

The approved cozy-forest-base.png is the only geometry source. Every operation
below is a same-size per-pixel grade or masked light treatment; no resize, crop,
warp, object generation, or reference image is involved.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "public/money-level/art/background/cozy-forest-base.png"
OUTPUT_DIR = ROOT / "public/money-level/art/background"
OUTPUT_NAMES = {
    "morning": "forest-morning.webp",
    "am": "forest-am.webp",
    "pm": "forest-pm.webp",
    "evening": "forest-evening.webp",
    "night": "forest-night.webp",
}
WEBP_QUALITY = 92


def grade(image: Image.Image, *, brightness: float, saturation: float, contrast: float) -> Image.Image:
    result = ImageEnhance.Color(image).enhance(saturation)
    result = ImageEnhance.Contrast(result).enhance(contrast)
    return ImageEnhance.Brightness(result).enhance(brightness)


def vertical_gradient(size: tuple[int, int], stops: list[tuple[float, tuple[int, int, int, int]]]) -> Image.Image:
    width, height = size
    stops = sorted(stops)
    pixels = np.zeros((height, width, 4), dtype=np.uint8)
    positions = np.arange(height, dtype=np.float32) / max(height - 1, 1)
    for start, end in zip(stops, stops[1:]):
        start_position, start_color = start
        end_position, end_color = end
        selection = (positions >= start_position) & (positions <= end_position)
        mix = ((positions[selection] - start_position) / max(end_position - start_position, 1e-6))[:, None]
        colors = np.asarray(start_color, dtype=np.float32) * (1 - mix) + np.asarray(end_color, dtype=np.float32) * mix
        pixels[selection, :, :] = colors[:, None, :].astype(np.uint8)
    pixels[positions < stops[0][0], :, :] = np.asarray(stops[0][1], dtype=np.uint8)
    pixels[positions > stops[-1][0], :, :] = np.asarray(stops[-1][1], dtype=np.uint8)
    return Image.fromarray(pixels, "RGBA")


def radial_glow(
    size: tuple[int, int],
    center: tuple[float, float],
    radius: tuple[float, float],
    color: tuple[int, int, int],
    alpha: int,
    power: float = 2.0,
) -> Image.Image:
    width, height = size
    yy, xx = np.ogrid[:height, :width]
    distance = np.sqrt(((xx - center[0]) / radius[0]) ** 2 + ((yy - center[1]) / radius[1]) ** 2)
    opacity = np.clip(1 - distance, 0, 1) ** power * alpha
    pixels = np.empty((height, width, 4), dtype=np.uint8)
    pixels[..., :3] = color
    pixels[..., 3] = opacity.astype(np.uint8)
    return Image.fromarray(pixels, "RGBA")


def soft_light(image: Image.Image, color: tuple[int, int, int], amount: float) -> Image.Image:
    overlay = Image.new("RGB", image.size, color)
    return Image.blend(image, ImageChops.soft_light(image, overlay), amount)


def water_mask(base: Image.Image) -> Image.Image:
    pixels = np.asarray(base.convert("RGB"), dtype=np.float32)
    red, green, blue = pixels[..., 0], pixels[..., 1], pixels[..., 2]
    height, width = red.shape
    yy, xx = np.ogrid[:height, :width]
    region = (xx > width * 0.51) & (yy > height * 0.55)
    cyan = (blue > red * 1.14) & (green > red * 1.08) & (blue > 112) & (green > 105)
    mask = np.where(region & cyan, 255, 0).astype(np.uint8)
    return Image.fromarray(mask, "L").filter(ImageFilter.GaussianBlur(1.4))


def apply_water_reflection(
    image: Image.Image,
    mask: Image.Image,
    *,
    color: tuple[int, int, int],
    alpha: int,
    center_x: float = 0.79,
    center_y: float = 0.80,
    bands: bool = False,
) -> Image.Image:
    width, height = image.size
    glow = radial_glow(
        image.size,
        (width * center_x, height * center_y),
        (width * 0.23, height * 0.25),
        color,
        alpha,
        1.55,
    )
    glow_alpha = ImageChops.multiply(glow.getchannel("A"), mask)
    glow.putalpha(glow_alpha)
    result = Image.alpha_composite(image.convert("RGBA"), glow)
    if bands:
        band_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(band_layer)
        for index, y in enumerate(range(int(height * 0.66), int(height * 0.94), 14)):
            half_width = int(width * (0.018 + index * 0.004))
            x = int(width * center_x + math.sin(index * 1.7) * width * 0.012)
            draw.rounded_rectangle(
                (x - half_width, y, x + half_width, y + 3),
                radius=2,
                fill=(*color, max(12, int(alpha * 0.42 - index * 1.1))),
            )
        band_layer.putalpha(ImageChops.multiply(band_layer.getchannel("A"), mask))
        result = Image.alpha_composite(result, band_layer.filter(ImageFilter.GaussianBlur(0.7)))
    return result.convert("RGB")


def add_haze(image: Image.Image, color: tuple[int, int, int], alpha: int) -> Image.Image:
    width, height = image.size
    haze = vertical_gradient(
        image.size,
        [
            (0.12, (*color, 0)),
            (0.23, (*color, alpha)),
            (0.36, (*color, int(alpha * 0.72))),
            (0.53, (*color, 0)),
        ],
    ).filter(ImageFilter.GaussianBlur(height * 0.018))
    return Image.alpha_composite(image.convert("RGBA"), haze).convert("RGB")


def add_sun(image: Image.Image, *, center: tuple[float, float], warm: bool) -> Image.Image:
    width, height = image.size
    x, y = width * center[0], height * center[1]
    glow_color = (255, 169, 70) if warm else (255, 245, 190)
    glow = radial_glow(image.size, (x, y), (width * 0.17, height * 0.23), glow_color, 112 if warm else 72, 2.15)
    disc = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(disc)
    radius = max(10, int(width * 0.011))
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 241, 174, 225))
    return Image.alpha_composite(Image.alpha_composite(image.convert("RGBA"), glow), disc).convert("RGB")


def add_night_sky(image: Image.Image) -> Image.Image:
    width, height = image.size
    result = image.convert("RGBA")
    sky = vertical_gradient(
        image.size,
        [
            (0.00, (3, 9, 38, 182)),
            (0.12, (20, 20, 77, 146)),
            (0.28, (47, 37, 102, 84)),
            (0.43, (12, 50, 72, 22)),
            (0.58, (0, 0, 0, 0)),
        ],
    )
    result = Image.alpha_composite(result, sky)
    stars = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(stars)
    rng = random.Random(230)
    for _ in range(58):
        x = rng.randint(int(width * 0.09), int(width * 0.91))
        y = rng.randint(18, int(height * 0.17))
        radius = rng.choice((1, 1, 1, 2))
        opacity = rng.randint(72, 166)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(223, 236, 255, opacity))
    result = Image.alpha_composite(result, stars.filter(ImageFilter.GaussianBlur(0.25)))
    moon_x, moon_y = width * 0.78, height * 0.10
    result = Image.alpha_composite(result, radial_glow(image.size, (moon_x, moon_y), (width * 0.075, height * 0.13), (145, 188, 255), 108, 2.25))
    moon = Image.new("RGBA", image.size, (0, 0, 0, 0))
    moon_draw = ImageDraw.Draw(moon)
    radius = int(width * 0.012)
    moon_draw.ellipse((moon_x - radius, moon_y - radius, moon_x + radius, moon_y + radius), fill=(239, 244, 255, 235))
    return Image.alpha_composite(result, moon).convert("RGB")


def add_vignette(image: Image.Image, strength: int) -> Image.Image:
    width, height = image.size
    yy, xx = np.ogrid[:height, :width]
    distance = np.sqrt(((xx - width / 2) / (width * 0.72)) ** 2 + ((yy - height / 2) / (height * 0.72)) ** 2)
    opacity = np.clip((distance - 0.48) / 0.52, 0, 1) ** 1.7 * strength
    layer = np.zeros((height, width, 4), dtype=np.uint8)
    layer[..., :3] = (4, 12, 28)
    layer[..., 3] = opacity.astype(np.uint8)
    return Image.alpha_composite(image.convert("RGBA"), Image.fromarray(layer, "RGBA")).convert("RGB")


def build_variants(base: Image.Image) -> dict[str, Image.Image]:
    water = water_mask(base)

    pm = grade(base, brightness=1.005, saturation=1.01, contrast=1.005)
    pm = soft_light(pm, (246, 232, 211), 0.045)
    pm = apply_water_reflection(pm, water, color=(72, 190, 245), alpha=28)

    am = grade(base, brightness=1.07, saturation=1.08, contrast=1.02)
    am = soft_light(am, (178, 224, 255), 0.085)
    am = Image.alpha_composite(
        am.convert("RGBA"),
        vertical_gradient(am.size, [(0, (65, 180, 247, 34)), (0.35, (128, 214, 255, 9)), (0.58, (0, 0, 0, 0))]),
    ).convert("RGB")
    am = add_sun(am, center=(0.79, 0.08), warm=False)
    am = apply_water_reflection(am, water, color=(65, 199, 255), alpha=38)

    morning = grade(base, brightness=0.87, saturation=0.91, contrast=1.015)
    morning = soft_light(morning, (105, 123, 181), 0.19)
    morning = Image.alpha_composite(
        morning.convert("RGBA"),
        vertical_gradient(
            morning.size,
            [
                (0.00, (34, 48, 118, 116)),
                (0.18, (91, 75, 151, 94)),
                (0.34, (240, 142, 118, 54)),
                (0.57, (255, 205, 139, 12)),
                (0.78, (0, 0, 0, 0)),
            ],
        ),
    ).convert("RGB")
    morning = add_sun(morning, center=(0.76, 0.18), warm=True)
    morning = add_haze(morning, (213, 221, 226), 42)
    morning = apply_water_reflection(morning, water, color=(255, 210, 151), alpha=48, bands=True)

    evening = grade(base, brightness=0.82, saturation=1.17, contrast=1.055)
    evening = soft_light(evening, (231, 139, 69), 0.24)
    evening = Image.alpha_composite(
        evening.convert("RGBA"),
        vertical_gradient(
            evening.size,
            [
                (0.00, (89, 45, 127, 116)),
                (0.17, (197, 64, 112, 122)),
                (0.34, (255, 112, 52, 110)),
                (0.53, (255, 181, 67, 48)),
                (0.78, (96, 47, 30, 13)),
                (1.00, (0, 0, 0, 0)),
            ],
        ),
    ).convert("RGB")
    evening = add_sun(evening, center=(0.76, 0.18), warm=True)
    evening = apply_water_reflection(evening, water, color=(255, 160, 58), alpha=170, center_y=0.78, bands=True)
    evening = soft_light(evening, (248, 166, 74), 0.08)

    night_luma = ImageOps.grayscale(base)
    night_palette = ImageOps.colorize(night_luma, black=(3, 13, 29), mid=(18, 66, 78), white=(117, 147, 133), midpoint=133)
    night = Image.blend(grade(base, brightness=0.61, saturation=0.72, contrast=1.08), night_palette, 0.56)
    night = add_night_sky(night)
    night = apply_water_reflection(night, water, color=(113, 142, 246), alpha=92, bands=True)
    night = add_vignette(night, 68)

    return {"morning": morning, "am": am, "pm": pm, "evening": evening, "night": night}


def edge_map(image: Image.Image) -> np.ndarray:
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    dx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
    dy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
    edges = dx + dy
    return edges[int(edges.shape[0] * 0.22) : int(edges.shape[0] * 0.96) : 2, ::2]


def best_edge_offset(base: Image.Image, variant: Image.Image) -> tuple[tuple[int, int], float]:
    original = edge_map(base)
    candidate = edge_map(variant)
    best_offset = (99, 99)
    best_score = -1.0
    for y_shift in range(-2, 3):
        for x_shift in range(-2, 3):
            shifted = np.roll(candidate, (y_shift, x_shift), axis=(0, 1))
            score = float(np.corrcoef(original.ravel(), shifted.ravel())[0, 1])
            if score > best_score:
                best_score = score
                best_offset = (x_shift, y_shift)
    return best_offset, best_score


def main() -> None:
    base = Image.open(BASE_PATH).convert("RGB")
    variants = build_variants(base)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, image in variants.items():
        if image.size != base.size:
            raise RuntimeError(f"{name}: geometry size changed from {base.size} to {image.size}")
        offset, correlation = best_edge_offset(base, image)
        if offset != (0, 0):
            raise RuntimeError(f"{name}: edge alignment shifted by {offset}")
        output = OUTPUT_DIR / OUTPUT_NAMES[name]
        image.save(output, "WEBP", quality=WEBP_QUALITY, method=6, exact=True)
        print(f"{name}: {image.size[0]}x{image.size[1]} edge-offset={offset} edge-correlation={correlation:.4f} bytes={output.stat().st_size}")


if __name__ == "__main__":
    main()
