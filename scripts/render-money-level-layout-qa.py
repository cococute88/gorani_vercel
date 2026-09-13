"""Static Money Level house/pedestal overlay QA at runtime scene proportions."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = ROOT / "art-review/money-level/new-layout/hybrid/forest-day-sunny.png"
HOUSES = ROOT / "public/money-level/art/houses"
OUTPUT = ROOT / "art-review/money-level/new-layout/house-qa"
STONE_BEAR = ROOT / "art-review/money-level/new-layout/stone-bear-transparent.png"
BROKERAGE = (
    "brokerage-stage-35-40-small-cabin.webp",
    "brokerage-stage-40-45-expanded-cabin-alpha.webp",
    "brokerage-stage-45-50-proper-house.webp",
)
TAX = (
    "tax-stage-10-15-camp-plus.webp",
    "tax-stage-15-20-small-white-tent.webp",
    "tax-stage-20-25-large-white-tent.webp",
    "tax-stage-25-30-colored-tent.webp",
)
LANDMARK_BOXES = {
    "bench": (225, 540, 385, 660),
    "left-base": (530, 690, 655, 760),
    "right-base": (1412, 527, 1545, 600),
    "dock": (970, 650, 1300, 845),
}
DOCK_POINTS = {
    "pond_edge": ((926, 646), (916, 674)),
    "pond_land": ((985, 660), (961, 682)),
    "connector": ((1035, 693), (1016, 710)),
    "start": ((1111, 709), (1065, 742)),
    "mid": ((1181, 733), (1115, 762)),
    "fishing": ((1258, 777), (1150, 781)),
}


def background_cover(source: Image.Image, size: tuple[int, int], mobile: bool) -> tuple[Image.Image, float, float, float]:
    width, height = size
    scale = max(width / source.width, height / source.height)
    rendered = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    left = round((rendered.width - width) * (.51 if mobile else .5))
    top = round((rendered.height - height) * .5)
    return rendered.crop((left, top, left + width, top + height)), scale, left, top


def feather_mask(size: tuple[int, int], family: str) -> Image.Image:
    width, height = size
    y, x = np.mgrid[:height, :width]
    xx, yy = x / width, y / height
    if family == "brokerage":
        radius = np.sqrt(((xx - .5) / .49) ** 2 + ((yy - .55) / .47) ** 2)
        inner = .67
    else:
        radius = np.sqrt(((xx - .5) / .39) ** 2 + ((yy - .61) / .35) ** 2)
        inner = .58
    alpha = np.clip((1 - radius) / (1 - inner), 0, 1)
    return Image.fromarray((alpha * 255).astype(np.uint8), "L")


def house_layer(size: tuple[int, int], filename: str, family: str, mobile: bool) -> Image.Image:
    width, height = size
    anchor = ((.28, .43, .55) if family == "brokerage" else (.73, .48, .46)) if mobile else \
             ((.335, .45, .37) if family == "brokerage" else (.718, .485, .31))
    asset_width = round(width * anchor[2])
    with Image.open(HOUSES / filename) as source:
        art = source.convert("RGBA")
        asset_height = round(asset_width * source.height / source.width)
    art = art.resize((asset_width, asset_height), Image.Resampling.LANCZOS)
    if "-alpha." not in filename:
        art.putalpha(feather_mask(art.size, family))
    layer = Image.new("RGBA", size)
    x = round(width * anchor[0] - asset_width / 2)
    y = round(height * anchor[1] - asset_height / 2)
    layer.alpha_composite(art, (x, y))
    return layer


def render(scene: Image.Image, size: tuple[int, int], brokerage: str, tax: str,
           mobile: bool, bear: bool = False) -> tuple[Image.Image, dict[str, float]]:
    frame, scale, left, top = background_cover(scene, size, mobile)
    frame = frame.convert("RGBA")
    broker = house_layer(size, brokerage, "brokerage", mobile)
    camp = house_layer(size, tax, "tax", mobile)
    alpha = Image.fromarray(np.maximum(np.asarray(broker.getchannel("A")),
                                        np.asarray(camp.getchannel("A"))), "L")
    overlap = {}
    a = np.asarray(alpha, dtype=np.float32) / 255
    for name, (x0, y0, x1, y1) in LANDMARK_BOXES.items():
        xx0, yy0 = max(0, round(x0 * scale - left)), max(0, round(y0 * scale - top))
        xx1, yy1 = min(size[0], round(x1 * scale - left)), min(size[1], round(y1 * scale - top))
        overlap[name] = float(np.mean(a[yy0:yy1, xx0:xx1])) if xx1 > xx0 and yy1 > yy0 else 0.0
    frame.alpha_composite(broker)
    frame.alpha_composite(camp)
    if bear:
        with Image.open(STONE_BEAR) as source:
            statue = source.convert("RGBA")
        statue_width = 70 if mobile else 76
        statue = statue.resize((statue_width, round(statue.height * statue_width / statue.width)), Image.Resampling.LANCZOS)
        anchor_x = round(590 * scale - left)
        anchor_y = round(712 * scale - top)
        frame.alpha_composite(statue, (anchor_x - statue_width // 2, anchor_y - statue.height))
    return frame.convert("RGB"), overlap


def contact_sheet(scene: Image.Image, name: str, size: tuple[int, int], mobile: bool) -> None:
    thumb_width = 590 if not mobile else 390
    thumb_height = round(size[1] * thumb_width / size[0])
    columns = 3 if not mobile else 4
    rows = 4 if not mobile else 3
    sheet = Image.new("RGB", (columns * thumb_width, rows * (thumb_height + 28)), "#182018")
    draw = ImageDraw.Draw(sheet)
    for i, broker in enumerate(BROKERAGE):
        for j, camp in enumerate(TAX):
            index = i * 4 + j
            frame, overlap = render(scene, size, broker, camp, mobile)
            thumb = frame.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            col, row = index % columns, index // columns
            x, y = col * thumb_width, row * (thumb_height + 28)
            sheet.paste(thumb, (x, y + 28))
            draw.text((x + 7, y + 7), f"B{i + 1} T{j + 1} bench {overlap['bench']:.2f} left {overlap['left-base']:.2f}", fill="white")
    path = OUTPUT / f"{name}-all-house-stages.jpg"
    sheet.save(path, quality=90)
    print(path)


def dock_markers(scene: Image.Image, name: str, size: tuple[int, int], mobile: bool) -> None:
    frame, scale, left, top = background_cover(scene, size, mobile)
    draw = ImageDraw.Draw(frame)
    for label, locations in DOCK_POINTS.items():
        sx, sy = locations[1 if mobile else 0]
        x, y = sx * scale - left, sy * scale - top
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill="#ffec47", outline="#173a55", width=2)
        draw.text((x + 6, y - 8), label, fill="#ffec47", stroke_width=2, stroke_fill="#173a55")
    frame.save(OUTPUT / f"{name}-dock-points.png")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(BACKGROUND) as source:
        scene = source.convert("RGB")
    for name, size, mobile in (("wide", (1320, 520), False), ("narrow", (980, 520), False), ("tablet", (768, 520), False), ("mobile", (390, 512), True)):
        contact_sheet(scene, name, size, mobile)
        dock_markers(scene, name, size, mobile)
        for label, broker, camp in (
            ("current", BROKERAGE[1], TAX[0]),
            ("max", BROKERAGE[-1], TAX[-1]),
        ):
            frame, overlap = render(scene, size, broker, camp, mobile)
            path = OUTPUT / f"{name}-{label}.png"
            frame.save(path)
            print(f"{path}: " + ", ".join(f"{key}={value:.3f}" for key, value in overlap.items()))
            frame_bear, _ = render(scene, size, broker, camp, mobile, bear=True)
            frame_bear.save(OUTPUT / f"{name}-{label}-bear.png")


if __name__ == "__main__":
    main()
