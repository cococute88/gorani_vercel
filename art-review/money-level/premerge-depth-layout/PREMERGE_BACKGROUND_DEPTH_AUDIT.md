# Money Level pre-merge background/depth audit

Measured on the PR #234 branch with a 1320×900 desktop viewport and a
390×844 mobile viewport. All values are browser `getBoundingClientRect()` or
decoded-image values; no background artwork was modified.

## Desktop vertical candidates

| Candidate | Header | Stats | Forest outer/client | Footer | Card | Page scroll height | Spring/Fall source-Y coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CURRENT | 74.00 | 110.27 | 576 / 572 | 66.39 | 862.97 | 956 | 79.40% |
| FOREST-ONLY | 74.00 | 110.27 | 690 / 686 | 66.39 | 976.97 | 1070 | 95.23% |
| COMPACT + FOREST (selected) | 57.84 | 82.27 | 690 / 686 | 58.39 | 924.81 | 1002 | 95.23% |
| FULL-Y candidate | 60.00 | 92.27 | 725 / 721 | 60.39 | 973.97 | 1055 | 99.16% |

The selected compromise keeps the 3-column retirement/HP/MP HUD and every
piece of information, while placing the full 690px Forest through the bottom
of the initial 900px viewport. The local QA page includes a 32px offline
snapshot notice; production does not show that notice when live data is
authoritative. Full-Y required materially more page height, so it was not
forced at 900px. At taller desktop viewports the responsive cap reaches 725px.

### Crop calculation

| Layout/season | Source | Scene client | Uniform cover scale | Rendered | Crop top/bottom | Visible source Y | Coverage |
| --- | --- | --- | ---: | --- | ---: | --- | ---: |
| Desktop Spring | 1672×941 | 1280×686 | 0.765550 | 1280×720.38 | 17.19 / 17.19px | 22.46–918.54 | 95.23% |
| Desktop Fall | 1672×941 | 1280×686 | 0.765550 | 1280×720.38 | 17.19 / 17.19px | 22.46–918.54 | 95.23% |
| Desktop Winter | 1683×934 | 1280×686 | 0.760547 | 1280×710.35 | 12.18 / 12.18px | 16.01–917.99 | 96.57% |
| Mobile Spring | 1672×941 | 390×508 (world image 902.63 wide) | 0.539851 | 902.63×508 | 0 / 0px | 0–941 | 100% |

Before the change, Desktop Spring/Fall cropped 74.19 rendered pixels from
both top and bottom, exposing source Y 96.91–844.09 (79.40%). Aspect ratio was
and remains uniform; the defect was insufficient scene height, not asymmetric
`object-position` or non-uniform stretching.

## Statue depth implementation

The old DOM statue (`z-index: 3`) always sat below one shared two-character
Spine stage (`z-index: 4`). A global z-index swap could only reverse the bug.
The final implementation uses one transparent Spine canvas per character in a
shared Forest depth stacking context. Each character and each statue receives
a stable z-order derived from its world-projected ground contact Y. Larger
screen Y is nearer. A statue wins an exact quantized tie.

Accessories remain children of their character's stage, so body, hat and face
overlay cross a statue together. Drag and automatic movement both call the
same `updateCharacterDom` callback, updating depth continuously. Camera pan is
X-only and therefore does not alter the world-ground relation.

### Browser matrix

| Character | Statue | Behind | Front |
| --- | --- | --- | --- |
| Gorani | Left | PASS | PASS |
| Daramji | Left | PASS | PASS |
| Gorani | Right | PASS | PASS |
| Daramji | Right | PASS | PASS |

Mixed depth also passed in both directions:

- Gorani front / Daramji behind
- Gorani behind / Daramji front

Accessory-behind-statue, live drag front→behind→front, mobile left-statue
front/behind, two-statue, and no-statue states all passed. Production smoke
reported two independent canvases, zero failed requests, and zero settled
console/page errors.

## Reproducible commands

```text
npm run check:money-level-statue-depth
npm run check:money-level-premerge-depth-browser
npm run check:money-level-mobile-browser
npm run check:money-level-house-hotfix-browser
npm run check:money-level-follow-up-browser
npm run build
```

The machine-readable browser result is `final-browser/report.json`.
