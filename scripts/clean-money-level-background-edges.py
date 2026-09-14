"""Apply one reviewed ImageGen geometry patch to all 16 approved appearances.

Only the common repair mask changes. Outside it, hybrid PNG pixels stay exact.
The original approved reference is retained; the clean derivative owns audits.
Run --apply only after inspecting the built-in edit candidate.
"""
import argparse
import importlib.util
import json
import io
import subprocess
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "art-review/money-level/edge-cleanup"
ORIGINAL = ROOT / "reference/new_reference.png"
CLEAN = ROOT / "reference/new_reference-clean-edges.png"
HYBRID = ROOT / "art-review/money-level/new-layout/hybrid"
PRODUCTION = ROOT / "public/money-level/art/background"
NAMES = [f"{t}-{w}" for t in ("morning", "day", "evening", "night")
         for w in ("sunny", "cloudy", "rain", "storm")]
# Shared source polygons, never per-variant erasure. Taper into intact water,
# stones, reeds and foliage. Keep the complete stump/fence/plinth unchanged.
REPAIRS = [
    [(1465, 688), (1496, 670), (1530, 636), (1562, 634), (1572, 680),
     (1600, 687), (1640, 722), (1638, 790), (1585, 811), (1530, 785),
     (1455, 747), (1435, 735), (1435, 700)],
]
APPROVED_APPEARANCE_COMMIT = "c8b825382b33d9e9bbbdfc2746dd7f2a82bacc22"

def repair_mask(size):
    mask = Image.new("L", size)
    draw = ImageDraw.Draw(mask)
    for polygon in REPAIRS:
        draw.polygon(polygon, fill=255)
    # Feather inward: exactly zero outside the source-defined polygons.
    values = np.asarray(mask, dtype=np.float32) / 255
    return values * np.asarray(mask.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255

def sheets(directory, suffix):
    full = Image.new("RGB", (1680, 1036), "#111820")
    right = Image.new("RGB", (1920, 1600), "#111820")
    df, dr = ImageDraw.Draw(full), ImageDraw.Draw(right)
    for i, name in enumerate(NAMES):
        image = Image.open(directory / f"forest-{name}{suffix}").convert("RGB")
        x, y = i % 4 * 420, i // 4 * 259
        full.paste(image.resize((420, 234)), (x, y + 25)); df.text((x + 8, y + 5), name, fill="white")
        x, y = i % 4 * 480, i // 4 * 400
        right.paste(image.crop((1370, 490, 1683, 900)).resize((480, 370)), (x, y + 25)); dr.text((x + 8, y + 5), name, fill="white")
    full.save(REVIEW / "final-16-matrix.jpg", quality=94)
    right.save(REVIEW / "final-right-sheet.jpg", quality=96)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    REVIEW.mkdir(parents=True, exist_ok=True)
    original = Image.open(ORIGINAL).convert("RGB")
    candidate = Image.open(args.candidate).convert("RGB")
    candidate_size = candidate.size
    # Register the generated donor's one-pixel encoding-size discrepancy.
    # The original master/world canvas never resizes.
    if candidate.size != original.size:
        candidate = candidate.resize(original.size, Image.Resampling.LANCZOS)
    a = np.asarray(original, dtype=np.float32) / 255
    b = np.asarray(candidate, dtype=np.float32) / 255
    mask = repair_mask(original.size)
    clean = a * (1 - mask[..., None]) + b * mask[..., None]
    clean_pixels = np.clip(clean * 255 + .5, 0, 255).astype(np.uint8)
    Image.fromarray(clean_pixels).save(REVIEW / "clean-master-preview.png")
    Image.fromarray((mask * 255).astype(np.uint8)).save(REVIEW / "repair-mask.png")
    if not args.apply:
        print("Review clean-master-preview.png before --apply"); return
    Image.fromarray(clean_pixels).save(CLEAN)
    spec = importlib.util.spec_from_file_location("appearance", ROOT / "scripts/build-money-level-new-layout.py")
    appearance = importlib.util.module_from_spec(spec); spec.loader.exec_module(appearance)
    old_lab = appearance.srgb_to_lab(a)
    clean_lab = appearance.srgb_to_lab(clean_pixels.astype(np.float32) / 255)
    # Weather ripples/reflection texture are appearance, but old pad/reed and
    # pasted-rectangle boundaries are geometry. Transfer detail only well inside
    # water shared by old/clean masters and away from the contaminated seams.
    def water(rgb):
        return (rgb[..., 2] > rgb[..., 0] * 1.16) & (rgb[..., 2] > rgb[..., 1] * 1.035)
    shared_water = water(a) & water(clean_pixels.astype(np.float32) / 255)
    yy, xx = np.mgrid[:original.height, :original.width]
    shared_water &= (abs(xx - 1495) > 8) & (abs(xx - 1622) > 8) & (abs(yy - 747) > 8)
    water_detail_mask = np.clip(distance_transform_edt(shared_water) / 6, 0, 1)
    records = []
    for name in NAMES:
        file = HYBRID / f"forest-{name}.png"
        relative = file.relative_to(ROOT).as_posix()
        source = subprocess.check_output(["git", "show", f"{APPROVED_APPEARANCE_COMMIT}:{relative}"], cwd=ROOT)
        pixels = np.asarray(Image.open(io.BytesIO(source)).convert("RGB"))
        donor = pixels.astype(np.float32) / 255
        # Import only the already-approved low-frequency appearance difference;
        # never import the old pasted plant/log edges into the clean geometry.
        donor_lab = appearance.srgb_to_lab(donor)
        field = gaussian_filter(donor_lab - old_lab, (12, 12, 0))
        water_detail = donor_lab - gaussian_filter(donor_lab, (6, 6, 0))
        corrected = appearance.lab_to_srgb(clean_lab + field + water_detail * water_detail_mask[..., None] * .75)
        if name == "day-sunny":
            corrected = clean_pixels.astype(np.float32) / 255
        mixed = donor * (1 - mask[..., None]) + corrected * mask[..., None]
        output = np.clip(mixed * 255 + .5, 0, 255).astype(np.uint8)
        outside_changed = int(np.count_nonzero(np.any(output[mask == 0] != pixels[mask == 0], axis=-1)))
        assert outside_changed == 0, "Time/weather artwork outside repair must stay exact"
        image = Image.fromarray(output)
        temporary_png = file.with_suffix(".replacement.png")
        image.save(temporary_png, optimize=True)
        os.replace(temporary_png, file)
        target = PRODUCTION / f"forest-{name}-docked.webp"
        temporary_webp = target.with_suffix(".replacement.webp")
        image.save(temporary_webp, format="WEBP", quality=94, method=6)
        os.replace(temporary_webp, target)
        records.append({"name": name, "outsideChangedPixels": outside_changed, "size": list(image.size)})
    sheets(PRODUCTION, "-docked.webp")
    (REVIEW / "audit.json").write_text(json.dumps({"candidateSize": candidate_size, "worldSize": original.size, "polygons": REPAIRS, "variants": records}, indent=2))
    print("16 common geometry repairs applied; outside PNG pixels unchanged")

if __name__ == "__main__":
    main()
