# Money Level new-layout review

- Geometry master: `reference/new_reference.png` (1683 × 935).
- Approved time/weather look: `art-review/money-level/weather-time/docked/` (16 old PNGs).
- `candidates/`: previous ImageGen edits, **rejected for geometry** and retained only as appearance donors.
- `hybrid/`: final 16 geometry-locked PNGs. `hybrid-review-sheet.jpg` and `index.html` show the 4 × 4 matrix and old/new/50% master overlay.
- `old-production/`: the 16 runtime WebPs before replacement.
- `house-qa/`: 12 available Brokerage/Tax art combinations at wide, narrow, tablet, and 390px; current/max stage and optional Stone Bear overlays; dock anchor marker images.
- `stone-bear-transparent.png`: true-alpha extraction from `reference/stone_bear.png`; production copy is `public/money-level/art/statues/stone-bear.png`.

Build the four representative samples with `python scripts/build-money-level-new-layout.py --representative`, inspect, then run `--all`. `python scripts/audit-money-level-new-layout.py` checks exact dimensions and critical landmark shifts; `--production` audits the published WebPs. `python scripts/publish-money-level-new-layout.py` publishes only after a full audit and preserves original WebPs once.

The master owns all fixed object edges. Donors contribute low-frequency Lab lighting/color, master-masked sky/cloud and water-interior appearance, wet dirt, and material-specific wood/foliage color. No donor dock, bench, pedestal, path, shoreline, house lot, or fence shape is copied. All 16 audited with 0px best alignment in six critical landmark masks.

Browser QA was not rerun after the prior computer-use URL safety guard could not verify the target. The guard was not bypassed; the `house-qa` renders and route audits are static QA, not browser proof.
