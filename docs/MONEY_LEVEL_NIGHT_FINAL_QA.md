# PR #232 final Night / Brokerage follow-up

Continues `codex/money-level-mobile-drag-lighting` from synchronized, clean
`6d0ff93412e48f7fde59d057b96642979895ec9c` (after `95ff3b2`). Same Draft PR;
no merge. The two supplied screenshots, including the user's Clip Studio
hard-light reference, were inspected directly. Runtime background artwork is
the fixed geometry/color reference.

## Night material

The old grade removed color twice (`.83 × weather`), ending at `.681` in Storm,
while multiply ambient was only `.05–.075`. This muted the artwork without
enough blue surface illumination. Compared actual Chrome SVG renders of:
multiply only, multiply + soft-light, multiply + overlay, multiply + hard-light.
Hard-light produced the clearest cool surface/detail separation toward the
attached reference. All non-Night house grades and all 16 statue grades retain
their previous exact filter/matrix values.

| Night weather | Saturate factor* | Multiply tint | Multiply strength | Hard-light tint | Hard-light strength |
| --- | ---: | --- | ---: | --- | ---: |
| Sunny | .88 | #103a62 | .18 | #336dac | .15 |
| Cloudy | .84 | #193951 | .20 | #446b9e | .15 |
| Rain | .82 | #103e59 | .20 | #2e789d | .15 |
| Thunderstorm | .80 | #132b49 | .22 | #3b6397 | .15 |

\* Complete time/weather CSS saturation factor before the color composite;
the resulting illustration does not have one uniform HSV saturation value.
Existing brightness and RGB time/weather coefficients remain in place. Night
hue correction is reduced from 14° to 8°. Post-composite contrast is 1.12.

Opaque working-color surfaces prevent native source-over blend alpha growth
(`2A−A²`). The final result is clipped **once** to `SourceAlpha`. A generic
`clamp(2R−G−B−.12) × .55` highlight mask partially restores the pre-tint warm
practical-light colors. No asset-specific painted/window masks. Existing radial
masks on grass-backed WebPs and the existing contact shadow remain unchanged.

Actual runtime SVG rasterization, current/max × all four Night weather states:
alpha delta **0**, transparent tint **0**, black-ink lift **0**. Tests include
25/50/75/100% alpha and anti-aliased edges. Warm fixture red recovery 47–54/255;
blue gain −3…0, confirming practical-light protection is warm rather than blue.
Visual crops retain roof tiles, wall/trim, window frames, door and fence edges.

## Brokerage world anchor

This was a real foreground/background collision after responsive drift had
already been fixed. At the old anchor, the expanded artwork covered 977/3158
protected brown stump pixels; masked cabin/proper-house covered 2797/3158.
House OFF exposes the complete round cut surface beside the bench lantern.

| Kind | Old center (1683×935 source) | New center | Width |
| --- | --- | --- | --- |
| Brokerage | (563.805, 434.35) | (599.805, 390.35) | 622.71, unchanged |
| Tax | (1258.884, 449.905) | unchanged | 521.73, unchanged |

One source-coordinate move **(+36, −44)**, about (+28.2, −34.5) screen pixels
at a 1320px-wide world, clears the stump. A 2-source-pixel candidate grid was
tested; this was the shortest zero-overlap candidate in the tested grid.
All four distinct resolved Brokerage artwork silhouettes cover **0/3158**
protected stump pixels at alpha >25/255 after the move. Source-space 250%
comparisons show the full stump/roots/adjacent rock and the house fence separated.
There are no breakpoint position patches; common cover/crop projection remains.

All 20 configured Brokerage stage mappings were loaded in the actual app.
Current/max, small cabin, expanded cabin, proper house and workshop/two-story
stages were inspected. Unshipped maximum-stage artwork retains the existing
expanded-cabin fallback; no new two-story/mansion PNG is introduced. Tax stage
mapping, anchor and labels remain intact. Narrow brokerage card avoidance stays.

1440/1320/1100/980/768 at browser heights 760 and 1100: inverse source center/
width within .1 master pixel in all 10 combinations. House/stump relative source
offset remains (+164.805, −211.65). Crops show no stump truncation, excessive
bench overlap or house displacement onto the path. House geometry was examined
with ambient OFF before Night lighting ON.

## Validation and reproduction

- All existing Money Level selector/domain/route/assets/weather/layout/activity/
  mobile/house-lighting/world checks PASS. 82 exact-case runtime asset paths and
  all 16 background mappings remain valid; no background files changed here.
- Exact non-Night house grades, all statue grades and unchanged Tax anchor PASS.
- Trusted Android-UA Chrome touch: Forest pan, vertical scroll, 6px tremor,
  long-press drag, edge carry, Dock/Bench drop, Fishing/Bench replacement and
  Pond Watch PASS. Additional 0/5/10/15px jitter, early horizontal/vertical
  intent, delayed movement, acquired vertical movement and cancellation PASS.
- 390px LEFT/RIGHT upper/lower ceremony drops → existing fixed dance anchors;
  global single occupant PASS. Approved input and ceremony implementation unchanged.
- Typecheck, lint (zero warnings), optimized production build PASS. Projection/
  ambient browser checks repeated against the optimized local Preview build.
- **SIMULATED TOUCH PASS; REAL DEVICE REGRESSION NOT RUN.** Previous user Android
  approval remains the physical-device evidence, not a new agent device test.

Review: [interactive review sheet](../art-review/money-level/night-final/review.html),
[Night Brokerage](../art-review/money-level/night-final/night-brokerage.jpg),
[Night Tax](../art-review/money-level/night-final/night-tax.jpg),
[250% geometry](../art-review/money-level/night-final/geometry-source-250-percent.jpg),
[viewport crops](../art-review/money-level/night-final/geometry-viewports.jpg),
[blend candidates](../art-review/money-level/night-final/night-blend-modes.jpg),
and `results.json` / `geometry-candidates.json` in that directory. Original PNG
captures remain in the system temp `money-level-night-final-raw` directory;
checked-in JPEG sheets are review artifacts, not runtime assets.

Run the app on 3001 (or set `MONEY_LEVEL_QA_URL`), then:

```sh
node scripts/check-money-level-night-experiments.mjs
node scripts/check-money-level-night-blends-browser.mjs
node scripts/check-money-level-night-final-browser.mjs
python scripts/build-money-level-night-review.py
```

Python requires Pillow. Scripts use the actual locally installed Chrome and
runtime assets. Intermediates are kept outside the repository. Production-mode
local QA uses a build/start with `VERCEL_ENV=preview` to enable existing Preview
fixture and time/weather overrides. Hosted Preview may use its existing Vercel/
application authentication.

User Preview check: append `?time=night&weather=sunny`, then `rain` and
`thunderstorm`; compare with `&houseAmbient=off`. Check the stump beside the
Brokerage bench lantern at wide/narrow ratios. Leave PR Draft and do not merge
before user visual confirmation.
