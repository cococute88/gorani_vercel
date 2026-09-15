# Tax clipping and layering follow-up — Draft PR #233

Subsequent compact-card/foreground finishing evidence:
[MONEY_LEVEL_COMPACT_FINISH_QA.md](MONEY_LEVEL_COMPACT_FINISH_QA.md).
The strict Tax-only background audit below describes commit `620579c`; the final
finishing audit proves exact pixels outside its two new masks against that commit.

Continued `codex/money-level-world-settings-v2` from synchronized commit
`372425e43ca49ce50651ebbed4563180621fdc77`. No branch restart, reset, revert,
merge or auto-merge. The attachment and `tax-2-final.png` were inspected directly.

1. **Exact cause.** SOURCE: all four original PNG/WebP artworks are opaque RGB
   1536×1024; their tent peaks, flames and principal props are intact inside the
   original canvas. Full source content bounds are `[0,0,1536,1024]` because
   grass fills the rectangle; zero alpha margins here do not mean a cut roof.
   RUNTIME: the camp radial mask has radii 39%/35%, center 50%/61%, opaque stop
   58%. Its top support starts at y=266, below both large/colored peaks at y=72/73.
   It cuts tent peaks/poles and fades outer fire stones/props. The cottage
   fallback's 49%/47%, 50%/55%, 67% mask also fades/cuts the colored artwork.
   No house-parent overflow clipping, filter-region subject clipping or layering
   inversion was found. PLACEMENT: a baked rock left of the Tax plot visually
   crowds the fire/plot; it is removed in its own mask. After silhouette repair,
   all four artworks fit without changing Tax placement or scale.

2. **Unique artwork count.** Four. All 20 stage mappings and family fallbacks
   are exercised in the browser and unit audit. Levels 0–2 use camp-plus,
   3 small-white, 4 large-white, 5 colored; 6–19 use colored cottage fallback.
   Brokerage's shared opaque camp fallback is preserved.

3. **Artwork bounds.** Exclusive right/bottom coordinates; original subject-core
   bounds are measured independently from opaque grass. Fixed alpha bounds
   include the lower feathered grass contact. All fixed margins exceed 40px.

   | Artwork | Original subject core | Fixed visible alpha | Top / bottom / left / right margin |
   | --- | --- | --- | --- |
   | camp-plus | `[233,394,1223,894]` | `[149,337,1309,967]` | `337 / 57 / 149 / 227` |
   | small-white | `[228,226,1161,929]` | `[150,224,1262,977]` | `224 / 47 / 150 / 274` |
   | large-white | `[230,72,1333,927]` | `[149,70,1428,975]` | `70 / 49 / 149 / 108` |
   | colored | `[95,73,1429,928]` | `[49,71,1491,977]` | `71 / 47 / 49 / 45` |

4. **Clipped artwork list.** Source clipping: none. Runtime camp-mask clipping
   affects all four: respectively 242 / 4430 / 49530 / 82661 subject-core pixels
   reach zero alpha. Large/colored roof clipping is prominent; early camp's
   peripheral fire/prop fading is smaller. Colored cottage fallback loses 1047
   subject-core pixels at zero alpha under its old generic mask. Diagnostic
   counts for both masks are retained in `safe-frame-audit.json`.

5. **Old/new canvas.** All remain 1536×1024. Padding was unnecessary because the
   original subjects are intact. Four Tax-only lossless RGBA WebP renditions
   replace the runtime radial mask. Original sources are retained. Visible RGB
   pixel diff from the original decoded WebP is zero; no subject redraw/shrink.
   Warm/neutral silhouette extraction, protected green props and lower-only
   grass feathering remove the opaque rectangle without trimming the roof.

6. **Ground anchor.** Reference and actual frame contact `(768,900)`; correction
   `(0,0)`. World contact `(1246.884,540.10661328125)`. Metadata separates canvas,
   original reference scale, visible bounds and contact. A padding-invariance
   test proves hypothetical larger canvases preserve contact and artwork size.

7. **Overflow/mask.** Tax uses alpha composition, bypassing both radial masks.
   `.house-tax` explicitly has `overflow:visible`; Forest viewport retains
   `overflow:hidden`. Runtime order remains background z0 → house z2 → statues
   z3 / Spine z4 → labels z11. Existing ambient SVG color filter and lighting
   values are unchanged; no filter enlargement is needed for safe-framed pixels.
   A narrow-screen HUD overlap exposed by the restored roof is also resolved:
   the separate Tax card resolver caps its bottom above the active artwork's
   visual top. Source anchor `(1550,363)` and horizontal camera clamp stay intact;
   the vertical cap uses projected artwork pixels, not breakpoint corrections.
   Custom text, card contents and House ground do not change.

8. **Tax source position old/new.** Both image-box centers `(1246.884,414.905)`;
   relative to pre-PR placement, X−12 / Y−35 source pixels. Follow-up delta `(0,0)`.

9. **Scale old/new.** Both widths `495.6435` world pixels, 95% of prior width
   `521.73`. Follow-up visual scale change zero. Brokerage unchanged.

10. **Removed background rock.** New `TAX_PLOT_ROCK_REMOVAL_MASK` support bounds
    `[1041,474,1106,521]`; the polygon, not the bounding rectangle, defines edits.
    Grey stone left of the camp/fire is replaced by locally matched green grass.
    No new rocks, stumps, flowers, fence, path or other decoration is added.

