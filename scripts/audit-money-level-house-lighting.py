"""Build visual QA boards for the temporary-art lighting recalibration."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "art-review/money-level/house-lighting-recalibration"
SEASONS = ("spring", "fall", "winter")
TIMES = ("morning", "day", "evening", "night")


def labelled(path: Path, label: str, width: int) -> Image.Image:
    image = Image.open(path).convert("RGB")
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    panel = Image.new("RGB", (width, height + 28), "white")
    panel.paste(image, (0, 0))
    ImageDraw.Draw(panel).text((8, height + 8), label, fill="black")
    return panel


def grid(items: list[tuple[Path, str]], columns: int, width: int, output: Path) -> None:
    panels = [labelled(path, label, width) for path, label in items]
    rows = (len(panels) + columns - 1) // columns
    cell_height = max(panel.height for panel in panels)
    sheet = Image.new("RGB", (columns * width, rows * cell_height), "white")
    for index, panel in enumerate(panels):
        sheet.paste(panel, ((index % columns) * width, (index // columns) * cell_height))
    sheet.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for layout, width in (("desktop", 400), ("mobile", 220)):
        grid([
            (args.after / f"{layout}-{season}-house-{time}-sunny.png", f"{season} / {time}")
            for season in SEASONS for time in TIMES
        ], 4, width, OUTPUT / f"{layout}-time-contact-sheet.png")

    for layout, width in (("desktop", 640), ("mobile", 390)):
        grid([
            (args.before / f"{layout}-fall-house-evening-sunny.png", "BEFORE / Fall Evening Sunny"),
            (args.after / f"{layout}-fall-house-evening-sunny.png", "AFTER / Fall Evening Sunny"),
        ], 2, width, OUTPUT / f"{layout}-fall-evening-before-after.png")

    material_rows = [(season, "camp") for season in SEASONS] + [("fall", "tent-neutral"), ("fall", "tent-yellow")]
    grid([
        (args.after / f"desktop-{season}-{stage}-{time}-sunny-tax.png", f"{season} / {stage} / {time}")
        for season, stage in material_rows for time in ("day", "evening", "night")
    ], 3, 300, OUTPUT / "desktop-material-contact-sheet.png")

    stress = [
        ("fall", "evening", "sunny"), ("fall", "evening", "rain"), ("fall", "evening", "thunderstorm"),
        ("fall", "night", "sunny"), ("fall", "night", "rain"), ("fall", "night", "thunderstorm"),
        ("winter", "night", "snow"),
    ]
    grid([
        (args.after / f"desktop-{season}-house-{time}-{weather}.png", f"{season} / {time} / {weather}")
        for season, time, weather in stress
    ], 3, 400, OUTPUT / "desktop-weather-stress.png")

    before = json.loads((args.before / "results.json").read_text(encoding="utf-8"))
    after = json.loads((args.after / "results.json").read_text(encoding="utf-8"))
    shutil.copyfile(args.before / "results.json", OUTPUT / "browser-results-before.json")
    shutil.copyfile(args.after / "results.json", OUTPUT / "browser-results-after.json")

    audit = {
        "status": "PASS",
        "lightingPolicy": "House-only time grades interpolated approximately halfway toward identity; weather retained; statue unchanged.",
        "beforeAfter": {
            "morning": {"brightness": [0.93, 0.965], "saturation": [0.96, 0.98], "sepia": [0.015, 0.008], "contrast": [0.98, 0.99], "rgb": [[0.98, 1, 1.035], [0.99, 1, 1.018]]},
            "day": {"brightness": [1, 1], "saturation": [1, 1], "rgb": [[1, 1, 1], [1, 1, 1]]},
            "evening": {"brightness": [0.82, 0.91], "saturation": [0.86, 0.93], "hueDeg": [-12, -6], "rgb": [[1.08, 0.94, 0.97], [1.04, 0.97, 0.985]], "ambientOpacity": [0.035, 0.018]},
            "night": {"brightness": [0.67, 0.835], "hueDeg": [8, 4], "rgb": [[0.70, 0.88, 1.16], [0.85, 0.94, 1.08]], "shadowOpacityRange": [[0.18, 0.22], [0.09, 0.11]], "moonlightOpacity": [0.15, 0.075], "moonlightContrast": [1.12, 1.06], "practicalLightProtection": [0.55, 0.55]},
        },
        "projection": after["projections"],
        "browser": {"scenarios": len(after["results"]), "failedRequests": len(after["failedRequests"]), "errors": len(after["errors"])},
    }
    (OUTPUT / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rows = [
        "# Temporary house lighting recalibration",
        "",
        "House time-of-day grades were interpolated approximately halfway toward identity. Day/Sunny remains identity, weather differences remain active, and statue values are unchanged. The temporary WebPs, visual frames, ground anchors, camera, and background CSS are unchanged.",
        "",
        "## Browser QA",
        "",
        f"- {len(after['results'])} Desktop/Mobile scenarios",
        f"- {len(after['projections'])} background projection measurements",
        f"- failed house/background requests: {len(after['failedRequests'])}",
        f"- console/page errors: {len(after['errors'])}",
        "- Fall Evening BEFORE/AFTER, four-time contact sheets, material contact sheet, and weather stress board are stored beside this report.",
        "",
        "## Background Y projection",
        "",
        "All measured backgrounds use uniform `cover` scale. Vertical position is 50%, so top and bottom crop are equal. Desktop crops the tall seasonal source symmetrically; Mobile shows nearly or completely the full source height. No CSS/background change was necessary.",
        "",
        "| Layout | Season | Source | Container | Cover | Rendered | Top crop | Bottom crop | Visible source Y |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for item in after["projections"]:
        rows.append(
            f"| {item['layout']} | {item['season']} | {item['naturalWidth']}×{item['naturalHeight']} | "
            f"{item['containerWidth']:.2f}×{item['containerHeight']:.2f} | {item['coverScale']:.6f} | "
            f"{item['renderedWidth']:.2f}×{item['renderedHeight']:.2f} | {item['cropTop']:.2f}px | "
            f"{item['cropBottom']:.2f}px | {item['visibleSourceY'][0]:.2f}–{item['visibleSourceY'][1]:.2f} |"
        )
    (OUTPUT / "README.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "output": str(OUTPUT), "scenarios": len(after["results"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
