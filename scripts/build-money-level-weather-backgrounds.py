"""Create production WebP renditions from approved Phase A PNG masters.

This script performs encoding only. It never resizes, crops, warps, grades, or
otherwise edits the approved illustrations.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-review/money-level/weather-time/assets"
OUTPUT_DIR = ROOT / "public/money-level/art/background"
TIMES = ("morning", "day", "evening", "night")
WEATHERS = ("sunny", "cloudy", "rain", "storm")
EXPECTED_SIZE = (1672, 941)
WEBP_QUALITY = 94


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for time in TIMES:
        for weather in WEATHERS:
            filename = f"forest-{time}-{weather}"
            source = SOURCE_DIR / f"{filename}.png"
            output = OUTPUT_DIR / f"{filename}.webp"
            with Image.open(source) as master:
                if master.size != EXPECTED_SIZE:
                    raise RuntimeError(f"{source}: expected {EXPECTED_SIZE}, got {master.size}")
                rgb = master.convert("RGB")
                save_options: dict[str, object] = {
                    "format": "WEBP",
                    "quality": WEBP_QUALITY,
                    "method": 6,
                    "exact": True,
                }
                if icc_profile := master.info.get("icc_profile"):
                    save_options["icc_profile"] = icc_profile
                rgb.save(output, **save_options)

            with Image.open(output) as rendition:
                if rendition.size != EXPECTED_SIZE:
                    raise RuntimeError(f"{output}: encoded geometry changed to {rendition.size}")
            print(f"{filename}: {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]} {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
