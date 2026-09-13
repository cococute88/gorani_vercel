"""Build geometry-locked Money Level weather review art.

The immutable new_reference.png owns every output pixel coordinate. Previous
ImageGen candidates are *appearance donors* only: their low-frequency Lab
lighting/color field is transferred onto the master. No donor object edge,
silhouette, or resize enters the output. Water receives a separate interior
reflection treatment; its shoreline remains the master's.

Run --representative first. Only use --all after reviewing the four samples.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion, distance_transform_edt, gaussian_filter


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "reference/new_reference.png"
DONORS = ROOT / "art-review/money-level/new-layout/candidates"
OUTPUT = ROOT / "art-review/money-level/new-layout/hybrid"
TIMES = ("morning", "day", "evening", "night")
WEATHERS = ("sunny", "cloudy", "rain", "storm")
REPRESENTATIVE = ("day-sunny", "evening-sunny", "day-rain", "night-storm")


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    xyz = linear @ np.array([[.4124564, .3575761, .1804375],
                             [.2126729, .7151522, .0721750],
                             [.0193339, .1191920, .9503041]], dtype=np.float32).T
    xyz /= np.array([.95047, 1, 1.08883], dtype=np.float32)
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]),
                     200 * (f[..., 1] - f[..., 2])], axis=-1)


def lab_to_srgb(lab: np.ndarray) -> np.ndarray:
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], axis=-1)
    xyz = np.where(f ** 3 > .008856, f ** 3, (f - 16 / 116) / 7.787)
    xyz *= np.array([.95047, 1, 1.08883], dtype=np.float32)
    linear = xyz @ np.array([[3.2404542, -1.5371385, -.4985314],
                             [-.9692660, 1.8760108, .0415560],
                             [.0556434, -.2040259, 1.0572252]], dtype=np.float32).T
    linear = np.clip(linear, 0, 1)
    return np.where(linear <= .0031308, linear * 12.92,
                    1.055 * np.power(linear, 1 / 2.4) - .055)


def align_donor(image: Image.Image, size: tuple[int, int]) -> np.ndarray:
    """Only donor appearance is resampled; the geometry master never is."""
    if image.size != size:
        image = image.resize(size, Image.Resampling.BICUBIC)
    return np.asarray(image.convert("RGB"), dtype=np.float32) / 255


def water_interior_mask(master_rgb: np.ndarray) -> np.ndarray:
    height, width = master_rgb.shape[:2]
    y, x = np.mgrid[:height, :width]
    red, green, blue = np.moveaxis(master_rgb, -1, 0)
    # Master blue water is separable from gray rocks and brown dock; only a
    # conservative interior can receive donor reflection texture.
    blue_water = (blue > red * 1.16) & (blue > green * 1.035) & (blue > .34)
    likely_pond = (x > width * .57) & (y > height * .64)
    interior = blue_water & likely_pond
    return np.clip(distance_transform_edt(interior) / 11, 0, 1).astype(np.float32)


def sky_interior_mask(master_rgb: np.ndarray) -> np.ndarray:
    height, width = master_rgb.shape[:2]
    y, x = np.mgrid[:height, :width]
    red, green, blue = np.moveaxis(master_rgb, -1, 0)
    # The line stays several pixels ABOVE the distant mountain silhouette.
    # Bright blue/white classification also removes foreground tree crowns.
    crest_x = np.array([0, 150, 280, 420, 500, 600, 750, 900,
                        1050, 1200, 1300, 1450, 1550, width], dtype=float)
    crest_y = np.array([130, 112, 97, 84, 65, 96, 61, 47,
                        105, 65, 104, 71, 46, 125], dtype=float)
    upper_sky = y < np.interp(x, crest_x, crest_y) - 5
    blue_or_white = (blue > .50) & (blue >= green * .985) & (green >= red * .985)
    interior = upper_sky & blue_or_white
    return np.clip(distance_transform_edt(interior) / 4, 0, 1).astype(np.float32)


def dirt_interior_mask(master_rgb: np.ndarray) -> np.ndarray:
    height, width = master_rgb.shape[:2]
    y, x = np.mgrid[:height, :width]
    red, green, blue = np.moveaxis(master_rgb, -1, 0)
    dirt = (red > .48) & (red > green * 1.075) & (green > blue * 1.12)
    terrain = (y > height * .28) & (y < height * .79)
    keep_dock_master = (x > width * .55) & (y > height * .67)
    interior = dirt & terrain & ~keep_dock_master
    return np.clip(distance_transform_edt(interior) / 5, 0, 1).astype(np.float32)


def dock_wood_mask(master_rgb: np.ndarray) -> np.ndarray:
    height, width = master_rgb.shape[:2]
    y, x = np.mgrid[:height, :width]
    red, green, blue = np.moveaxis(master_rgb, -1, 0)
    return ((x > width * .56) & (x < width * .79)
            & (y > height * .67) & (y < height * .91)
            & (red > green * 1.065) & (green > blue * 1.055) & (red > .28))


def foliage_mask(master_rgb: np.ndarray) -> np.ndarray:
    red, green, blue = np.moveaxis(master_rgb, -1, 0)
    return ((green > red * 1.10) & (green > blue * .84)
            & (green > .18))


def build_one(name: str, master_image: Image.Image, master_rgb: np.ndarray,
              master_lab: np.ndarray, water_mask: np.ndarray,
              sky_mask: np.ndarray, dirt_mask: np.ndarray,
              wood_mask: np.ndarray, leaves_mask: np.ndarray) -> None:
    donor_file = DONORS / f"forest-{name}.png"
    with Image.open(donor_file) as source:
        donor_rgb = align_donor(source, master_image.size)
    if name == "day-sunny":
        # Existing Day Sunny and the approved geometry master already share
        # the intended bright daytime appearance. Exact master is strongest.
        result = master_image.copy()
    else:
        donor_lab = srgb_to_lab(donor_rgb)
        difference = donor_lab - master_lab
        # Local lighting/cloud/haze varies across the scene; 18/45 px fields
        # suppress ImageGen's 1–6 px object drift before transferring color.
        near = gaussian_filter(difference, sigma=(18, 18, 0), mode="reflect")
        broad = gaussian_filter(difference, sigma=(45, 45, 0), mode="reflect")
        field = .55 * near + .45 * broad
        height = master_rgb.shape[0]
        y = np.arange(height, dtype=np.float32)[:, None, None] / height
        # Sky and pond follow donors more closely than stone/wood/ground.
        strength = np.where(y < .25, 1.0, np.where(y < .58, .92, .96))
        output_lab = master_lab + field * strength
        # The dock is surrounded by bright donor water, which dilutes a broad
        # field. Match donor wood's median Lab without importing a moved plank.
        wood_core = binary_erosion(wood_mask, iterations=4)
        wood_offset = np.median(donor_lab[wood_core], axis=0) - np.median(output_lab[wood_core], axis=0)
        output_lab += wood_offset[None, None, :] * wood_mask[..., None]
        # Tree/grass colors are high-frequency material regions. A broad
        # illumination field alone leaves sunny yellow crowns at storm time.
        # Median class transfer darkens/cools the master *in place* without
        # importing a shifted donor leaf silhouette.
        yy = np.arange(height)[:, None]
        for lower, upper in ((.04, .43), (.43, .67), (.67, 1.0)):
            band = (yy >= height * lower) & (yy < height * upper)
            class_mask = leaves_mask & band
            core = binary_erosion(class_mask, iterations=3)
            if np.count_nonzero(core) < 100:
                continue
            offset = np.median(donor_lab[core], axis=0) - np.median(output_lab[core], axis=0)
            feather = np.clip(distance_transform_edt(class_mask) / 3, 0, 1)
            output_lab += offset[None, None, :] * feather[..., None] * .9
        # Retain the donor's cool rain/night leaf hue at a coarse spatial
        # scale; no fine donor edges or relocated leaves are copied.
        donor_chroma = gaussian_filter(donor_lab[..., 1:3], sigma=(9, 9, 0), mode="reflect")
        foliage_feather = np.clip(distance_transform_edt(leaves_mask) / 3, 0, 1)
        chroma_mix = (foliage_feather * .72)[..., None]
        output_lab[..., 1:3] = (output_lab[..., 1:3] * (1 - chroma_mix)
                                 + donor_chroma * chroma_mix)
        # Static water ripples and moon/sunset streaks are appearance, not
        # boundary geometry. Blend medium-frequency donor detail only in the
        # conservative water interior, feathering off before shore/dock.
        water_detail = donor_lab - gaussian_filter(donor_lab, sigma=(7, 7, 0), mode="reflect")
        output_lab += water_detail * water_mask[..., None] * .30
        output_rgb = lab_to_srgb(output_lab)
        # Clouds/lightning/sunset sky and pond reflection are appearance, so
        # donor texture is legal strictly INSIDE master-defined masks. Every
        # tree, mountain, shoreline, dock, stone and flower edge stays master.
        output_rgb = output_rgb * (1 - sky_mask[..., None]) + donor_rgb * sky_mask[..., None]
        # A donor pad/tree shifted by a few pixels must not appear as a
        # second fixed vegetation landmark in otherwise blue master water.
        donor_green = ((donor_rgb[..., 1] > donor_rgb[..., 0] * 1.02)
                       & (donor_rgb[..., 1] > donor_rgb[..., 2] * 1.04))
        water_mix = (water_mask * (~donor_green))[..., None] * .86
        output_rgb = output_rgb * (1 - water_mix) + donor_rgb * water_mix
        if name.endswith("-rain") or name.endswith("-storm"):
            dirt_mix = dirt_mask[..., None] * .76
            output_rgb = output_rgb * (1 - dirt_mix) + donor_rgb * dirt_mix
        output = np.clip(output_rgb * 255 + .5, 0, 255).astype(np.uint8)
        result = Image.fromarray(output, "RGB")
    if result.size != master_image.size:
        raise RuntimeError(f"{name}: production canvas size changed")
    destination = OUTPUT / f"forest-{name}.png"
    result.save(destination, format="PNG", optimize=True)
    print(f"{name}: {destination.name} {result.width}x{result.height}")


def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--representative", action="store_true")
    group.add_argument("--all", action="store_true")
    args = parser.parse_args()
    names = REPRESENTATIVE if args.representative else tuple(f"{time}-{weather}"
                                                        for time in TIMES for weather in WEATHERS)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(MASTER) as source:
        master_image = source.convert("RGB")
    master_rgb = np.asarray(master_image, dtype=np.float32) / 255
    master_lab = srgb_to_lab(master_rgb)
    water_mask = water_interior_mask(master_rgb)
    sky_mask = sky_interior_mask(master_rgb)
    dirt_mask = dirt_interior_mask(master_rgb)
    wood_mask = dock_wood_mask(master_rgb)
    leaves_mask = foliage_mask(master_rgb)
    for name in names:
        build_one(name, master_image, master_rgb, master_lab, water_mask, sky_mask, dirt_mask, wood_mask, leaves_mask)
    if args.all:
        thumb_w, thumb_h = 420, 234
        sheet = Image.new("RGB", (thumb_w * 4, (thumb_h + 25) * 4), "#101512")
        draw = ImageDraw.Draw(sheet)
        for row, time in enumerate(TIMES):
            for col, weather in enumerate(WEATHERS):
                name = f"{time}-{weather}"
                with Image.open(OUTPUT / f"forest-{name}.png") as source:
                    thumb = source.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                x, y = col * thumb_w, row * (thumb_h + 25)
                draw.text((x + 8, y + 6), name, fill="white")
                sheet.paste(thumb, (x, y + 25))
        sheet.save(OUTPUT.parent / "hybrid-review-sheet.jpg", quality=91)


if __name__ == "__main__":
    main()
