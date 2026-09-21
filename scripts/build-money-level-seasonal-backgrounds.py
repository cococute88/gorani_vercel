"""Encode the 76 approved staging PNGs as geometry-identical production WebP.

Encoding only: no resize, crop, transform, redraw, grading, or source mutation.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "background"
OUTPUT_DIR = ROOT / "public/money-level/art/background/seasonal"
SEASONS = ("spring", "summer", "fall", "winter")
TIMES = ("morning", "day", "evening", "night")
WEATHERS = ("sunny", "cloudy", "rain", "storm", "snow")
EXPECTED_COUNTS = {"spring": 20, "summer": 16, "fall": 20, "winter": 20}
WEBP_QUALITY = 94


def expected_names() -> list[str]:
    return [
        f"forest-{season}-{time}-{weather}.png"
        for season in SEASONS
        for time in TIMES
        for weather in WEATHERS
        if not (season == "summer" and weather == "snow")
    ]


def main() -> None:
    expected = expected_names()
    actual = sorted(path.name for path in SOURCE_DIR.glob("forest-*.png"))
    if actual != sorted(expected):
        missing = sorted(set(expected) - set(actual))
        unexpected = sorted(set(actual) - set(expected))
        raise RuntimeError(f"Staging manifest mismatch; missing={missing}, unexpected={unexpected}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUTPUT_DIR.glob("forest-*.webp"):
        if stale.with_suffix(".png").name not in expected:
            raise RuntimeError(f"Unexpected existing production rendition: {stale}")

    source_bytes = 0
    output_bytes = 0
    counts = {season: 0 for season in SEASONS}
    for filename in expected:
        source = SOURCE_DIR / filename
        output = OUTPUT_DIR / source.with_suffix(".webp").name
        with Image.open(source) as master:
            master.load()
            source_size = master.size
            source_mode = "RGBA" if "A" in master.mode else "RGB"
            rendition_source = master.convert(source_mode)
            save_options: dict[str, object] = {
                "format": "WEBP",
                "quality": WEBP_QUALITY,
                "method": 6,
                "exact": True,
            }
            if icc_profile := master.info.get("icc_profile"):
                save_options["icc_profile"] = icc_profile
            rendition_source.save(output, **save_options)

        with Image.open(output) as rendition:
            rendition.load()
            if rendition.size != source_size:
                raise RuntimeError(f"{output}: geometry changed from {source_size} to {rendition.size}")

        season = filename.split("-")[1]
        counts[season] += 1
        source_bytes += source.stat().st_size
        output_bytes += output.stat().st_size
        print(f"{filename} -> {output.name}: {source_size[0]}x{source_size[1]}")

    if counts != EXPECTED_COUNTS:
        raise RuntimeError(f"Production count mismatch: {counts}")
    reduction = 100 * (1 - output_bytes / source_bytes)
    print(f"Encoded {len(expected)} backgrounds; {source_bytes} -> {output_bytes} bytes ({reduction:.1f}% smaller)")


if __name__ == "__main__":
    main()
