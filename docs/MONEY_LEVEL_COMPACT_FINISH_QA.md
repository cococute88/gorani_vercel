# Compact House cards / foreground finishing — Draft PR #233

Continued synchronized `codex/money-level-world-settings-v2` from
`620579cf1db39018182e4937e5ffca405e458514`. All five attachments were opened.
No branch restart/reset/revert/merge. Existing Firebase persistence, House alpha
safe frames, Ceremony/navigation, mobile gesture code and lighting are preserved.

1. **Card width/position:** shared width and max-width **144px**, down from
   204px desktop / 182px mobile. Source label anchors Brokerage `(170,375)`
   (formerly desktop `(200,375)`, mobile `(590,310)`) and Tax `(1513,363)`
   (formerly `(1550,363)`) mirror their horizontal offsets in the 1683px world.
   Both use a 24px minimum outer inset. Actual opposite outer gaps differ by
   under 2px at 1440/1320/1100/980/768/390. House ground/scale remain unchanged.
   Existing avoidance moves Brokerage above its House in tight crops; Tax's
   separate visual-top cap remains and increases to 48px for longer legacy text.
2. **Lv/amount spacing:** flex `gap:2px`, removed amount `margin-left:auto` and
   badge's extra left margin. Header leaf occupies the same row instead of a
   separate content column. Badge padding `0 3px`. Measured gap is 2px.
3. **Two-row structure:** header row (name/Lv/amount), then description block.
   Header font 10px / line-height 14px; badge 8px / 12px; body 9px / 12px.
   Padding is 6px except for the 8px left inset; body top gap is 2px. Both House
   types share typography/layout.
4. **Custom text:** newly edited Brokerage and Tax text both allow two entered
   lines, 12 Unicode characters per line. Both settings textareas use two rows.
   Invalid new edits use native form validation, without
   silently cutting text. No line clamp/ellipsis; wrapping uses `pre-wrap` and
   `overflow-wrap:anywhere`. Existing stored House text is preserved on hydrate
   and unrelated save, even if it exceeds the new-edit limits or needs extra
   visual rows. The storage schema and Cloud/migration flow are unchanged.
5. **Additional removals:** diagonal half-shrub/leaves/two yellow flower remnants
   outside the Brokerage fence; isolated front Tax fence post and its entire
   bush/flower cluster left/below the campfire. Dynamic fire stones, flames,
   props and House fence/silhouette are retained. No new decorative objects.
6. **Patch bounds:** exclusive bounds, source coordinates:
   `LEFT_FINISH_MASK [468,560,585,650]`;
   `TAX_FRONT_FINISH_MASK [985,445,1170,555]`.
   Expanded supports cover all leaf tips, avoiding another half-cut remnant.
   Donors are matching green grass with subtle texture; only masked pixels copy.
7. **16 backgrounds:** Morning/Day/Evening/Night × Sunny/Cloudy/Rain/Storm,
   plus 16 hybrid masters and clean geometry master: **33 files**. Same donor
   geometry transferred through each variant's existing local LAB color field.
   Original LEFT/RIGHT/Tax cleanup direction and RIGHT opening are retained.
8. **Outside-mask diff:** **0 decoded RGB pixel diff** outside the two new
   finishing masks against `620579c` in all 33 files. Read-only audit checks
   dimensions/mask support and exact equality. Cumulative audit excludes only
   intentional removal masks. Sixteen retained landmark audits show zero drift.
   Dock, pond/shoreline, pedestals, main path and remaining fences outside masks
   are exact. Four Tax alpha assets and Brokerage asset pixels are unchanged.
9. **Walkable/collision:** no changes required. The removed isolated post/shrub
   had no dedicated collision; Tax House collision continues to protect actual
   artwork. Existing `tax_front → tax_corridor → fence_opening → right_grass →
   ceremony_right` route and both left slots stay intact. No new graph shortcuts.
10. **Day/Night visual QA:** old/new card and scene comparisons at 1440/768/390,
    DEFAULT/CUSTOM; left and Tax grass BEFORE/AFTER at 300%. Roof/fire/props,
    retained stump/pedestals and corridor remain readable. Night lighting intact.
11. **Desktop/mobile QA:** 24 cases at six widths, two times and two text modes:
    144px width, no header/body horizontal overflow, 2px Lv/amount gap, normal
    card height ≤66px, 8px left padding and balanced outer gaps. Existing long legacy text survives
    hydrate/save/reload. RIGHT touch/pan/edge drag and activity regressions use
    the existing world browser suite. Live signed-in Cloud and physical Android
    are not tested; no remote PASS is claimed.
12. **Validation:** existing Money Level selector/domain/route/assets/weather/
    layout/activities/mobile/lighting/world-follow-up/world-v2/Tax-safe-frame
    checks, strict finishing/cumulative/16-landmark audits, compact browser
    validation and 39-result world browser regression all pass. Typecheck, lint
    and the production build pass.
13. **Commit:** `fix: compact house banners and finish forest grass patches`;
    same branch, normal push. SHA reported in completion message.
14. **Draft/Preview:** [PR #233](https://github.com/cococute88/gorani_vercel/pull/233),
    [Preview](https://gorani-vercel-git-codex-money-leve-cfcb33-cococute88-s-projects.vercel.app/money-level).
    Preview is Vercel login protected. No merge or auto-merge.

[Art review](../art-review/money-level/compact-finish-v3/review.html): actual
runtime BEFORE/AFTER cards, scenes, 300% header/body/grass crops. Machine evidence:
`browser-audit.json`, `foreground-audit.json`, named masks and local donors.
BEFORE uses the completed `620579c` background, CSS and label coordinates; House
artwork/lighting stay the same. Native custom edit validation and legacy restore
are exercised through the Settings dialog, not by rewriting the persistence layer.

Reproduction:

```sh
python scripts/finish-money-level-foreground.py --audit
python scripts/check-money-level-background-v2.py
python scripts/check-money-level-tax-safe-frame.py
python scripts/audit-money-level-new-layout.py --production
# With dev server on port 3001:
node scripts/review-money-level-compact-finish.mjs
python scripts/render-money-level-compact-details.py
```

The writer uses the checked-in `LEFT_FINISH_MASK-donor.png` and
`TAX_FRONT_FINISH_MASK-donor.png` as positional arguments for reproducibility.
Localized ImageGen donors were made from tiny crops; production composition is
deterministic/lossless and strictly masked. Never regenerate the 16 whole scenes.
