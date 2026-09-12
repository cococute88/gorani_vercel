import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const [pkgText, page, forest, scene, stage, hook] = await Promise.all([
  read("package.json"),
  read("app/money-level/page.tsx"),
  read("components/money-level/MoneyLevelForest.tsx"),
  read("components/money-level/MoneyLevelScene.tsx"),
  read("components/money-level/runtime/spine-stage.ts"),
  read("lib/money-level/use-money-level-portfolio-snapshot.ts"),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.dependencies["@esotericsoftware/spine-webgl"], "4.2.120");
assert(page.includes("MoneyLevelForest"), "Route must delegate to MoneyLevelForest");
assert(forest.startsWith('"use client"'), "Interactive root must be a Client Component");
assert(forest.includes("useMoneyLevelPortfolioSnapshot()"), "Route must consume the Phase 1 normalized selector hook");
assert(hook.includes("usePortfolioFirestoreSnapshot()") && hook.includes("usePortfolioView()"), "Portfolio source must reuse the normalized /portfolio flow");
assert(!forest.includes("/api/portfolio/latest-snapshot"), "Money Level UI must not create a raw fetch pipeline");
assert(forest.includes("gorani.money-level.settings.v1"));
assert(forest.includes("gorani.money-level.snapshot.v1"));
assert(scene.includes("SpineStage.create") && scene.includes("createdStage.dispose()"));
assert(stage.includes("webglcontextlost") && stage.includes("webglcontextrestored"));
assert(stage.includes("cancelAnimationFrame") && stage.includes("resizeObserver.disconnect()"));
assert(!`${page}\n${forest}\n${scene}`.includes("navdebug"), "Debug overlay must not be visible in Production route source");
console.log("Money Level route boundary and runtime lifecycle checks OK");
