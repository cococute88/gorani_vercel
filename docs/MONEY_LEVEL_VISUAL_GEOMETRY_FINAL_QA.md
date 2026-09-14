# PR #232 visual and geometry finalization

## WIP and scope

Resumed `codex/money-level-mobile-drag-lighting` at `c8b825382b33d9e9bbbdfc2746dd7f2a82bacc22`. Initial status contained eight modified tracked files and four untracked source/test files, with zero ahead/behind commits. Read status, complete diff, diff stat, recent log and branch before fetching/pulling. Preserved all WIP; no checkout/reset/restore/clean/stash/rebase or new branch/PR.

The user confirmed physical Android long press, character dragging and forest pan on the preceding build. This follow-up does not change the pointer/touch effect, camera, Spine runtime, threshold (280ms), tolerance, capture, ownership, hitboxes or edge pan. Statue grade/size/position are unchanged. No settings persistence or custom banners/labels implemented.

The follow-up messages mention desktop A/B and red-circle screenshots, but those images were not actually attached. Exact screenshot matching is **NOT RUN**. Repairs target independently visible defects in the repository reference, not a claimed comparison with absent annotations.

## House geometry

Old houses used scene percentages with separate mobile percentages; the backdrop used a source-image cover/crop projection. The mixed transforms caused House↔log/fence drift as aspect changed. A Tax -6 screen-pixel lift also changed relative source Y under scaling.

Final image-box geometry in the shared 1683×935 world:

| Kind | Center X | Center Y | Width |
|---|---:|---:|---:|
| Brokerage | 563.805 | 434.350 | 622.710 |
| Tax | 1258.884 | 449.905 | 521.730 |

`houseWorldToViewport` uses `projectForestPoint` and the same cover scale as background landmarks. Tax's lift is baked into source Y. No breakpoint-specific House percentages remain. The brokerage information card alone moves above the image when its viewport clamp would obscure it; inspected 768/980 captures confirm clearance.

DOM inverse projection checks use the actual background bounds, at widths 1440/1320/1100/980/768 and browser heights 760/1100 (10 combinations). House center and width remain within 0.1 source pixel of the fixed world geometry. Independent house/landmark vector checks cover 12 scene ratios, including 390px.

## Ceremony

Old trigger used a 54-source-pixel radius (108 diameter), further constrained by the safe grass: LEFT x430–510/y728–800; RIGHT x1515–1580/y598–645.

Final polygons have bounds LEFT x410–528/y660–810 (118×150), RIGHT x1515–1600/y552–650 (85×98). Tapered polygons represent broad drop intent, not new walkable terrain. Upper reach at 1320×520 is about 72 screen pixels LEFT and 54 RIGHT above the actual dance anchor.

Fixed performance anchors remain LEFT (470,772) with -16 screen-pixel grounding offset, RIGHT (1550,621) with zero offset. Every accepted drop resolves to those anchors and walks there before ceremony. `none` disables the corresponding zone. Existing global coordinator retains one occupant and latest-owner replacement/safe exit.

Trusted Chrome CDP touch at 390px exercised LEFT upper (475,684), LEFT lower (470,794), RIGHT upper (1560,562), RIGHT lower (1555,640), alternating actors. All four resolved to the fixed anchor and `ceremony_valentinesday`, with exactly one ceremony occupant.

## Crisp ambient pipeline

Compared source only, preceding time/weather filter only, ambient only, interrupted filter+ambient, and final. The normal flood interpolation lifted dark ink toward gray/blue. Existing evening/night contrast 0.96/0.94 also lifted black after exposure reduction. Combined desaturation further weakened material separation.

Final uses a low-strength premultiplied multiply surface and equal-alpha interpolation:

`base × opaque ambient color → ambient surface; (1-strength) × base + strength × ambient surface`

Both surfaces have original alpha A (`A×1=A`), including antialiased edges. Transparent RGB remains zero and black ink cannot brighten. No sharpening, blur or new outline. Evening/Night House contrast is 1; Day/Morning Sunny retain their exact preceding base filters. Statue's independent filter/matrix retains all 16 approved grades.

| Time | Ambient color | Strength |
|---|---|---:|
| Day | #87979d | 0 |
| Morning | #91a7b9 | 0 |
| Evening | #946d85 | 0.035 |
| Night | #486a87 | 0.050 |

| Weather | Ambient color | Added strength | Saturation multiplier |
|---|---|---:|---:|
| Sunny | #87979d | 0 | 1 |
| Cloudy | #7d8a98 | 0.015 | 0.86 |
| Rain | #607d96 | 0.020 | 0.84 |
| Thunderstorm | #465b79 | 0.025 | 0.82 |

Time/weather mix into one tint, capped at 0.075 strength. Evening base saturation 0.86, Night 0.83; final Night Storm saturation 0.681, versus Sunny 0.83. Weather remains visibly less saturated without returning to saturate(1).

