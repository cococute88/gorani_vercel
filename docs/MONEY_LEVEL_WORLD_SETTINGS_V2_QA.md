# Money Level World Expansion / Persistent Settings / House Banner v2

This work resumes the tracked and untracked WIP on the existing branch. No reset,
revert, replacement branch, or import of another WIP was performed. Two supplied
screenshots were opened directly; the second contains both the left removal X
and the right banner/corridor arrow. A third separate attachment was not present.

## Completion report in the requested order

1. **Starting main SHA:** `471d7866e5817e9a1691f6f6e33ea698f3dda428`.
   Merged PRs #230 (SPY weather), #231 (activities) and #232 (mobile/lighting)
   are present. Recent Money Level world, ambient, ceremony and mobile changes are included in
   this main baseline. At resume, branch HEAD and fetched origin/main both had
   this SHA. The branch had not yet been pushed, so there was no upstream to pull.
2. **Branch:** `codex/money-level-world-settings-v2`, continued in place.
3. **Existing persistence:** Firebase Auth, shared Firestore client, and
   user-scoped `users/{uid}/uiPreferences` documents already exist. Money Level
   previously read/wrote only the global localStorage v1 key.
4. **Statue reset cause:** the confirmed architectural gap is that statue
   selections had no user-scoped Cloud persistence. Cache/origin loss or another
   session therefore cannot restore them. This environment did not reproduce the
   reported same-origin reset, so an exact physical deletion trigger is **not
   established**. The old component had no automatic default-save effect.
5. **Cloud path/schema:** `users/{uid}/uiPreferences/moneyLevel`,
   `{schemaVersion:2, settings:{...}, updatedAt, migratedFrom?}`. Existing own-user
   Firestore rules cover this document. Server reads distinguish unavailability
   from a missing document. Explicit saves merge field patches; existing rates,
   retirement date and unrelated Cloud settings are preserved.
6. **Legacy migration:** v1 `gorani.money-level.settings.v1` is loaded before
   migration. An absent server document is populated once in a transaction; a
   concurrent existing document wins. A migrated UID marker prevents importing
   another account's legacy global preferences.
7. **Hydration:** explicit `uninitialized/loading/ready`; settings editing is
   disabled until ready and auth scope matches. No save effect exists. No default
   write occurs before hydration, or when both local and Cloud are empty. A
   disposed session cannot publish late hydration into a new user scope.
8. **Custom schema:** `brokerageTextMode`, `brokerageCustomText`, `taxTextMode`,
   `taxCustomText`; `DEFAULT|CUSTOM`. Brokerage accepts two lines, Tax one; each
   line is capped at 18 Unicode characters. CUSTOM survives stage changes;
   DEFAULT resolves the current stage description. Banner title row contains
   house name, level and amount; description occupies the lower row.
9. **Tax old anchor/scale:** center `(1258.884,449.905)`, width `521.73` source px,
   relative scale 100%.
10. **Tax final anchor/scale:** center `(1246.884,414.905)`, width `495.6435`,
    relative scale 95%. Brokerage remains `(599.805,390.35)`, width `622.71`.
11. **Tax movement:** `X -12`, `Y -35` source px, width `-26.0865` source px.
    Y-only candidates were compared first. The resumed candidate is retained
    after compositing the actual fence opening.
12. **Tax card:** `(1208.394,596.785)` → `(1550,363)` source anchor, separately
    resolved and clamped after camera translation. It sits above the corridor;
    it does not move the Tax sprite or force a mobile world zoom-out.
13. **Removed obstacles:** left bench-to-statue stump/rock cluster; right
    foreground fence in front of the Tax lot and its ascending section toward
    the right statue. The right stump and rear fence remain.
14. **Asset count:** 16 production backgrounds, corresponding 16 hybrid source
    appearances, and one latest clean geometry master: **33 image files**.
    Production WebP is lossless to preserve decoded pixels exactly. Several
    formerly lossy daytime files consequently increase to about 2 MB each.
15. **Outside-mask audit:** all 33 files have **0 changed decoded RGB pixels**
    outside the union of LEFT and RIGHT masks against starting main. RIGHT-only
    equality against the preserved LEFT WIP and exact LEFT-patch preservation
    also pass. Final evidence: `right-fence-audit.json`; the previous
    `background-audit.json` is explicitly marked historical LEFT-only evidence.
