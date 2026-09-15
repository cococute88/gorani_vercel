import { writeFileSync } from "node:fs";
import { CEREMONY_SLOTS } from "../lib/money-level/forest/statue-view";
import { OPENED_WORLD_REGIONS, WORLD_WAYPOINTS, WORLD_OBSTACLES, POND_WORLD_POLYGON } from "../lib/money-level/forest/world-navigation";
import { WALKABLE_REGIONS, legacyPolygonToWorld, NAVIGATION_GRAPH } from "../lib/money-level/forest/navigation";
import { HOUSE_WORLD_GEOMETRY, TAX_LABEL_WORLD } from "../lib/money-level/forest/house-geometry";
writeFileSync("art-review/money-level/world-settings-v2/world-geometry.json",JSON.stringify({
  ceremony:CEREMONY_SLOTS,opened:OPENED_WORLD_REGIONS,waypoints:WORLD_WAYPOINTS,obstacles:WORLD_OBSTACLES,pond:POND_WORLD_POLYGON,
  legacy:WALKABLE_REGIONS.filter(region=>region.kind!=="dock"&&!region.master).map(region=>({id:region.id,points:legacyPolygonToWorld(region.desktop.points)})),
  graph:NAVIGATION_GRAPH,houses:HOUSE_WORLD_GEOMETRY,taxLabel:TAX_LABEL_WORLD,
},null,2));