Actual runtime SVG raster tests with alpha 0/0.25/0.5/0.75/1 and antialiased edges: alpha difference 0, transparent tint count 0, black-ink lift 0. Existing radial masks on opaque grass-background WebPs and existing ground shadow remain unchanged; no new true-alpha cutouts were invented.

Eight states checked for current and maximum Brokerage/Tax stages: Day Sunny, Morning Sunny, Evening Sunny/Cloudy/Rain, Night Sunny/Cloudy/Storm. Current/max images keep roof tiles, timber/door/window boundaries and vegetation detail. Evening retains warm mauve timber/green roof; Night retains cool surfaces and restrained warm light accents; Storm remains darker/cooler with readable edges. Maximum stage uses existing fallback illustration, not newly generated mansion artwork.

Review: [ambient OFF / old washed / new crisp](../art-review/money-level/house-crisp-review/review.html). Full five-step pipeline captures are produced by the browser QA script. Preview/dev supports `houseAmbient=off`; Production does not expose the override.

## Background defects and preservation

The approved original master already contained a rectangular pasted aquatic fragment on the right shore: straight cuts through reeds and a partial water-lily/flower. A disconnected brown wood fragment protruded between reeds below the Tax/statue area. The master-based hybrid process propagated them to all 16 runtime backgrounds.

Used the built-in ImageGen skill for a local geometry-edit candidate, then the user-requested deterministic hybrid method: one common source polygon, a clean master derivative, and low-frequency approved time/weather appearance transfer only inside the repair. Existing water ripple/reflection detail transfers only inside water shared by both masters, away from old plants and contaminated rectangle boundaries. Original `reference/new_reference.png` is retained. Clean source: `reference/new_reference-clean-edges.png`. The final targeted edit is exactly 1683×935, so neither donor nor master is resized in the final patch.

Only 16 mapped `*-docked.webp` runtime backgrounds and their 16 hybrid PNG masters are replaced. Unused historical weather paintings remain historical assets. Complete stump/fence/plinth/bench/dock landmarks are preserved. Outside the shared repair polygon all hybrid PNG pixels are byte-identical to the approved commit; WebP uses the existing quality94 encoding.

Audit adds right statue zone, tax-right fence, right pond shoreline and lower-right lily zone. All 16×10 landmark offsets are (0,0). The audit independently reads the approved PNGs from Git and rejects changes outside the patch. Visually inspected all 16 full scenes and right crops: continuous reeds/water/rocks, no pasted rectangle or orphan wood, time/weather identities retained. Visual acceptance remains for the user; absent red-circle screenshot matching is not claimed.

Review: [4×4 background matrix](../art-review/money-level/edge-cleanup/final-16-matrix.jpg), [enlarged right-side sheet](../art-review/money-level/edge-cleanup/final-right-sheet.jpg), [repair audit](../art-review/money-level/edge-cleanup/audit.json).

Reproduce cleanup: `python scripts/clean-money-level-background-edges.py --candidate art-review/money-level/edge-cleanup/edited-geometry-candidate.png --apply`; requires Pillow, NumPy, SciPy. It reads a pinned approved appearance commit, so repeated application does not compound color transfer.

## Validation and user check

- All non-browser `check:money-level-*` scripts: PASS (selector/domain/route/assets/weather/layout/activities/mobile/lighting/world follow-up).
- House world browser matrix and actual alpha/black-ink invariance: PASS.
- 390px trusted ceremony upper/lower drops: SIMULATED TOUCH PASS.
- Original trusted Android-UA touch regression: PASS (390px, tablet, desktop mouse, pan, native page scroll, jitter grab, camera edges, Dock/Bench, slot replacement, Pond Watch, cancellations).
- Follow-up touch regression: PASS (both actors 0/5/10/15px jitter, delayed moves, acquired vertical drag, early horizontal/vertical intent, cancellation before/after acquisition).
- Physical Android regression on this follow-up: **REAL DEVICE NOT RUN**. Preceding mobile implementation is user-confirmed; no fresh physical pass claimed.
- Typecheck: PASS. Lint: PASS with no warnings. Optimized production build: PASS (18 pages).
- Optimized local production server: House world/lighting matrix PASS (10 ratios, 16 lighting pairs, 32 house comparisons, alpha/black tests); 390px Ceremony four-drop regression PASS.

On Preview: inspect Evening and Night Storm with `?time=night&weather=thunderstorm`; compare `&houseAmbient=off`. Resize between the five widths. At 390px long-press for about 0.3s, carry toward either statue, release near upper or lower zone, verify movement to the same anchor and single ceremony owner. Check edge pan and Dock/Bench drops. PR stays Draft; no merge before user approval.