16. **Geometry audit:** all 16 production canvases are 1683×935; all ten retained
    landmark comparisons report `(0,0)` alignment. Only the two removal masks
    allow intentional geometry changes. Dock, shoreline, pond, pedestals, main
    path, bench, sky, mountains, trees, lots and remaining fences retain their
    existing pixels outside these masks.
17. **Walkable areas:** source-defined opened-left-grass and bench-exit grass;
    Tax-front corridor and right-statue grass. Removed obstacles have no active
    exclusion; remaining house, pond, pedestal, stump, bench and fence exclusions
    remain active. Camera projection uses the shared source world.
18. **Corridor:** central path → Tax front → Tax corridor → fence opening →
    right grass → RIGHT Ceremony. Source nodes and graph edges follow the actual
    grass opening, with pond/shoreline and retained stump/pedestal clearance.
19. **LEFT_A:** anchor `(470,751.6)`, exit `(470,663)`, facing right.
    Polygon: `(410,660),(510,660),(528,706),(528,804),(430,810),(410,780)`.
20. **LEFT_B:** anchor `(694,736)`, exit `(686,661)`, facing left.
    Polygon: `(654,678),(730,676),(753,705),(748,774),(665,780),(649,750)`.
21. **RIGHT:** anchor `(1370,593)`, exit `(1320,593)`, facing right.
    Polygon: `(1305,555),(1378,548),(1403,575),(1401,610),(1348,616),(1305,598)`.
    Wide drop intent and fixed performance anchor remain separate. All slots
    use the approved `ceremony_valentinesday` animation at existing speed 0.5.
22. **Max two:** per-slot ownership keyed by the three logical IDs and the two
    known character IDs. Claim releases all prior ownership for that character
    synchronously. A character can own only one anchor.
23. **Duplicate target:** occupied LEFT_A redirects to nearest free LEFT_B;
    occupied RIGHT redirects to nearest free LEFT_B. A just-vacated slot is
    considered. Long redirects follow the safe graph instead of cutting across
    the pond. If only RIGHT is visible and occupied, the new drop remains on
    safe exit grass rather than dancing on the occupied anchor.
24. **Release regression:** Fishing, Bench, Roam and beginning another drag
    release Ceremony ownership immediately. Existing Fishing/Bench replacement
    still waits for the prior occupant to leave. Real-controller tests check
    route safety, facing, no ghost owners, and disabling statues.
25. **Statue persistence QA:** marble LEFT / gold RIGHT restore after reload,
    route exit/re-entry and tab close/reopen using local fallback in browser QA.
    Cloud hydrate, migration, offline replay, isolation and a fresh session are
    tested with an injected mock adapter. **Live login/logout and same-user
    cross-session Firebase restoration are NOT RUN**; credentials are absent.
26. **Custom QA:** the requested two-line Brokerage text and single-line Tax
    text restore and do not overflow at 1320/980/768/390. DEFAULT stage behavior,
    CUSTOM stage independence, line count and character limits pass unit checks.
27. **Desktop QA:** 1440/1320/1100/980/768 screenshots, all 20 Tax stage mappings,
    world geometry, banner bounds and active Ceremony resize are tested. Asset
    fallback mappings for later Tax stages are preserved. Tax candidates show
    zero alpha over the new corridor at the final placement; the remaining
    stump contact is only the existing feathered artwork edge.
28. **390 QA:** unchanged cover/crop world with horizontal pan and edge auto-pan
    reaches the right statue. Chrome CDP trusted touch verifies long press,
    cancellation, both-character RIGHT drops, duplicate redirect, camera bounds,
    native vertical scroll and existing Fishing/Bench interactions. **A physical
    Android device is NOT RUN.**
29. **Tests:** existing Money Level selector/domain/route/assets/SPY weather/
    layout/activities/mobile/house-lighting/world-follow-up suites; new world-v2
    settings/labels/ownership/connectivity suite and read-only background audit;
    mobile, follow-up, ceremony, house-world, night-final and world-v2 browser
    suites. Raw final evidence is stored with the art review; live Cloud and
    physical-device limitations are explicitly recorded.
30. **Typecheck/lint/build:** **all PASS**, with no lint warnings/errors.
    `validation.json` and `production-build.log` accompany the art review.
    No live Cloud PASS is inferred from compilation.
