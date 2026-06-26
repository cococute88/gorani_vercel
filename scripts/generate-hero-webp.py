#!/usr/bin/env python3
"""Generate the seasonal landing hero WebP files from the source PNGs.

This is the single, reproducible pipeline for every landing hero so all
seasons share one identical quality standard (requirement: no season may be
encoded differently from the others).

Recipe
------
- Color:      flatten to RGB (drop alpha / unused channels) -> smaller, no
              accidental premultiply halos around the character outline.
- Resize:     none. The source PNGs are already at their native ~1335px width,
              which is the hard resolution ceiling for the hero. We never
              upscale (that only adds bytes and blur) and never downscale here
              (Next.js' image optimizer produces the smaller responsive
              variants on demand from this master file).
- Encoder:    libwebp lossy, method=6 (max analysis effort -> best quality at a
              given size), quality=90.
- Metadata:   stripped (Pillow writes no EXIF/ICC unless asked), keeping files
              lean.

Why quality 90 (raised from the previous 78)
--------------------------------------------
At q78 the detail-heavy heroes (summer/beach/fall) measured only ~32-34 dB
PSNR vs. the PNG original -- below the ~35 dB threshold where WebP block
artifacts become visible on leaves, grass, flower edges and the character
outline, and worse on Retina where the 1335px master is upscaled to fill the
hero. q90 lifts every hero to ~37-39 dB (visually near-transparent) for a
reasonable size increase. Because the landing page is season-gated and renders
exactly one hero, the real per-visit transfer cost is only the delta of a
single image (~+90-140 KB), not the sum of all seven.

Usage
-----
    pip install Pillow
    python3 scripts/generate-hero-webp.py            # regenerate all heroes
    python3 scripts/generate-hero-webp.py --quality 86

Run from the repository root. Source PNGs must be present in the root.
"""

from __future__ import annotations

import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover - guidance only
    sys.exit("Pillow is required: pip install Pillow")

# Each entry: (source PNG in repo root, output WebP under public/).
# Keep this list in sync with components/auth/LandingLogin.tsx HERO_IMAGES.
HEROES = [
    ("gorani_spring.png", "public/gorani_spring.webp"),
    ("gorani_summer.png", "public/gorani_summer.webp"),
    ("gorani_beach.png", "public/gorani_beach.webp"),
    ("gorani_fall.png", "public/gorani_fall.webp"),
    ("gorani_winter.png", "public/gorani_winter.webp"),
    ("gorani_newyear_1.png", "public/gorani_newyear_1.webp"),
    ("gorani_newyear_2.png", "public/gorani_newyear_2.webp"),
]

# Tuned defaults -- see module docstring for the rationale.
DEFAULT_QUALITY = 90
DEFAULT_METHOD = 6


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quality", type=int, default=DEFAULT_QUALITY,
                        help=f"WebP quality 0-100 (default {DEFAULT_QUALITY})")
    parser.add_argument("--method", type=int, default=DEFAULT_METHOD,
                        help=f"WebP method/effort 0-6 (default {DEFAULT_METHOD})")
    args = parser.parse_args()

    root = os.getcwd()
    total_before = 0
    total_after = 0
    missing = []

    for src, dst in HEROES:
        src_path = os.path.join(root, src)
        dst_path = os.path.join(root, dst)
        if not os.path.exists(src_path):
            missing.append(src)
            continue

        before = os.path.getsize(dst_path) if os.path.exists(dst_path) else 0
        with Image.open(src_path) as im:
            rgb = im.convert("RGB")
            rgb.save(
                dst_path,
                format="WEBP",
                quality=args.quality,
                method=args.method,
            )
        after = os.path.getsize(dst_path)
        total_before += before
        total_after += after
        w, h = rgb.size
        delta = after - before
        print(f"{dst:<34} {w}x{h}  {before/1024:6.0f}KB -> "
              f"{after/1024:6.0f}KB  ({delta/1024:+.0f}KB)")

    print("-" * 72)
    print(f"q{args.quality}/method{args.method}  total {total_before/1024:.0f}KB"
          f" -> {total_after/1024:.0f}KB  ({(total_after-total_before)/1024:+.0f}KB)")
    if missing:
        print(f"WARNING: missing source PNGs: {', '.join(missing)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
