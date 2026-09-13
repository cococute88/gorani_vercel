# ImageGen prompt record

All 16 assets were produced with the built-in ImageGen image-editing workflow.

## Shared edit contract

- Use case: `lighting-weather`
- Image 1: approved `cozy-forest-base.png`, the only edit target and geometry source
- Time and weather PNGs: visual references only for lighting, sky, atmosphere, reflection, and weather mood
- Re-illustrate the environment as a complete time/weather scene; never treat a tint, filter, or overlay as the result
- Preserve the base illustration style, line weight, rendering detail, vegetation style, camera, crop, and perspective
- Do not move, resize, reshape, duplicate, add, or remove trees, paths, pond, shoreline, fences, rocks, dock, bench, stumps, garden bed, flower clusters, terrain landmarks, or mountain silhouettes
- Modify only sky, clouds, lighting, atmospheric perspective, color temperature, sunlight/moonlight, wetness, water reflection, fog/rain haze, and weather atmosphere
- Do not add Gorani, Daramji, characters, houses, camp, labels, fishing rod, HUD, buttons, text, icons, structures, props, frames, or watermarks
- Output canvas: exact base bounds and 1672×941 aspect/crop

## Time identity

- Morning: blue-violet dawn afterglow, low warm sunrise, mild mist, pale warm pond reflection, readable scene
- Day: bright comfortable daylight blending `am.png` freshness with `pm.png` neutral softness; clear greens and bright blue pond
- Evening: unmistakable orange/peach/pink/mauve golden hour, warm path and mountains, strong orange-gold pond reflection
- Night: deep blue/purple sky, readable blue-teal forest, moon/night pond reflection, no crushed blacks

## Weather identity

- Sunny: clean time-specific sky and directional natural light
- Cloudy: thick soft clouds, diffused light, reduced direct sun and distant contrast; no rain or wetness
- Rain: layered rain clouds, fine natural rain, rain haze, damp path/dock/rocks, cool wet vegetation, pond ripples; no giant white streaks
- Storm: dramatic stacked storm clouds, dark horizon, heavy rain haze, turbulent light, storm pond, optional distant lightning; never a darkened rain duplicate

Each asset prompt combined exactly one time identity and one weather identity and repeated the full geometry lock. Day used both `am.png` and `pm.png`. The Evening Rain retry strengthened the identical outer-pixel-bound and no-crop requirements after a 1px width mismatch in the first result.
