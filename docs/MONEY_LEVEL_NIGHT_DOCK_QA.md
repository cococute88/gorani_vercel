# PR #232 — Night dock color-only patch

Started clean and synchronized at `f3919fdac7bf34624283854bcdbc2daea6b78363`
on `codex/money-level-mobile-drag-lighting`. House/Camp ambient, world anchors,
Statue, Ceremony and Android implementation are unchanged.

The gray/olive/blue deck color was baked into the four Night runtime rasters.
The previous layout builder transferred donor Lab appearance and wood median
color into the immutable master. This patch corrects that raster material;
it does not modify the approved House lighting resolver.

Only `public/money-level/art/background/forest-night-{sunny,cloudy,rain,storm}-docked.webp`
changes. Morning/Day/Evening runtime backgrounds are byte-identical to f3919fd.
Approved hybrid/master PNGs and existing background mapping are unchanged.

## Mask / tone

One source-coordinate mask, 25,448 pixels in the 1683×935 canvas: connector,
main dock, front wood fascias and six posts. Its source polygons and exact bounds
are recorded in `art-review/money-level/night-dock/audit.json`. Brown material
selection from the pinned clean master excludes blue water, neutral rocks and
green vegetation. Feathering is inward only; no silhouette expansion.

Lab correction restores missing warm chroma while preserving already-brown
wood and dark illustration outlines. Sunny chroma floor (a*,b*)=(7,10), Cloudy
(6,8), Rain (5.5,7), Storm (5,6). Source L* is retained for Sunny/Cloudy/Rain;
Storm wood midtones receive −1.5 L* so Storm remains darkest. Low-luminance
outlines receive progressively less correction. No raster resize, warp,
redrawing, blur or asset regeneration.

| Night | Appearance | Median wood L* before → after | Geometry offset | Outside-mask changed pixels |
| --- | --- | --- | --- | ---: |
| Sunny | clearest muted brown, cool surrounding moonlight | 32.992 → 32.935 | (0,0) | 0 |
| Cloudy | cooler, lower-chroma brown | 28.988 → 29.024 | (0,0) | 0 |
| Rain | dark subdued brown, existing wet reflection retained | 24.757 → 24.895 | (0,0) | 0 |
| Storm | darkest cool dark brown, wood identity retained | 25.584 → 24.189 | (0,0) | 0 |

Lossless WebP preserves every decoded RGB pixel outside the mask. Each new
file is approximately 2MB (previously approximately .5MB); this avoids the
outside-mask changes that a full lossy re-encode would cause.

## Audit / validation

- Exact reproducibility against pinned f3919fd decoded runtime pixels PASS.
- Outside-mask diff **0** for each of four Night assets.
- Protected water/greenery diff **0**; right-side artifact cleanup region diff **0**.
- Remaining 12 runtime backgrounds: unchanged bytes / recorded SHA-256 PASS.
- Dimensions 1683×935 unchanged. Luminance-edge registration checks ±2 pixels:
  best shift **(0,0)** for all four, correlation **.999805–.999988**. Dock shape,
  plank count, posts, position and shoreline contact are not regenerated.
- All existing Money Level non-browser tests PASS, including 16 background
  mappings, exact-case asset integrity, projection, activities, mobile rules and
  approved House/Statue lighting. WebP integrity test now also validates VP8L
  lossless signatures and packed dimensions.
- Typecheck, lint (zero warnings), production build PASS.
- Native Chrome against optimized local Preview build: four mapped Night
  backgrounds decode at 1683×935 and render with both approved Houses PASS.

Review: [same 200% dock crop, before above / after below](../art-review/money-level/night-dock/before-after-200-percent.jpg),
[mask overlay](../art-review/money-level/night-dock/mask-overlay.png),
[audit](../art-review/money-level/night-dock/audit.json).

Reproduce with Python + Pillow/NumPy/SciPy:

```sh
python scripts/fix-money-level-night-dock-colors.py --apply
python scripts/fix-money-level-night-dock-colors.py
```

Without `--apply` the script audits checked-in files and refreshes review sheets.
Always reads the pinned approved raster so repeated application does not compound
grading. Run this color patch last if deliberately rebuilding prior background
generators. Optional browser check: `node scripts/check-money-level-night-dock-browser.mjs`
against 3001 or `MONEY_LEVEL_QA_URL` with existing Preview overrides enabled.

Same Draft PR #232. No merge; wait for user confirmation.
