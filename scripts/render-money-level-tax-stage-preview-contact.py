"""Build compact contact sheets from house browser-QA screenshots."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


SEASONS = ("spring", "summer", "fall", "winter")
STAGES = ("camp-plus", "tent-small", "tent-large", "tent-color")


def sheet(source: Path, output: Path, layout: str) -> None:
    size = (330, 144) if layout == "desktop" else (195, 255)
    label_height = 22
    result = Image.new("RGB", (size[0] * len(STAGES), (size[1] + label_height) * len(SEASONS)), "white")
    draw = ImageDraw.Draw(result)
    for row, season in enumerate(SEASONS):
        for column, stage in enumerate(STAGES):
            image = Image.open(source / f"{layout}-{season}-{stage}.png").convert("RGB")
            image = image.resize(size, Image.Resampling.LANCZOS)
            x = column * size[0]
            y = row * (size[1] + label_height)
            result.paste(image, (x, y))
            draw.text((x + 6, y + size[1] + 5), f"{season} / {stage}", fill="black")
    result.save(output / f"preview-{layout}-after.png", optimize=True)


def before_after(before: Path, after: Path, output: Path) -> None:
    pairs = (("camp", "camp-plus"), ("tent", "tent-small"), ("colored-tent", "tent-color"))
    size = (660, 287)
    label_height = 22
    result = Image.new("RGB", (size[0] * 2, (size[1] + label_height) * len(pairs)), "white")
    draw = ImageDraw.Draw(result)
    for row, (old_name, new_name) in enumerate(pairs):
        for column, (folder, name, label) in enumerate(((before, old_name, "BEFORE"), (after, new_name, "AFTER"))):
            image = Image.open(folder / f"desktop-spring-{name}.png").convert("RGB").resize(size, Image.Resampling.LANCZOS)
            x = column * size[0]
            y = row * (size[1] + label_height)
            result.paste(image, (x, y))
            draw.text((x + 6, y + size[1] + 5), f"{label} / {new_name}", fill="black")
    result.save(output / "preview-desktop-before-after.png", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--before", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    sheet(args.after, args.output, "desktop")
    sheet(args.after, args.output, "mobile")
    if args.before:
        before_after(args.before, args.after, args.output)
    print(args.output)


if __name__ == "__main__":
    main()