31. **Commits:** `f935479` world/background/navigation; `7662d93` Ceremony;
    `e5cdeb1` Cloud settings/custom banners; a final documentation/review refresh.
    The final review commit SHA is provided in the handoff.
32. **Draft PR:** [#233](https://github.com/cococute88/gorani_vercel/pull/233).
    No Draft PR existed at resume, so the first Draft PR was created on the same
    branch after push. Verified Draft/open and `autoMergeRequest:null`.
    No merge was performed.
33. **Preview URL:** [Money Level Preview](https://gorani-vercel-git-codex-money-leve-cfcb33-cococute88-s-projects.vercel.app/money-level).
    The runtime implementation deployment passed the Vercel check; the final
    documentation-only refresh uses the same branch alias. Live Firebase login
    and cross-session user settings were not verified by deployment success.

## Added RIGHT-fence blocker evidence

All bounds below use source pixels with exclusive right/bottom edges:

| Item | Bounds |
| --- | --- |
| LEFT stump/rock mask | `[386,552,540,677]` |
| RIGHT overall mask | `[1184,407,1529,584]` |
| RIGHT lower foreground fence support | `[1184,514,1315,584]` |
| RIGHT ascending fence support | `[1406,407,1529,537]` |

The RIGHT mask has a separate subtraction protecting the actual stump cap and
trunk silhouette. Bounds describe the mask support; no rectangle-wide replacement
is performed. Both masks are disjoint. Outside BOTH masks: **0 pixel diff** across
all 33 files. The original left patch is preserved exactly.

The old combined `right-stump-fence` rectangle `(1376,468,70,83)` is replaced by
the actual retained `right-stump` `(1376,494,70,57)` and rear-fence collision
`(1295,294,89,65)`. The removed lower fence has no active collision; the old Tax
card exclusion is also gone. Pond, shoreline rocks, Tax sprite footprint and both
pedestals stay blocked. RIGHT access edges explicitly use `fence_opening`.

Source route from the central path:

`path_center (825,613)` → existing pond-edge grass → `tax_front (1080,600)` →
`tax_corridor (1210,586)` → `fence_opening (1270,575)` → `right_grass (1320,593)` →
`ceremony_right (1370,593)`.

Both production controllers reach RIGHT by walking through this graph. Unit
tests prove connectivity and sample segment safety for both actors across 12
viewport/height combinations. Browser recordings independently observe
`fence_opening` on the walk and final `statue-appreciation` at the fixed anchor.

The same two fence sections are patched in every Morning/Day/Evening/Night ×
Sunny/Cloudy/Rain/Storm appearance. One local donor geometry is transferred with
each variant's existing local LAB appearance field and strictly inward feathering.
No whole-scene regeneration, new decoration, or new dirt path is used. Day Sunny,
Evening Sunny, Night Sunny and Day Rain crops and whole runtime scenes are
included in review.

## Review and reproduction

Open [art review](../art-review/money-level/world-settings-v2/review.html).
Included: 300% right-corridor BEFORE/AFTER; Day Sunny source scene BEFORE/AFTER;
left repair crop; Tax old/Y-up/final for current/largest shipped assets; all 20 Tax
stages; banner before/after; navigation route overlay; three slot polygons/anchors;
responsive DEFAULT/CUSTOM screenshots and 390 trusted-touch RIGHT access.

Read-only checks:

```sh
npm run check:money-level-world-v2
python scripts/check-money-level-background-v2.py
python scripts/audit-money-level-new-layout.py --production
npm run typecheck
npm run lint
npm run build
```

Browser scripts require the existing local Playwright/Chrome QA environment and
a dev server at `MONEY_LEVEL_QA_URL` (default `http://127.0.0.1:3001`). Image patch
scripts are ordered LEFT then RIGHT; do not rerun the LEFT writer on the completed
RIGHT-patched scene. The RIGHT writer archives the incoming LEFT WIP in ignored
`private/` before mutation and never overwrites that baseline during iteration.

Art donors were obtained from localized ImageGen edits and are checked in with
their masks. Only pixels inside explicit mask support are copied into source
assets. The read-only audit independently compares final decoded pixels to the
starting main SHA, without regenerating any image.
