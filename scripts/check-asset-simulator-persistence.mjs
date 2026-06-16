import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const page = read("components/asset-simulator/AssetSimulatorPage.tsx");
const panel = read("components/asset-simulator/SimulatorInputPanel.tsx");
const persistence = read("lib/asset-simulator-persistence.ts");
const repos = read("lib/firebase/firestore-repositories.ts");
const pkg = JSON.parse(read("package.json"));

function assertSaveWritesLocalAndCloud() {
  const handleSave = page.match(/const handleSave = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";
  assert.match(handleSave, /writeLocalConfig\(normalizedInputs, normalizedPlans, updatedAt\)/, "Save writes normalized inputs/yearPlans to localStorage cache");
  assert.match(handleSave, /if \(user\) \{[\s\S]*await saveAssetSimulatorConfig\(user\.uid, storedConfig\)/, "Save awaits uid-scoped cloud save for signed-in users");
  assert.match(handleSave, /else \{[\s\S]*로컬에 저장됨/, "Save has logged-out local fallback messaging");
  assert.match(handleSave, /catch \(err\) \{[\s\S]*setSaveError/, "Save failure is surfaced in UI state");
}

function assertFirestorePathAndUpdatedAt() {
  assert.match(repos, /doc\(requireDb\(\), "users", uid, "assetSimulatorConfigs", "default"\)/, "Firestore path remains users/{uid}/assetSimulatorConfigs/default");
  assert.match(repos, /updatedAt: serverTimestamp\(\)/, "Firestore save updates server updatedAt");
}

function assertHydrationPolicy() {
  assert.match(page, /chooseLatestSimulatorConfig\(cloudConfig, localConfig\)/, "Hydration compares cloud and local configs");
  assert.match(persistence, /cloud\.updatedAtMs >= local\.updatedAtMs \? cloud : local/, "Newer updatedAt wins between cloud and local");
  assert.match(page, /config\.updatedAtMs < lastLocalWriteAtRef\.current/, "Stale cloud/default hydration cannot overwrite just-saved current state");
  assert.match(page, /buildStoredSimulatorConfig\(config\.inputs, config\.yearPlans/, "Cloud hydration refreshes local cache with normalized schema");
}

function assertNormalizationAndUi() {
  assert.match(persistence, /normalizeInputs\(inputs\)/, "Stored config normalizes numeric inputs");
  assert.match(persistence, /normalizeYearPlans\(normalizedInputs, yearPlans\)/, "Stored config normalizes year plans");
  assert.match(panel, /disabled=\{saving\}/, "Save button disables during save");
  assert.match(panel, /저장 중\.\.\./, "Save button shows saving label");
  assert.match(panel, /role="alert"/, "Save failure message is announced");
  assert.match(panel, /saveMessage/, "Save success/local fallback message is shown");
}

function assertFixtureComparisonCases() {
  const choose = (cloud, local) => (cloud && local ? (cloud.updatedAtMs >= local.updatedAtMs ? cloud : local) : (cloud ?? local));
  assert.equal(choose({ source: "cloud", updatedAtMs: Date.parse("2026-06-15T08:00:00.000Z") }, { source: "local", updatedAtMs: Date.parse("2026-06-16T08:00:00.000Z") }).source, "local");
  assert.equal(choose({ source: "cloud", updatedAtMs: Date.parse("2026-06-16T09:00:00.000Z") }, { source: "local", updatedAtMs: Date.parse("2026-06-15T08:00:00.000Z") }).source, "cloud");
}

function assertPackageScript() {
  assert.equal(pkg.scripts["check:asset-simulator-persistence"], "node scripts/check-asset-simulator-persistence.mjs", "package script is registered");
}

assertSaveWritesLocalAndCloud();
assertFirestorePathAndUpdatedAt();
assertHydrationPolicy();
assertNormalizationAndUi();
assertFixtureComparisonCases();
assertPackageScript();
console.log("asset simulator persistence checks passed");
