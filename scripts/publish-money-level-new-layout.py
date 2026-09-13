"""Publish only a geometry-audited 4 × 4 hybrid set to the existing runtime names."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HYBRID = ROOT / "art-review/money-level/new-layout/hybrid"
PRODUCTION = ROOT / "public/money-level/art/background"
BACKUP = ROOT / "art-review/money-level/new-layout/old-production"
TIMES = ("morning", "day", "evening", "night")
WEATHERS = ("sunny", "cloudy", "rain", "storm")
SIZE = (1683, 935)


def main() -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts/audit-money-level-new-layout.py")], check=True)
    BACKUP.mkdir(parents=True, exist_ok=True)
    for time in TIMES:
        for weather in WEATHERS:
            name = f"forest-{time}-{weather}"
            source = HYBRID / f"{name}.png"
            target = PRODUCTION / f"{name}-docked.webp"
            backup = BACKUP / target.name
            with Image.open(source) as image:
                if image.size != SIZE:
                    raise ValueError(f"Wrong canvas: {source}: {image.size}")
                pixels = image.convert("RGB")
            if not backup.exists():
                shutil.copy2(target, backup)
            pixels.save(target, format="WEBP", quality=94, method=6)
            with Image.open(target) as published:
                if published.size != SIZE:
                    raise ValueError(f"Wrong published canvas: {target}: {published.size}")
            print(f"Published {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
