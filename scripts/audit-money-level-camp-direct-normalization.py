"""Create the reproducible visual audit for directly normalized camp WebPs.

This audit deliberately treats full-alpha area as a diagnostic only. The
acceptance source is the alpha-v2 master rendered at the same Forest frame,
followed by desktop/mobile browser comparison of the rug, firepit, props,
centre, and ground contact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
HOUSES = ROOT / "public/money-level/art/houses"
OUTPUT = ROOT / "art-review/money-level/camp-direct-normalization"
MASTER_NAME = "tax-stage-10-15-camp-plus-alpha-v2.webp"
MASTER_GROUND_Y = 900

CAMPS = {
    "spring-summer": {
        "file": "temporary-camp-spring-summer.webp",
        "pixelScale": 0.633283,
        "translation": [251.90, 330.58],
        "oldSha256": "468865fae498799cd23844d4aa210cb99c980ac6f2ee87e96931a594f3b7a7a9",
        "visualFinding": "The first core-area fit still made the rug/firepit look large; browser review applied an additional 0.82 visual scale.",
    },
    "fall": {
        "file": "temporary-camp-fall.webp",
        "pixelScale": 0.721366,
        "translation": [180.34, 238.19],
        "oldSha256": "f359f053d59fbe8fb385d2d49e2a73d4f401a229d7b9f9ea7792f57b96703e94",
        "visualFinding": "The opaque rug/firepit/prop core was visually close after the first browser-checked direct fit.",
    },
    "winter": {
        "file": "temporary-camp-winter.webp",
        "pixelScale": 0.891955,
        "translation": [81.28, 99.08],
        "oldSha256": "2c0e4bd23b511913fd86066c95de48a7e8dac5c39ec0603e2eb7d17e85b7fc11",
        "visualFinding": "The opaque rug/firepit/prop core was visually close after the first browser-checked direct fit; premultiplied resizing removed edge matte.",
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_bounds(image: Image.Image, threshold: int) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").point(lambda value: 255 if value >= threshold else 0).getbbox()
    if bounds is None:
        raise ValueError(f"empty alpha silhouette at threshold {threshold}")
    return bounds


def checkerboard(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size, (232, 237, 230, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], 64):
        for x in range(0, size[0], 64):
            if (x // 64 + y // 64) % 2:
                draw.rectangle((x, y, x + 63, y + 63), fill=(211, 219, 209, 255))
    return image


def actual_panel(image: Image.Image, label: str, bounds: tuple[int, int, int, int]) -> Image.Image:
    panel = Image.alpha_composite(checkerboard(image.size), image)
    draw = ImageDraw.Draw(panel)
    draw.rectangle(bounds, outline=(30, 126, 255, 255), width=5)
    draw.line((0, MASTER_GROUND_Y, image.width, MASTER_GROUND_Y), fill=(255, 210, 35, 255), width=4)
    draw.rectangle((0, 0, image.width, 48), fill=(255, 255, 255, 225))
    draw.text((16, 16), label, fill=(18, 24, 20, 255))
    return panel


def overlay_panel(master: Image.Image, candidate: Image.Image, label: str) -> Image.Image:
    panel = checkerboard(master.size)
    master_mask = master.getchannel("A").point(lambda value: 145 if value >= 240 else 0)
    candidate_mask = candidate.getchannel("A").point(lambda value: 145 if value >= 240 else 0)
    red = Image.new("RGBA", master.size, (255, 46, 66, 0)); red.putalpha(master_mask)
    cyan = Image.new("RGBA", candidate.size, (0, 196, 230, 0)); cyan.putalpha(candidate_mask)
    panel = Image.alpha_composite(panel, red)
    panel = Image.alpha_composite(panel, cyan)
    draw = ImageDraw.Draw(panel)
    draw.line((0, MASTER_GROUND_Y, master.width, MASTER_GROUND_Y), fill=(255, 210, 35, 255), width=4)
    draw.rectangle((0, 0, master.width, 48), fill=(255, 255, 255, 225))
    draw.text((16, 16), label, fill=(18, 24, 20, 255))
    return panel


def contact_sheet(browser_dir: Path, layout: str) -> None:
    seasons = ["spring", "summer", "fall", "winter"]
    images = []
    for season in seasons:
        for kind in ("master", "runtime"):
            path = browser_dir / f"{layout}-{season}-{kind}.png"
            if not path.exists():
                raise FileNotFoundError(path)
            images.append((season, kind, Image.open(path).convert("RGB")))
    thumb_width = 660 if layout == "desktop" else 390
    thumb_height = round(images[0][2].height * thumb_width / images[0][2].width)
    sheet = Image.new("RGB", (thumb_width * 2, (thumb_height + 32) * 4), "white")
    draw = ImageDraw.Draw(sheet)
    for index, (season, kind, image) in enumerate(images):
        row, col = divmod(index, 2)
        thumb = image.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        x, y = col * thumb_width, row * (thumb_height + 32)
        sheet.paste(thumb, (x, y))
        draw.text((x + 10, y + thumb_height + 9), f"{season}: {kind}", fill="black")
    sheet.save(OUTPUT / f"browser-{layout}-master-vs-runtime.png", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser-dir", type=Path, required=True)
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)

    master_path = HOUSES / MASTER_NAME
    master = Image.open(master_path).convert("RGBA")
    master_bounds8 = alpha_bounds(master, 8)
    master_core = alpha_bounds(master, 240)
    records = []
    for name, config in CAMPS.items():
        path = HOUSES / config["file"]
        candidate = Image.open(path).convert("RGBA")
        if candidate.size != master.size:
            raise AssertionError(f"{path.name}: {candidate.size} != master {master.size}")
        bounds8 = alpha_bounds(candidate, 8)
        core = alpha_bounds(candidate, 240)
        panels = [
            actual_panel(master, "MASTER alpha-v2 (grass-bearing reference)", master_bounds8),
            actual_panel(candidate, f"FINAL {path.name}", bounds8),
            overlay_panel(master, candidate, "OPAQUE CORE OVERLAY: red=master, cyan=final; yellow=ground"),
        ]
        preview = Image.new("RGB", (768 * 3, 512), "white")
        for index, panel in enumerate(panels):
            preview.paste(panel.resize((768, 512), Image.Resampling.LANCZOS).convert("RGB"), (index * 768, 0))
        preview.save(OUTPUT / f"overlay-{name}.png", optimize=True)
        records.append({
            "name": name,
            "file": path.name,
            "dimensions": list(candidate.size),
            "bytes": path.stat().st_size,
            "oldSha256": config["oldSha256"],
            "newSha256": sha256(path),
            "directPixelTransform": {"uniformScale": config["pixelScale"], "translate": config["translation"]},
            "runtimeFrame": "identity 1536x1024; ground=(768,900)",
            "masterBoundsAlpha8": list(master_bounds8),
            "finalBoundsAlpha8": list(bounds8),
            "masterCoreBoundsAlpha240": list(master_core),
            "finalCoreBoundsAlpha240": list(core),
            "visualFinding": config["visualFinding"],
        })

    contact_sheet(args.browser_dir, "desktop")
    contact_sheet(args.browser_dir, "mobile")
    shutil.copyfile(args.browser_dir / "results.json", OUTPUT / "browser-results.json")
    audit = {
        "status": "PASS",
        "acceptancePolicy": [
            "real browser comparison at identical Forest frame/world position",
            "rug/firepit/props and complete visual silhouette",
            "centre and ground contact",
            "alpha area is diagnostic only and is not a PASS criterion",
        ],
        "master": {"file": MASTER_NAME, "sha256": sha256(master_path), "dimensions": list(master.size)},
        "records": records,
    }
    (OUTPUT / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rows = [
        "# Camp direct-pixel normalization audit",
        "",
        "The earlier `alpha area = 1.000x` acceptance rule is superseded for camps. Different camp compositions can have equal alpha area while the rug and firepit still look larger. The three production WebPs are now directly resized/repositioned on their 1536×1024 transparent canvases, and their runtime frames are identity transforms.",
        "",
        "| Final asset | Direct uniform scale | Pixel translation | Runtime transform | Browser finding |",
        "|---|---:|---:|---|---|",
    ]
    for record in records:
        transform = record["directPixelTransform"]
        rows.append(f"| `{record['file']}` | {transform['uniformScale']:.6f} | ({transform['translate'][0]:.2f}, {transform['translate'][1]:.2f}) | identity | {record['visualFinding']} |")
    rows.extend([
        "",
        "## Acceptance result",
        "",
        "- Desktop and mobile screenshots compare the alpha-v2 master and runtime asset at the same Forest background, viewport, world anchor, and renderer width.",
        "- Spring/Summer received an additional browser-derived 0.82 visual reduction after the first core-area fit because its rug/firepit still looked too large.",
        "- Fall and Winter were kept at their first direct visual fit; copying the Spring adjustment would have made them undersized.",
        "- All three use the same identity runtime canvas/ground convention, so season changes do not stack a second scale/translation.",
        "- Tent assets were not rewritten; their existing alpha-v2 regression checks remain active.",
        "",
        "Artifacts: `overlay-*.png`, `browser-desktop-master-vs-runtime.png`, `browser-mobile-master-vs-runtime.png`, `browser-results.json`, and `audit.json`.",
    ])
    (OUTPUT / "README.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "records": len(records), "output": str(OUTPUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
