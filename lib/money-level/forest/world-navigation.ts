/** Ground geometry in the shared 1683×935 master, independent of viewport. */
export const WORLD_WAYPOINTS: Record<string, { x: number; y: number }> = {
  gorani_home: { x: 774, y: 587 }, brokerage_yard: { x: 774, y: 640 },
  bench: { x: 707, y: 680 }, garden: { x: 808, y: 613 },
  daramji_home: { x: 976, y: 580 }, campfire: { x: 959, y: 534 },
  tax_clearing: { x: 942, y: 494 }, meadow: { x: 892, y: 501 },
  flower_patch: { x: 892, y: 554 }, path_front: { x: 808, y: 693 },
  path_center: { x: 825, y: 613 }, path_mid: { x: 842, y: 527 },
  path_back_lower: { x: 875, y: 461 }, path_back_mid: { x: 926, y: 408 },
  path_back_upper: { x: 959, y: 355 },
  left_grass: { x: 470, y: 663 }, left_access: { x: 686, y: 661 },
  ceremony_left_a: { x: 470, y: 751.6 }, ceremony_left_b: { x: 694, y: 736 },
  tax_front: { x: 1080, y: 600 }, tax_corridor: { x: 1210, y: 586 },
  fence_opening: { x: 1270, y: 575 },
  right_grass: { x: 1320, y: 593 }, ceremony_right: { x: 1370, y: 593 },
};

export const OPENED_WORLD_REGIONS = {
  'bench-exit-grass': [{ x: 332, y: 650 }, { x: 398, y: 650 }, { x: 398, y: 679 }, { x: 332, y: 679 }],
  'opened-left-grass': [{ x: 388, y: 563 }, { x: 510, y: 563 }, { x: 545, y: 640 },
    { x: 736, y: 650 }, { x: 800, y: 660 }, { x: 800, y: 777 },
    { x: 655, y: 780 }, { x: 655, y: 678 }, { x: 520, y: 678 },
    { x: 515, y: 797 }, { x: 430, y: 797 }, { x: 425, y: 679 }, { x: 355, y: 679 }, { x: 355, y: 650 }],
  'tax-front-corridor': [{ x: 905, y: 590 }, { x: 1040, y: 574 }, { x: 1105, y: 569 },
    { x: 1170, y: 575 }, { x: 1250, y: 570 }, { x: 1310, y: 565 },
    { x: 1390, y: 575 }, { x: 1390, y: 609 }, { x: 1305, y: 609 },
    { x: 1200, y: 604 }, { x: 1110, y: 617 }, { x: 990, y: 628 }, { x: 916, y: 632 }],
};

export const WORLD_OBSTACLES = [
  { id: 'brokerage-house', x: 346, y: 230, width: 422, height: 328 },
  { id: 'tax-house', x: 1095, y: 330, width: 292, height: 235 },
  { id: 'bench', x: 230, y: 540, width: 155, height: 109 },
  { id: 'left-pedestal', x: 530, y: 693, width: 119, height: 61 },
  { id: 'right-pedestal', x: 1415, y: 538, width: 110, height: 61 },
  // The foreground fence has been removed in RIGHT_CORRIDOR_FENCE_MASK.
  // Only the actual stump footprint remains; rear fences stay solid.
  { id: 'right-stump', x: 1376, y: 494, width: 70, height: 57 },
  { id: 'right-rear-fence', x: 1295, y: 294, width: 89, height: 65 },
  { id: 'left-fence', x: 200, y: 703, width: 218, height: 90 },
  { id: 'foreground-rocks', x: 549, y: 780, width: 154, height: 74 },
] as const;

// Land-side edge follows the actual rocks/reeds; dock is a separate exception.
export const POND_WORLD_POLYGON = [{ x: 990, y: 646 }, { x: 1100, y: 626 },
  { x: 1190, y: 611 }, { x: 1230, y: 606 }, { x: 1245, y: 590 },
  { x: 1260, y: 584 }, { x: 1279, y: 585 }, { x: 1293, y: 592 },
  { x: 1308, y: 610 }, { x: 1324, y: 608 }, { x: 1337, y: 611 },
  { x: 1355, y: 626 }, { x: 1370, y: 622 }, { x: 1382, y: 609 },
  { x: 1398, y: 599 }, { x: 1415, y: 600 }, { x: 1430, y: 611 },
  { x: 1450, y: 625 }, { x: 1515, y: 630 }, { x: 1645, y: 702 },
  { x: 1683, y: 935 }, { x: 960, y: 935 }, { x: 910, y: 760 }];
