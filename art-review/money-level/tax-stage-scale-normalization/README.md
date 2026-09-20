# Tax early-stage alpha-v2 scale normalization

`*-alpha-v2.webp` is the visual-size master. Runtime replacements keep their original pixels and use only uniform scale plus translation. The fit preserves alpha-bounds area, horizontal centre, and bottom baseline.

| Stage | RGB source | Legacy RGB WebP | Authoritative master | Runtime reference |
|---|---|---|---|---|
| camp-plus | `tax-stage-10-15-camp-plus.png` | `tax-stage-10-15-camp-plus.webp` | `tax-stage-10-15-camp-plus-alpha-v2.webp` | no (master/rollback only) |
| tent-small | `tax-stage-15-20-small-white-tent.png` | `tax-stage-15-20-small-white-tent.webp` | `tax-stage-15-20-small-white-tent-alpha-v2.webp` | no (master/rollback only) |
| tent-large | `tax-stage-20-25-large-white-tent.png` | `tax-stage-20-25-large-white-tent.webp` | `tax-stage-20-25-large-white-tent-alpha-v2.webp` | no (master/rollback only) |
| tent-color | `tax-stage-25-30-colored-tent.png` | `tax-stage-25-30-colored-tent.webp` | `tax-stage-25-30-colored-tent-alpha-v2.webp` | no (master/rollback only) |

| Runtime replacement | Master | Stage | Season | Before area | After area | After width | After height |
|---|---|---|---|---:|---:|---:|---:|
| `temporary-camp-spring-summer.webp` | `tax-stage-10-15-camp-plus-alpha-v2.webp` | camp / camp-plus | spring, summer | 1.344x | 1.000x | 1.036x | 0.965x |
| `temporary-camp-fall.webp` | `tax-stage-10-15-camp-plus-alpha-v2.webp` | camp / camp-plus | fall | 1.552x | 1.000x | 0.974x | 1.027x |
| `temporary-camp-winter.webp` | `tax-stage-10-15-camp-plus-alpha-v2.webp` | camp / camp-plus | winter | 1.478x | 1.000x | 1.007x | 0.993x |
| `temporary-tent-neutral.webp` | `tax-stage-15-20-small-white-tent-alpha-v2.webp` | tent-small | all | 1.444x | 1.000x | 0.945x | 1.058x |
| `temporary-tent-neutral.webp` | `tax-stage-20-25-large-white-tent-alpha-v2.webp` | tent-large | all | 1.042x | 1.000x | 0.967x | 1.034x |
| `temporary-tent-yellow.webp` | `tax-stage-25-30-colored-tent-alpha-v2.webp` | tent-color | all | 1.091x | 1.000x | 0.980x | 1.020x |

Overlay legend: red is the alpha-v2 master, cyan is the runtime replacement, yellow is the shared reference ground line. Every file contains master, before, and after panels.

## Browser verification

`check-money-level-house-hotfix-browser.mjs` covers desktop and mobile, all four seasons, and six representative stages (48 scenarios). The committed `browser-results.json` records resolved paths and DOM placements; the two `preview-*-after.png` contact sheets provide the visual review. The run completed with seven decoded alpha WebPs, zero failed asset requests, and zero console/page errors.
