# Camp direct-pixel normalization audit

The earlier `alpha area = 1.000x` acceptance rule is superseded for camps. Different camp compositions can have equal alpha area while the rug and firepit still look larger. The three production WebPs are now directly resized/repositioned on their 1536×1024 transparent canvases, and their runtime frames are identity transforms.

| Final asset | Direct uniform scale | Pixel translation | Runtime transform | Browser finding |
|---|---:|---:|---|---|
| `temporary-camp-spring-summer.webp` | 0.633283 | (251.90, 330.58) | identity | The first core-area fit still made the rug/firepit look large; browser review applied an additional 0.82 visual scale. |
| `temporary-camp-fall.webp` | 0.721366 | (180.34, 238.19) | identity | The opaque rug/firepit/prop core was visually close after the first browser-checked direct fit. |
| `temporary-camp-winter.webp` | 0.891955 | (81.28, 99.08) | identity | The opaque rug/firepit/prop core was visually close after the first browser-checked direct fit; premultiplied resizing removed edge matte. |

## Acceptance result

- Desktop and mobile screenshots compare the alpha-v2 master and runtime asset at the same Forest background, viewport, world anchor, and renderer width.
- Spring/Summer received an additional browser-derived 0.82 visual reduction after the first core-area fit because its rug/firepit still looked too large.
- Fall and Winter were kept at their first direct visual fit; copying the Spring adjustment would have made them undersized.
- All three use the same identity runtime canvas/ground convention, so season changes do not stack a second scale/translation.
- Tent assets were not rewritten; their existing alpha-v2 regression checks remain active.

Artifacts: `overlay-*.png`, `browser-desktop-master-vs-runtime.png`, `browser-mobile-master-vs-runtime.png`, `browser-results.json`, and `audit.json`.
