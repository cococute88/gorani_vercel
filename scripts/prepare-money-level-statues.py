"""Deterministically package supplied transparent statues on a shared canvas/baseline.

The original opaque stone reference is intentionally not used: the previously
approved transparent extraction is the source for that material.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/money-level/art/statues"
REVIEW = ROOT / "art-review/money-level/new-layout/stone-bear-transparent.png"
CANVAS = (1219, 1290)
VISIBLE_HEIGHT = 1160
BASELINE = 1240
MATERIALS = ("stone", "marble", "wood", "gold", "whitegold", "crystal")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for material in MATERIALS:
        source_path = REVIEW if material == "stone" else ROOT / "reference" / f"{material}_bear.png"
        with Image.open(source_path) as original:
            source = original.convert("RGBA")
        alpha = source.getchannel("A")
        box = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
        if box is None or alpha.getextrema() != (0, 255):
            raise ValueError(f"Expected a transparent visible statue: {source_path}")
        # Include the anti-aliased edge around the measured visible bounds.
        box = (max(0, box[0] - 2), max(0, box[1] - 2),
               min(source.width, box[2] + 2), min(source.height, box[3] + 2))
        cropped = source.crop(box)
        width = round(cropped.width * VISIBLE_HEIGHT / cropped.height)
        art = cropped.resize((width, VISIBLE_HEIGHT), Image.Resampling.LANCZOS)
        if width > CANVAS[0]:
            raise ValueError(f"Statue exceeds target canvas: {source_path}")
        result = Image.new("RGBA", CANVAS)
        result.alpha_composite(art, ((CANVAS[0] - width) // 2, BASELINE - VISIBLE_HEIGHT))
        destination = OUTPUT / f"{material}-bear.png"
        result.save(destination, optimize=True)
        final_bounds = result.getchannel("A").point(lambda value: 255 if value > 16 else 0).getbbox()
        print(f"{material}: {source_path.name} {source.size} {box} -> {destination.name} {final_bounds}")


if __name__ == "__main__":
    main()
