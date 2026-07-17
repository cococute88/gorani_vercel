import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const page = read("components/asset-simulator/AssetSimulatorPage.tsx");
const panel = read("components/asset-simulator/SimulatorInputPanel.tsx");
const persistence = read("lib/asset-simulator-persistence.ts");
const repos = read("lib/firebase/firestore-repositories.ts");
const pkg = JSON.parse(read("package.json"));

function sanitizeForFirestore(value) {
  if (value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeForFirestore(item) === undefined ? null : sanitizeForFirestore(item));
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      const cleaned = sanitizeForFirestore(child);
      if (cleaned !== undefined) result[key] = cleaned;
    }
    return result;
  }
  return value;
}

function findFirestoreUnsafePaths(value, path = "payload") {
  const unsafe = [];
  const visit = (item, currentPath) => {
    if (item === undefined || typeof item === "function" || typeof item === "symbol" || (typeof item === "number" && !Number.isFinite(item))) {
      unsafe.push(currentPath);
      return;
    }
    if (Array.isArray(item)) return item.forEach((child, index) => visit(child, `${currentPath}[${index}]`));
    if (item && typeof item === "object") for (const [key, child] of Object.entries(item)) visit(child, `${currentPath}.${key}`);
  };
  visit(value, path);
  return unsafe;
}

function assertSaveWritesLocalAndCloud() {
  const handleSave = page.match(/const handleSave = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";
  assert.match(handleSave, /writeLocalConfig\(normalizedInputs, normalizedPlans, updatedAt\)/, "Save writes normalized inputs/yearPlans to localStorage cache");
  assert.match(handleSave, /if \(user\) \{[\s\S]*await saveAssetSimulatorConfig\(user\.uid, storedConfig\)/, "Save awaits uid-scoped cloud save for signed-in users");
  assert.match(handleSave, /else \{[\s\S]*로컬에 저장됨/, "Save has logged-out local fallback messaging");
  assert.match(handleSave, /저장 실패: 저장 데이터 형식을 정리하지 못했습니다\./, "Save has serialization-specific failure UI");
  assert.match(handleSave, /저장 실패: 클라우드 저장 중 오류가 발생했습니다\./, "Save has generic cloud failure UI without raw stack traces");
}

function assertFirestorePathUpdatedAtAndSanitizer() {
  assert.match(repos, /doc\(requireDb\(\), "users", uid, "assetSimulatorConfigs", "default"\)/, "Firestore path remains users/{uid}/assetSimulatorConfigs/default");
  assert.match(repos, /const payload = buildFirestoreSimulatorConfigPayload\(config\)/, "Firestore save builds a sanitized payload immediately before setDoc");
  assert.match(repos, /findFirestoreUnsafePaths\(payload\)/, "Firestore save validates unsafe paths before setDoc");
  assert.match(repos, /console\.warn\("assetSimulator\.save blocked Firestore-unsafe payload paths", unsafePaths\)/, "Unsafe paths are logged to developer console");
  assert.match(repos, /setDoc\([\s\S]*\.\.\.payload,[\s\S]*updatedAt: serverTimestamp\(\),[\s\S]*\}, \{ merge: true \}\)/, "setDoc receives sanitized payload plus root serverTimestamp updatedAt with merge");
}

function assertSanitizerImplementationAndFixtures() {
  assert.match(persistence, /export function sanitizeForFirestore/, "Firestore-safe sanitizer is exported");
  assert.match(persistence, /export function findFirestoreUnsafePaths/, "Unsafe path detector is exported");
  assert.match(persistence, /export function buildFirestoreSimulatorConfigPayload/, "Asset simulator Firestore payload builder is exported");
  assert.equal(sanitizeForFirestore({ keep: 1, drop: undefined }).drop, undefined, "object undefined fields are removed");
  assert.deepEqual(sanitizeForFirestore([1, undefined, 3]), [1, null, 3], "array undefined items become null");
  assert.deepEqual(sanitizeForFirestore({ a: Number.NaN, b: Infinity, c: -Infinity }), { a: null, b: null, c: null }, "invalid numbers become null");
  assert.deepEqual(sanitizeForFirestore({ fn: () => 1, sym: Symbol("x"), ok: true }), { ok: true }, "function/symbol fields are removed");
  const fixture = {
    inputs: { startYear: 2026, years: 2, annualReturnRate: Number.NaN, inflationRate: Infinity },
    yearPlans: [
      { year: 2026, monthlyContribution: 100, status: undefined },
      undefined,
      { year: 2027, monthlyContribution: -Infinity, extra: () => 1 },
    ],
  };
  const cleaned = sanitizeForFirestore(fixture);
  assert.deepEqual(findFirestoreUnsafePaths(cleaned), [], "sanitized payload has no unsafe values");
  assert.equal(cleaned.yearPlans[0].status, undefined, "yearPlans object undefined field is removed");
  assert.equal(cleaned.yearPlans[1], null, "yearPlans undefined array item becomes null");
  assert.equal(cleaned.inputs.annualReturnRate, null, "inputs invalid number becomes null");
  assert.deepEqual(findFirestoreUnsafePaths(fixture), ["payload.inputs.annualReturnRate", "payload.inputs.inflationRate", "payload.yearPlans[0].status", "payload.yearPlans[1]", "payload.yearPlans[2].monthlyContribution", "payload.yearPlans[2].extra"], "unsafe path detector reports precise paths");
}

function assertHydrationPolicy() {
  assert.match(page, /chooseLatestSimulatorConfig\(cloudConfig, localConfig\)/, "Hydration compares cloud and local configs");
  assert.match(persistence, /cloud\.updatedAtMs >= local\.updatedAtMs \? cloud : local/, "Newer updatedAt wins between cloud and local");
  assert.match(page, /config\.updatedAtMs < lastLocalWriteAtRef\.current/, "Stale cloud/default hydration cannot overwrite just-saved current state");
  assert.match(page, /buildStoredSimulatorConfig\(config\.inputs, config\.yearPlans/, "Cloud hydration refreshes local cache with normalized schema");
}

function assertNormalizationAndUi() {
  assert.match(persistence, /normalizeInputs\(config\.inputs\)/, "Firestore payload builder normalizes inputs");
  assert.match(persistence, /normalizeYearPlansPreservingOutsidePeriod\(normalizedInputs, config\.yearPlans \?\? \[\]\)/, "Firestore payload builder normalizes active plans while preserving out-of-period rows");
  assert.match(panel, /disabled=\{saving\}/, "Save button disables during save");
  assert.match(panel, /저장 중\.\.\./, "Save button shows saving label");
  assert.match(panel, /role="alert"/, "Save failure message is announced");
  assert.match(panel, /saveMessage/, "Save success/local fallback message is shown");
}

assertSaveWritesLocalAndCloud();
assertFirestorePathUpdatedAtAndSanitizer();
assertSanitizerImplementationAndFixtures();
assertHydrationPolicy();
assertNormalizationAndUi();
assert.equal(pkg.scripts["check:asset-simulator-persistence"], "node scripts/check-asset-simulator-persistence.mjs", "package script is registered");
console.log("asset simulator persistence checks passed");