11. **16-variant patch.** Morning/Day/Evening/Night × Sunny/Cloudy/Rain/Storm all
    receive identical donor geometry with their existing local LAB appearance.
    Updated 16 production backgrounds + 16 hybrid masters + clean geometry master.
    LEFT `[386,552,540,677]` and RIGHT `[1184,407,1529,584]` masks are disjoint
    from the new Tax mask and their completed pixels are preserved exactly.

12. **Outside-mask diff.** Zero decoded RGB pixel diff outside the NEW Tax mask
    against commit `372425e` in all 33 files. Read-only audit independently
    rechecks this, including preservation of LEFT/RIGHT patches. Cumulative audit
    permits the three intentional masks; all retained landmark shifts are `(0,0)`
    across 16 variants. Dock, shoreline, pond, pedestals, main path, bench,
    remaining fence, trees, sky and house lots outside the new mask are exact.

13. **Current stage visual QA.** Camp-plus and small-white tent are
    reviewed old/fixed. Fire/flame, rug, roof and props remain complete; silhouette
    has no canvas-edge cut, opaque rectangle or pale outer frame. 300% roof,
    campfire and lower-edge crops are included.

14. **Max stage visual QA.** The supplied `tax-2-final.png` is the largest white
    artwork (index 2 in the previous review), not the small-white tent. Largest
    white, colored and actual level-19 colored
    fallback are reviewed. Both tall crossed roof poles are visible. Bottom
    visual alpha ends near world Y=565, before the corridor/shoreline. Retained
    right stump and pedestal stay visible; no artwork size or anchor adjustment.

15. **Day/Evening/Night.** All four artworks and max fallback are compared on
    actual Day/Evening/Night Sunny runtime scenes. Old/fixed screenshots retain
    the same lighting pipeline; the old view restores pre-follow-up background
    and radial mask. Background atmosphere outside the Tax rock mask is exact.

16. **Responsive.** 1440/1320/1100/980/768/390: current plus small-white,
    largest-white and max fallback captured. Ground stays invariant within
    0.01 source px, including a live 1320→980→1320 resize. No breakpoint offset.
    390 initial crop and actual pan-right screenshot included; world is not shrunk.

17. **Ceremony/navigation regression.** Existing activities/mobile/world suites
    pass. Three slots/max two owners, duplicate redirects, slot switching,
    Fishing/Bench release and safe pathfinding remain unchanged. Both actors
    reach RIGHT through `tax_front → tax_corridor → fence_opening → right_grass`.
    39 world browser results pass; trusted-touch drag/pan/edge/cancellation and
    Fishing/Bench replacement suites pass. No collision/exclusion edits needed:
    new rock mask is away from the existing corridor; remaining obstacles persist.

18. **Persistence/custom text.** Existing cloud mock hydration/migration/race,
    user isolation/offline replay and label tests pass. Browser reload, exit/re-entry
    and tab reopen local restoration pass across six widths. Live Firebase
    logout/login/cross-session is NOT tested: no credentials. Physical Android
    is NOT tested; touch automation uses trusted Chrome CDP events.

19. **Tests.** Existing selector/domain/route/assets/weather/layout/activities/
    mobile/house-lighting/world-follow-up/world-v2 checks pass; new Tax metadata
    and decoded-pixel checks pass. Existing mobile/follow-up/ceremony/house-world/
    night-final browser suites pass. New review: 41 mapping/responsive/time cases
    plus 18 responsive tent/max cases. Production 16-variant geometry audit passes.

20. **Typecheck/lint/build.** Typecheck, lint and production build pass. The
    task-owned dev server is stopped before building to avoid shared `.next`.

21. **Commit.** `fix: preserve tax artwork silhouettes and clear plot rock`;
    same branch, normal push. Commit SHA is reported in the completion message.

22. **Draft PR/Preview.** Same Draft [PR #233](https://github.com/cococute88/gorani_vercel/pull/233).
    [Preview](https://gorani-vercel-git-codex-money-leve-cfcb33-cococute88-s-projects.vercel.app/money-level).
    Deployment protection redirects anonymous requests to Vercel login, so remote
    visual or live Cloud PASS is not claimed. No merge; user visual review required.

## Art review and reproduction

[Review sheet](../art-review/money-level/tax-safe-frame-v2/review.html) includes
four checkerboard/neutral safe bounds and source comparisons; old/fixed assets;
Day/Evening/Night scenes; 300% crops; six-width current/tent/max screenshots.
Machine evidence: `safe-frame-audit.json`, `tax-rock-audit.json`,
`browser-audit.json`, `responsive-artwork-audit.json`, `regression/browser-results.json`.

```sh
python scripts/build-money-level-tax-safe-frame.py
# Optional writer reproduces the local patch from the checked-in source crop:
python scripts/patch-money-level-tax-rock.py --candidate art-review/money-level/tax-safe-frame-v2/tax-rock-donor.png
python scripts/check-money-level-tax-safe-frame.py
python scripts/check-money-level-background-v2.py
python scripts/audit-money-level-new-layout.py --production
npm run check:money-level-tax-safe-frame
# With the dev server on port 3001:
node scripts/review-money-level-tax-safe-frame.mjs
node scripts/review-money-level-tax-responsive.mjs
python scripts/render-money-level-tax-details.py
```

Tax artwork alpha extraction uses Pillow/SciPy and original decoded artwork RGB.
The rock donor came from one localized ImageGen edit of a small enlarged crop;
only its explicit polygon is transferred. No whole-scene ImageGen regeneration.
