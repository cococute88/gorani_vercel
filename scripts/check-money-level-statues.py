"""Audit the six material packages and render placement review composites."""

from __future__ import annotations

from pathlib import Path
from runpy import run_path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
_house_qa = run_path(str(ROOT / "scripts/render-money-level-layout-qa.py"))
BROKERAGE, TAX = _house_qa["BROKERAGE"], _house_qa["TAX"]
background_cover, house_layer = _house_qa["background_cover"], _house_qa["house_layer"]
STATUES = ROOT / "public/money-level/art/statues"
BACKGROUND = ROOT / "public/money-level/art/background/forest-day-sunny-docked.webp"
OUTPUT = ROOT / "art-review/money-level/new-layout/statue-final-tuning"
MATERIALS = ("none", "stone", "marble", "wood", "gold", "whitegold", "crystal")
SIZES = (("wide", (1320, 520), False), ("narrow", (980, 520), False),
         ("tablet", (768, 520), False), ("mobile", (390, 512), True))


def project(source: tuple[int, int], scene: tuple[int, int], mobile: bool) -> tuple[float, float]:
    width, height = scene
    scale = max(width / 1683, height / 935)
    return (source[0] * scale - (1683 * scale - width) * (.51 if mobile else .5),
            source[1] * scale - (935 * scale - height) * .5)


def validate_assets() -> None:
    for material in MATERIALS[1:]:
        name = f"{material}-bear.png"
        with Image.open(STATUES / name) as image:
            assert image.mode == "RGBA" and image.size == (1219, 1290), name
            alpha = np.asarray(image.getchannel("A"))
            assert alpha.min() == 0 and alpha.max() == 255, name
            assert not alpha[0].any() and not alpha[-1].any(), name
            ys, xs = np.where(alpha > 16)
            assert len(xs) > 250_000 and 81 <= ys.min() <= 84, name
            assert ys.max() == 1237, (name, ys.max())
            assert abs((xs.min() + xs.max()) / 2 - 609) < 16, name
            print(f"{name}: visible x={xs.min()}..{xs.max()} y={ys.min()}..{ys.max()}, alpha={alpha.min()}..{alpha.max()}")


def scene_frame(source: Image.Image, size: tuple[int, int], mobile: bool,
                brokerage: str, material: str, right: bool = False) -> tuple[Image.Image, float]:
    frame, _, _, _ = background_cover(source, size, mobile)
    frame = frame.convert("RGBA")
    house = house_layer(size, brokerage, "brokerage", mobile)
    frame.alpha_composite(house)
    frame.alpha_composite(house_layer(size, TAX[0], "tax", mobile))
    label_source = (590, 310) if mobile else (200, 375)
    card_x, card_y = project(label_source, size, mobile)
    card_x = max(67 if mobile else 80, min(size[0] - (67 if mobile else 80), card_x))
    card_width = 130 if mobile else 155
    card_box = (round(card_x - card_width / 2), round(card_y - 27),
                round(card_x + card_width / 2), round(card_y + 27))
    if material != "none":
        anchor = (1470, 568) if right else (590, 735)
        x, y = project(anchor, size, mobile)
        base_width = (58 if mobile else 62) if right else (70 if mobile else 76)
        scale = 1.3 if right else 1.5
        lift = 3 if right else 2
        width = round(base_width * scale)
        y += (width - base_width) * 52 / 1219 - lift
        with Image.open(STATUES / f"{material}-bear.png") as original:
            art = original.convert("RGBA")
        art = art.resize((width, round(width * art.height / art.width)), Image.Resampling.LANCZOS)
        ix, iy = round(x - width / 2), round(y - art.height)
        statue_mask = Image.new("L", size)
        statue_mask.paste(art.getchannel("A"), (ix, iy))
        statue_pixels = np.asarray(statue_mask) > 16
        house_pixels = np.asarray(house.getchannel("A")) > 100
        intersection = float(np.count_nonzero(statue_pixels & house_pixels) / max(1, np.count_nonzero(statue_pixels)))
        # Masked house images include their faded surrounding lawn. This alpha
        # intersection is diagnostic; review the building silhouette in sheets.
        statue_bbox = statue_mask.point(lambda value: 255 if value > 16 else 0).getbbox()
        if not right and statue_bbox:
            assert card_box[3] + 30 < statue_bbox[1], (size, card_box, statue_bbox)
        frame.alpha_composite(art, (ix, iy))
    else:
        intersection = 0
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle(card_box, radius=8, fill="#fff1c7", outline="#876b4c", width=2)
    draw.text((card_box[0] + 10, card_box[1] + 18), "Brokerage house info", fill="#493824")
    return frame.convert("RGB"), intersection


def main() -> None:
    validate_assets()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(BACKGROUND) as image:
        scene = image.convert("RGB")
    # All seven left-slot states with the currently reviewed middle house stage.
    sheet = Image.new("RGB", (2 * 540, 4 * 380), "#202a21")
    draw = ImageDraw.Draw(sheet)
    for index, material in enumerate(MATERIALS):
        frame, overlap = scene_frame(scene, SIZES[0][1], False, BROKERAGE[1], material)
        detail = frame.crop((25, 145, 565, 495))
        x, y = index % 2 * 540, index // 2 * 380
        sheet.paste(detail, (x, y + 30))
        draw.text((x + 12, y + 9), f"LEFT {material} / current brokerage / house overlap {overlap:.1%}", fill="white")
    sheet.save(OUTPUT / "left-seven-current-house.png")
    # Every available brokerage asset at the four responsive scene sizes.
    for name, size, mobile in SIZES:
        for index, brokerage in enumerate(BROKERAGE):
            frame, overlap = scene_frame(scene, size, mobile, brokerage, "stone")
            frame.save(OUTPUT / f"{name}-brokerage-{index + 1}-stone.png")
            print(f"{name} brokerage-{index + 1}: statue/house visible-alpha intersection {overlap:.1%}")
    right, _ = scene_frame(scene, SIZES[0][1], False, BROKERAGE[1], "stone", right=True)
    right.save(OUTPUT / "wide-right-stone.png")
    print(f"Review: {OUTPUT}")


if __name__ == "__main__":
    main()
