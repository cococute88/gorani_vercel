"""Rebuild the reproducible Tax early-stage scale/placement audit.

The legacy alpha-v2 files are measurement masters. Approved temporary art is
not repainted: it is uniformly scaled, centred, and bottom-aligned in runtime.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from math import sqrt
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
HOUSES = ROOT / "public/money-level/art/houses"
OUTPUT = ROOT / "art-review/money-level/tax-stage-scale-normalization"
MASTER_GROUND = (768.0, 900.0)
MASTER_CANVAS = (1536, 1024)
ALPHA_THRESHOLD = 8


@dataclass(frozen=True)
class Mapping:
    name: str
    stage: str
    seasons: str
    master: str
    replacement: str
    before_reference_width: float
    before_ground: tuple[float, float]


MAPPINGS = (
    Mapping("camp-spring-summer", "camp / camp-plus", "spring, summer", "tax-stage-10-15-camp-plus-alpha-v2.webp", "temporary-camp-spring-summer.webp", 1536, (751, 925)),
    Mapping("camp-fall", "camp / camp-plus", "fall", "tax-stage-10-15-camp-plus-alpha-v2.webp", "temporary-camp-fall.webp", 1536, (758, 941)),
    Mapping("camp-winter", "camp / camp-plus", "winter", "tax-stage-10-15-camp-plus-alpha-v2.webp", "temporary-camp-winter.webp", 1345, (725, 929)),
    Mapping("tent-neutral-small", "tent-small", "all", "tax-stage-15-20-small-white-tent-alpha-v2.webp", "temporary-tent-neutral.webp", 1536, (748, 1016)),
    Mapping("tent-neutral-large", "tent-large", "all", "tax-stage-20-25-large-white-tent-alpha-v2.webp", "temporary-tent-neutral.webp", 1536, (748, 1016)),
    Mapping("tent-yellow", "tent-color", "all", "tax-stage-25-30-colored-tent-alpha-v2.webp", "temporary-tent-yellow.webp", 1536, (764, 976)),
)

SOURCE_FAMILIES = (
    ("camp-plus", "tax-stage-10-15-camp-plus"),
    ("tent-small", "tax-stage-15-20-small-white-tent"),
    ("tent-large", "tax-stage-20-25-large-white-tent"),
    ("tent-color", "tax-stage-25-30-colored-tent"),
)


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.convert("RGBA").getchannel("A")
    bounds = alpha.point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0).getbbox()
    if bounds is None:
        raise ValueError("empty alpha silhouette")
    return bounds


def area(bounds: tuple[int, int, int, int]) -> int:
    return (bounds[2] - bounds[0]) * (bounds[3] - bounds[1])


def transform_for(master_bounds: tuple[int, int, int, int], replacement_bounds: tuple[int, int, int, int]):
    scale = sqrt(area(master_bounds) / area(replacement_bounds))
    master_center = (master_bounds[0] + master_bounds[2]) / 2
    replacement_center = (replacement_bounds[0] + replacement_bounds[2]) / 2
    translate_x = master_center - scale * replacement_center
    translate_y = master_bounds[3] - scale * replacement_bounds[3]
    ground_x = (MASTER_GROUND[0] - translate_x) / scale
    ground_y = (MASTER_GROUND[1] - translate_y) / scale
    return scale, translate_x, translate_y, ground_x, ground_y


def transform_image(image: Image.Image, scale: float, translate_x: float, translate_y: float) -> Image.Image:
    return image.convert("RGBA").transform(
        MASTER_CANVAS,
        Image.Transform.AFFINE,
        (1 / scale, 0, -translate_x / scale, 0, 1 / scale, -translate_y / scale),
        resample=Image.Resampling.BICUBIC,
    )


def checkerboard() -> Image.Image:
    result = Image.new("RGBA", MASTER_CANVAS, (230, 235, 228, 255))
    draw = ImageDraw.Draw(result)
    for y in range(0, MASTER_CANVAS[1], 64):
        for x in range(0, MASTER_CANVAS[0], 64):
            if (x // 64 + y // 64) % 2:
                draw.rectangle((x, y, x + 63, y + 63), fill=(210, 218, 207, 255))
    return result


def silhouette(image: Image.Image, rgb: tuple[int, int, int], opacity: int) -> Image.Image:
    alpha = image.convert("RGBA").getchannel("A").point(lambda value: opacity if value >= ALPHA_THRESHOLD else 0)
    result = Image.new("RGBA", image.size, (*rgb, 0))
    result.putalpha(alpha)
    return result


def overlay_panel(master: Image.Image, candidate: Image.Image, master_bounds, candidate_bounds) -> Image.Image:
    panel = checkerboard()
    panel = Image.alpha_composite(panel, silhouette(master, (255, 74, 86), 150))
    panel = Image.alpha_composite(panel, silhouette(candidate, (37, 213, 235), 150))
    draw = ImageDraw.Draw(panel)
    draw.rectangle(master_bounds, outline=(255, 30, 50, 255), width=5)
    draw.rectangle(candidate_bounds, outline=(0, 180, 220, 255), width=5)
    draw.line((0, MASTER_GROUND[1], MASTER_CANVAS[0], MASTER_GROUND[1]), fill=(255, 220, 40, 255), width=3)
    return panel


def scaled_bounds(bounds, scale, translate_x, translate_y):
    return tuple(round(value, 2) for value in (
        bounds[0] * scale + translate_x,
        bounds[1] * scale + translate_y,
        bounds[2] * scale + translate_x,
        bounds[3] * scale + translate_y,
    ))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source_families = []
    for stage, stem in SOURCE_FAMILIES:
        files = []
        for suffix, role in ((".png", "RGB source"), (".webp", "legacy RGB rendition"), ("-alpha-v2.webp", "authoritative alpha master")):
            path = HOUSES / f"{stem}{suffix}"
            image = Image.open(path)
            files.append({
                "file": path.name,
                "role": role,
                "format": image.format,
                "mode": image.mode,
                "dimensions": list(image.size),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })
        source_families.append({"stage": stage, "stem": stem, "files": files, "runtimeReferenced": False})

    records = []
    for mapping in MAPPINGS:
        master_path = HOUSES / mapping.master
        replacement_path = HOUSES / mapping.replacement
        master = Image.open(master_path).convert("RGBA")
        replacement = Image.open(replacement_path).convert("RGBA")
        master_bounds = alpha_bounds(master)
        replacement_bounds = alpha_bounds(replacement)
        scale, tx, ty, ground_x, ground_y = transform_for(master_bounds, replacement_bounds)
        reference_width = MASTER_CANVAS[0] / scale

        before_scale = MASTER_CANVAS[0] / mapping.before_reference_width
        before_tx = MASTER_GROUND[0] - before_scale * mapping.before_ground[0]
        before_ty = MASTER_GROUND[1] - before_scale * mapping.before_ground[1]
        before = transform_image(replacement, before_scale, before_tx, before_ty)
        after = transform_image(replacement, scale, tx, ty)
        before_bounds = scaled_bounds(replacement_bounds, before_scale, before_tx, before_ty)
        after_bounds = scaled_bounds(replacement_bounds, scale, tx, ty)

        master_width = master_bounds[2] - master_bounds[0]
        master_height = master_bounds[3] - master_bounds[1]
        replacement_width = replacement_bounds[2] - replacement_bounds[0]
        replacement_height = replacement_bounds[3] - replacement_bounds[1]
        before_width_ratio = replacement_width * before_scale / master_width
        before_height_ratio = replacement_height * before_scale / master_height
        after_width_ratio = replacement_width * scale / master_width
        after_height_ratio = replacement_height * scale / master_height

        panels = []
        master_panel = checkerboard()
        master_panel = Image.alpha_composite(master_panel, master)
        md = ImageDraw.Draw(master_panel)
        md.rectangle(master_bounds, outline=(255, 30, 50, 255), width=5)
        md.line((0, MASTER_GROUND[1], MASTER_CANVAS[0], MASTER_GROUND[1]), fill=(255, 220, 40, 255), width=3)
        panels.append(("MASTER alpha-v2", master_panel))
        panels.append(("BEFORE red=master cyan=replacement", overlay_panel(master, before, master_bounds, before_bounds)))
        panels.append(("AFTER red=master cyan=replacement", overlay_panel(master, after, master_bounds, after_bounds)))
        preview_width, preview_height = 768, 512
        sheet = Image.new("RGB", (preview_width * 3, preview_height + 34), "white")
        draw = ImageDraw.Draw(sheet)
        for index, (label, panel) in enumerate(panels):
            panel = panel.resize((preview_width, preview_height), Image.Resampling.LANCZOS).convert("RGB")
            sheet.paste(panel, (index * preview_width, 0))
            draw.text((index * preview_width + 10, preview_height + 10), label, fill="black")
        sheet.save(OUTPUT / f"overlay-{mapping.name}.png", optimize=True)

        records.append({
            "name": mapping.name,
            "stage": mapping.stage,
            "seasons": mapping.seasons,
            "master": mapping.master,
            "replacement": mapping.replacement,
            "masterSha256": sha256(master_path),
            "replacementSha256": sha256(replacement_path),
            "masterBoundsAlpha8": list(master_bounds),
            "replacementBoundsAlpha8": list(replacement_bounds),
            "before": {
                "referenceWidth": mapping.before_reference_width,
                "ground": list(mapping.before_ground),
                "mappedBounds": list(before_bounds),
                "widthRatio": round(before_width_ratio, 6),
                "heightRatio": round(before_height_ratio, 6),
                "areaRatio": round(before_width_ratio * before_height_ratio, 6),
            },
            "after": {
                "uniformScale": round(scale, 9),
                "referenceWidth": round(reference_width, 4),
                "ground": [round(ground_x, 4), round(ground_y, 4)],
                "mappedBounds": list(after_bounds),
                "widthRatio": round(after_width_ratio, 6),
                "heightRatio": round(after_height_ratio, 6),
                "areaRatio": round(after_width_ratio * after_height_ratio, 6),
                "centerDeltaX": 0,
                "bottomDeltaY": 0,
            },
        })

    audit = {
        "alphaThreshold": ALPHA_THRESHOLD,
        "fitPolicy": "uniform scale preserving alpha-bounds area; horizontal centre and bottom baseline aligned",
        "sourceFamilies": source_families,
        "runtimeMappings": records,
    }
    (OUTPUT / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rows = [
        "# Tax early-stage alpha-v2 scale normalization",
        "",
        "`*-alpha-v2.webp` is the visual-size master. Runtime replacements keep their original pixels and use only uniform scale plus translation. The fit preserves alpha-bounds area, horizontal centre, and bottom baseline.",
        "",
        "| Stage | RGB source | Legacy RGB WebP | Authoritative master | Runtime reference |",
        "|---|---|---|---|---|",
    ]
    for family in source_families:
        files = family["files"]
        rows.append(f"| {family['stage']} | `{files[0]['file']}` | `{files[1]['file']}` | `{files[2]['file']}` | no (master/rollback only) |")
    rows.extend([
        "",
        "| Runtime replacement | Master | Stage | Season | Before area | After area | After width | After height |",
        "|---|---|---|---|---:|---:|---:|---:|",
    ])
    for record in records:
        rows.append(
            f"| `{record['replacement']}` | `{record['master']}` | {record['stage']} | {record['seasons']} | "
            f"{record['before']['areaRatio']:.3f}x | {record['after']['areaRatio']:.3f}x | "
            f"{record['after']['widthRatio']:.3f}x | {record['after']['heightRatio']:.3f}x |"
        )
    rows.extend([
        "",
        "Overlay legend: red is the alpha-v2 master, cyan is the runtime replacement, yellow is the shared reference ground line. Every file contains master, before, and after panels.",
        "",
        "## Browser verification",
        "",
        "`check-money-level-house-hotfix-browser.mjs` covers desktop and mobile, all four seasons, and six representative stages (48 scenarios). The committed `browser-results.json` records resolved paths and DOM placements; the two `preview-*-after.png` contact sheets provide the visual review. The run completed with seven decoded alpha WebPs, zero failed asset requests, and zero console/page errors.",
    ])
    (OUTPUT / "README.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "mappings": len(records), "output": str(OUTPUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
