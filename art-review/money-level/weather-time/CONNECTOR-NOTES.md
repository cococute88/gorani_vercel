# Fixed dock connector integration

The 16 approved `assets/forest-*.png` masters are unchanged. Each `connector-patches/forest-*.png` is a 280×170 local crop from a matching ImageGen edit; it contains no full-scene replacement. Run `node scripts/bake-money-level-connector.mjs` from the repository root to feather that crop into the original master at (892, 649), producing `docked/forest-*-docked.png` and the production `forest-*-docked.webp` renditions.

The connector is purely decorative. Its former runtime sprite had a separate percentage placement and grading, which could diverge from the dock and mobile crop. Navigation regions, the dock waypoint, and fishing anchors are independent coordinate data and were not changed. The old sprite file remains as a source artifact but is no longer rendered.

Review the 4×4 `docked/connector-contact-sheet.png` in row order Morning, Day, Evening, Night and column order Sunny, Cloudy, Rain, Storm. The feathered edit is restricted to the connector and its immediate water/shore contact; image dimensions remain 1672×941. A PSNR check on an untouched 500×500 corner of the Day Sunny master and rendition returned infinity (identical pixels).

The baked bench is not extracted here. A future seated-character interaction may merit a separately staged foreground bench with its original background footprint carefully reconstructed, so its occlusion and depth can be controlled without a duplicate silhouette.
