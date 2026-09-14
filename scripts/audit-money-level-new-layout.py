"""Read-only landmark alignment audit for the 16 new-layout review candidates.

The old weather paintings are appearance references, not geometry references.
This audit compares fixed-object edges against the user-provided layout master.
It reports offsets; a good score alone is not a substitute for visual approval.
"""

import argparse
import io
import subprocess
import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, gaussian_filter, sobel


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "reference/new_reference-clean-edges.png"
DEFAULT_INPUT = ROOT / "art-review/money-level/new-layout/hybrid"
TIMES = ("morning", "day", "evening", "night")
WEATHERS = ("sunny", "cloudy", "rain", "storm")
REPRESENTATIVE = ("day-sunny", "evening-sunny", "day-rain", "night-storm")
LANDMARKS = {
    "bench": (210, 530, 390, 665),
    "circular-base": (515, 675, 665, 765),
    "rectangular-base": (1390, 515, 1540, 620),
    "dock": (960, 640, 1300, 850),
    "shoreline": (1190, 580, 1510, 680),
    "path": (720, 440, 1130, 665),
    "right-statue-zone": (1390, 515, 1540, 620),
    "tax-right-fence": (1370, 400, 1520, 550),
    "right-pond-shoreline": (1510, 580, 1683, 815),
    "lower-right-lily-zone": (1370, 670, 1580, 790),
}


def edges(image: Image.Image, box: tuple[int, int, int, int]) -> np.ndarray:
    values = np.asarray(image.crop(box).convert("L"), dtype=np.float32) / 255
    values = gaussian_filter(values, 1.2)
    return np.hypot(sobel(values, axis=0), sobel(values, axis=1))


def landmark_mask(master: Image.Image, box: tuple[int, int, int, int], name: str,
                  reference: np.ndarray) -> np.ndarray:
    rgb = np.asarray(master.crop(box).convert("RGB"), dtype=np.float32) / 255
    red, green, blue = np.moveaxis(rgb, -1, 0)
    if name in ("tax-right-fence", "right-pond-shoreline", "lower-right-lily-zone"):
        # Geometry contours (fence/reeds/lily pads) matter; weather-dependent
        # water ripple texture is excluded using master material classification.
        material = (green > blue * .95) | ((red > green * 1.07) & (green > blue * 1.08))
    elif name in ("dock", "bench"):
        material = (red > green * 1.07) & (green > blue * 1.08) & (red > .20)
    elif name.endswith("base"):
        material = (np.abs(red - green) < .15) & (np.abs(green - blue) < .15) & (red > .27)
    elif name == "path":
        material = (red > green * 1.07) & (green > blue * 1.10) & (red > .39)
    else:
        # The shoreline landmark consists of gray rock contours, not changing
        # water ripples or lighting; keep the mask on the rocks themselves.
        material = (np.abs(red - green) < .16) & (np.abs(green - blue) < .16) & (red > .25)
    strong_master_edges = reference > np.quantile(reference, .70)
    return binary_dilation(material & strong_master_edges, iterations=2)


def alignment(reference: np.ndarray, candidate: np.ndarray,
              mask: np.ndarray) -> tuple[int, int, float, float]:
    # Trim a margin so all offsets use exactly the same comparison pixels.
    margin = 10
    a = reference[margin:-margin, margin:-margin]
    selected = mask[margin:-margin, margin:-margin]
    best = (-1.0, 0, 0)
    zero = 0.0
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            b = candidate[margin + dy : candidate.shape[0] - margin + dy,
                          margin + dx : candidate.shape[1] - margin + dx]
            aa, bb = a[selected], b[selected]
            score = float(np.sum(aa * bb) / (np.linalg.norm(aa) * np.linalg.norm(bb) + 1e-9))
            if dx == 0 and dy == 0:
                zero = score
            if score > best[0]:
                best = (score, dx, dy)
    return best[1], best[2], best[0], zero


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--representative", action="store_true")
    parser.add_argument("--production", action="store_true", help="audit the 16 published WebP renditions")
    args = parser.parse_args()
    names = REPRESENTATIVE if args.representative else tuple(f"{time}-{weather}"
                                                    for time in TIMES for weather in WEATHERS)
    with Image.open(MASTER) as master:
        size = master.size
        reference = {name: edges(master, box) for name, box in LANDMARKS.items()}
        masks = {name: landmark_mask(master, box, name, reference[name])
                 for name, box in LANDMARKS.items()}
    spec = importlib.util.spec_from_file_location("edge_repairs", ROOT / "scripts/clean-money-level-background-edges.py")
    repairs = importlib.util.module_from_spec(spec); spec.loader.exec_module(repairs)
    repair_mask = repairs.repair_mask(size)
    print(f"Master {size[0]}x{size[1]}: {MASTER}")
    failed = False
    for variant in names:
        hybrid = DEFAULT_INPUT / f"forest-{variant}.png"
        relative = hybrid.relative_to(ROOT).as_posix()
        baseline = subprocess.check_output(["git", "show", f"{repairs.APPROVED_APPEARANCE_COMMIT}:{relative}"], cwd=ROOT)
        before = np.asarray(Image.open(io.BytesIO(baseline)).convert("RGB"))
        after = np.asarray(Image.open(hybrid).convert("RGB"))
        if np.any(before[repair_mask == 0] != after[repair_mask == 0]):
            raise SystemExit(f"FAIL {variant}: approved atmosphere changed outside the repair polygons")
        path = (ROOT / "public/money-level/art/background" / f"forest-{variant}-docked.webp"
                if args.production else args.input / f"forest-{variant}.png")
        with Image.open(path) as image:
            if image.size != size:
                failed = True
                print(f"FAIL {path.name}: wrong dimensions {image.size}")
                continue
            results = {name: alignment(reference[name], edges(image, box), masks[name])
                       for name, box in LANDMARKS.items()}
        offsets = " ".join(f"{name}=({dx:+d},{dy:+d};{score:.2f},zero={zero:.2f})"
                           for name, (dx, dy, score, zero) in results.items())
        drift = any(dx != 0 or dy != 0 for dx, dy, _, _ in results.values())
        print(f"{'REVIEW' if drift else 'OK'} {variant}: {offsets}")
        failed |= drift
    if failed:
        raise SystemExit("Review candidate geometry before runtime replacement")


if __name__ == "__main__":
    main()
