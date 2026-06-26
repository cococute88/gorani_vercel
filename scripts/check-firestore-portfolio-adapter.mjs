#!/usr/bin/env node

// =============================================================
// Phase C compatibility verification.
//
// Runs the Portfolio Manager view-model pipeline TWICE on the same underlying
// data:
//   OFF: PortfolioSnapshot (legacy path) -> buildPortfolioPageFromSnapshots
//   ON : Firestore contract document -> adapter -> PortfolioSnapshot ->
//        buildPortfolioPageFromSnapshots
//
// It then diffs the visible view models (dashboard cards, allocation charts,
// account cards, rankings, totals) and reports every difference, classified as
// expected / bug / legacy.
//
// It also asserts:
//   - document_version validation (accepts 1.0.0 / 1.1.0, rejects others)
//   - the adapter consumes the eight canonical totals VERBATIM (no recompute)
// =============================================================

import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { buildPortfolioPageFromSnapshots } = require("../lib/portfolio-from-snapshots.ts");
const {
  mapContractToSnapshot,
  validateDocumentVersion,
} = require("../lib/firestore-portfolio-contract.ts");
const { adaptContractDocuments } = require("../lib/firestore-portfolio-adapter.ts");
const { validateContractDocument } = require("../lib/firestore-portfolio-validate.ts");
const { summaryOf, replaceSnapshots, getSnapshots, clearSnapshots } = require("../lib/portfolio-store.ts");
const { MOCK_LATEST_SNAPSHOT } = require("../lib/mock-portfolio-data.ts");

// In-memory window/localStorage shim so the localStorage-backed portfolio-store
// behaves as it does in the browser (read() returns EMPTY when window is absent).
if (typeof globalThis.window === "undefined") {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.window = { localStorage };
  globalThis.localStorage = localStorage;
}

// ---- Build a contract document from a PortfolioSnapshot --------------------

function snapshotToContractDocument(snapshot, version) {
  // Build the totals the way bs-report-auto would emit them: precise, internally
  // consistent values. This mirrors what the legacy reconcile recompute produces,
  // so OFF (recompute) and ON (contract verbatim) must match exactly.
  const investmentValueKRW = snapshot.investmentValueKRW;
  const investmentPrincipalKRW = snapshot.investmentPrincipalKRW;
  const returnAmountKRW = investmentValueKRW - investmentPrincipalKRW;
  const returnPct = investmentPrincipalKRW > 0 ? (returnAmountKRW / investmentPrincipalKRW) * 100 : 0;
  const totalCashKRW = snapshot.totalAssetKRW - investmentValueKRW;
  const enriched = version === "1.1.0";
  return {
    document_version: version,
    snapshot_date: snapshot.snapshotDate,
    source_file_name: snapshot.sourceFileName,
    generated_at: snapshot.createdAt,
    totals: {
      total_assets_krw: snapshot.totalAssetKRW,
      total_investments_krw: investmentValueKRW,
      investment_principal_krw: investmentPrincipalKRW,
      return_amount_krw: returnAmountKRW,
      return_pct: returnPct,
      total_cash_krw: totalCashKRW,
      total_debt_krw: snapshot.totalDebtKRW,
      net_worth_krw: snapshot.netAssetKRW,
    },
    holdings: (snapshot.holdings ?? []).map((h) => ({
      id: h.id,
      broker: h.broker,
      account_name: h.accountName,
      asset_type: h.assetType,
      product_name: h.productName,
      clean_name: h.cleanName,
      ticker: h.ticker,
      tag: h.tag,
      principal_krw: h.principalKRW,
      value_krw: h.valueKRW,
      return_pct: h.returnPct,
      currency: h.currency,
      category: h.category,
      ...(enriched
        ? {
            symbol_group: h.symbolGroup,
            account_group: h.accountGroup,
            purpose_group: h.purposeGroup,
            status_group: h.statusGroup,
          }
        : {}),
    })),
    cash_assets: (snapshot.financeAssets ?? []).map((a) => ({
      id: a.id,
      group_name: a.groupName,
      product_name: a.productName,
      clean_name: a.cleanName,
      amount_krw: a.amountKRW,
      inferred_tag: a.inferredTag,
      category: a.category,
      is_debt: a.isDebt,
      ...(enriched ? { account_group: a.accountGroup, status_group: a.statusGroup } : {}),
    })),
    metadata: {
      parser_version: "contract-test",
      excluded_small_count: 0,
      excluded_below_minimum_count: 0,
      excluded_holding_value_krw: 0,
    },
  };
}

// ---- Diffing helpers -------------------------------------------------------

function round(n) {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : n;
}

function diffSummary(off, on) {
  const fields = [
    "totalAssetKRW",
    "investmentValueKRW",
    "investmentPrincipalKRW",
    "returnAmountKRW",
    "returnPct",
    "cashAndOtherKRW",
    "holdingCount",
    "accountCount",
    "financeAssetCount",
  ];
  const diffs = [];
  for (const f of fields) {
    if (round(off[f]) !== round(on[f])) {
      diffs.push({ section: "summary", field: f, off: round(off[f]), on: round(on[f]) });
    }
  }
  return diffs;
}

function diffAllocation(name, off, on) {
  const diffs = [];
  if (off.length !== on.length) {
    diffs.push({ section: name, field: "length", off: off.length, on: on.length });
    return diffs;
  }
  for (let i = 0; i < off.length; i += 1) {
    if (off[i].name !== on[i].name || round(off[i].value) !== round(on[i].value) || round(off[i].amountKRW) !== round(on[i].amountKRW)) {
      diffs.push({ section: name, field: `[${i}] ${off[i].name}`, off: `${off[i].value}% / ${off[i].amountKRW}`, on: `${on[i].value}% / ${on[i].amountKRW}` });
    }
  }
  return diffs;
}

function diffRanking(off, on) {
  const diffs = [];
  if (off.length !== on.length) {
    diffs.push({ section: "ranking", field: "length", off: off.length, on: on.length });
    return diffs;
  }
  for (let i = 0; i < off.length; i += 1) {
    const a = off[i];
    const b = on[i];
    if (a.name !== b.name || round(a.valueKRW) !== round(b.valueKRW) || round(a.returnPct) !== round(b.returnPct) || round(a.weightPct) !== round(b.weightPct)) {
      diffs.push({ section: "ranking", field: `#${a.rank} ${a.name}`, off: `${a.valueKRW}/${round(a.returnPct)}`, on: `${b.valueKRW}/${round(b.returnPct)}` });
    }
  }
  return diffs;
}

function diffAccountCards(off, on) {
  const diffs = [];
  if (off.length !== on.length) {
    diffs.push({ section: "accountCards", field: "length", off: off.length, on: on.length });
    return diffs;
  }
  for (let i = 0; i < off.length; i += 1) {
    const a = off[i];
    const b = on[i];
    if (a.name !== b.name || round(a.value) !== round(b.value) || round(a.rate) !== round(b.rate)) {
      diffs.push({ section: "accountCards", field: `[${i}] ${a.name}`, off: `${a.value}/${round(a.rate)}`, on: `${b.value}/${round(b.rate)}` });
    }
  }
  return diffs;
}

function compareModels(off, on) {
  return [
    ...diffSummary(off.summary, on.summary),
    ...diffAllocation("accountAllocation", off.accountAllocation, on.accountAllocation),
    ...diffAllocation("stockAllocation", off.stockAllocation, on.stockAllocation),
    ...diffAllocation("assetAllocation", off.assetAllocation, on.assetAllocation),
    ...diffAccountCards(off.accountCards, on.accountCards),
    ...diffRanking(off.holdingsRankingRows, on.holdingsRankingRows),
    ...diffAllocation("treemapItems", off.treemapItems.map((t) => ({ name: t.name, value: t.weightPct, amountKRW: t.valueKRW })), on.treemapItems.map((t) => ({ name: t.name, value: t.weightPct, amountKRW: t.valueKRW }))),
  ];
}

// ---- Tests -----------------------------------------------------------------

function assertVersionValidation() {
  assert.equal(validateDocumentVersion("1.0.0").ok, true);
  assert.equal(validateDocumentVersion("1.1.0").ok, true);
  assert.equal(validateDocumentVersion("2.0.0").ok, false);
  assert.equal(validateDocumentVersion("2.0.0").reason, "unsupported");
  assert.equal(validateDocumentVersion(undefined).ok, false);
  assert.equal(validateDocumentVersion(undefined).reason, "missing");
  return { case: "version validation", result: "1.0.0/1.1.0 accepted; others rejected" };
}

function assertVerbatimTotals() {
  // Feed totals that are deliberately INCONSISTENT with value-principal to prove
  // the adapter passes them through verbatim instead of recomputing.
  const doc = snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.1.0");
  doc.totals.return_amount_krw = 123456789; // sentinel
  doc.totals.return_pct = 42.42; // sentinel
  doc.totals.total_cash_krw = 999; // sentinel
  const mapped = mapContractToSnapshot(doc, { docId: "verbatim" });
  assert.equal(mapped.snapshot.returnAmountKRW, 123456789);
  assert.equal(mapped.snapshot.returnPct, 42.42);
  assert.equal(mapped.contractTotals.returnAmountKRW, 123456789);
  assert.equal(mapped.contractTotals.totalCashKRW, 999);
  assert.equal(mapped.snapshot.totalAssetKRW, doc.totals.total_assets_krw);
  assert.equal(mapped.snapshot.investmentValueKRW, doc.totals.total_investments_krw);
  assert.equal(mapped.snapshot.netAssetKRW, doc.totals.net_worth_krw);
  return { case: "verbatim totals (no recompute)", result: "sentinels preserved" };
}

function assertAdapterSkipsBadDocs() {
  const result = adaptContractDocuments([
    { id: "good", data: snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.0.0") },
    { id: "bad-version", data: { ...snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.0.0"), document_version: "9.9.9" } },
  ]);
  assert.equal(result.snapshots.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].id, "bad-version");
  assert.equal(result.outcome, "ok");
  assert.equal(result.documentCount, 2);
  return { case: "adapter skips invalid docs", skipped: result.skipped.length };
}

// ---- Phase F: non-destructive loading + authoritative protection -----------

function assertEmptyContractOutcome() {
  const result = adaptContractDocuments([]);
  assert.equal(result.outcome, "empty-collection");
  assert.equal(result.documentCount, 0);
  assert.equal(result.snapshots.length, 0);
  return { case: "empty contract -> empty-collection", outcome: result.outcome };
}

function assertInvalidContractOutcome() {
  const result = adaptContractDocuments([
    { id: "bad1", data: { document_version: "9.9.9" } },
    { id: "bad2", data: { document_version: "1.1.0" } },
  ]);
  assert.equal(result.outcome, "all-skipped");
  assert.equal(result.documentCount, 2);
  assert.equal(result.snapshots.length, 0);
  assert.equal(result.skipped.length, 2);
  return { case: "all-invalid contract -> all-skipped", outcome: result.outcome };
}

function applyContractToStoreSafely(adapted) {
  if (adapted.outcome === "ok") {
    replaceSnapshots(adapted.snapshots);
    return "replaced";
  }
  return "preserved-local";
}

function assertNonDestructiveStore() {
  clearSnapshots();
  replaceSnapshots([MOCK_LATEST_SNAPSHOT]);
  assert.equal(getSnapshots().length, 1);

  const empty = adaptContractDocuments([]);
  assert.equal(applyContractToStoreSafely(empty), "preserved-local");
  assert.equal(getSnapshots().length, 1, "empty contract must not erase local snapshots");

  const invalid = adaptContractDocuments([{ id: "bad", data: { document_version: "9.9.9" } }]);
  assert.equal(applyContractToStoreSafely(invalid), "preserved-local");
  assert.equal(getSnapshots().length, 1, "all-invalid contract must not erase local snapshots");

  const ok = adaptContractDocuments([{ id: "d", data: snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.1.0") }]);
  assert.equal(applyContractToStoreSafely(ok), "replaced");
  assert.equal(getSnapshots().length, 1);
  clearSnapshots();
  return { case: "non-destructive store (no data loss)", result: "local preserved on empty/invalid" };
}

function assertAuthoritativeTotalsProtected() {
  const doc = snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.1.0");
  const mapped = mapContractToSnapshot(doc, { docId: "auth" }).snapshot;
  const withAggregateRow = {
    ...mapped,
    holdings: [
      ...mapped.holdings,
      { id: "agg", broker: "", assetType: "기타", productName: "총 43개", ticker: "", principalKRW: 0, valueKRW: 0, needsReview: true },
    ],
  };

  const summary = summaryOf(withAggregateRow);
  assert.equal(summary.investmentValueKRW, doc.totals.total_investments_krw);
  assert.equal(summary.investmentPrincipalKRW, doc.totals.investment_principal_krw);
  assert.equal(summary.returnAmountKRW, doc.totals.return_amount_krw);
  assert.equal(summary.totalAssetKRW, doc.totals.total_assets_krw);
  assert.equal(summary.netAssetKRW, doc.totals.net_worth_krw);

  clearSnapshots();
  replaceSnapshots([withAggregateRow]);
  const stored = getSnapshots()[0];
  assert.equal(stored.investmentValueKRW, doc.totals.total_investments_krw, "sanitize must not overwrite authoritative totals");
  assert.equal(stored.returnAmountKRW, doc.totals.return_amount_krw);
  assert.ok(stored.holdings.every((h) => h.id !== "agg"), "aggregate row should be filtered for display");
  clearSnapshots();
  return { case: "authoritativeTotals protected from sanitize/recalc", result: "totals preserved, row filtered" };
}

// ---- Phase F: developer-only validator -------------------------------------

function assertValidatorAcceptsConsistentDoc() {
  const doc = snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.1.0");
  const report = validateContractDocument(doc, { documentId: "consistent" });
  assert.equal(report.ok, true);
  assert.equal(report.issues.length, 0, JSON.stringify(report.issues));
  return { case: "validator accepts consistent doc", ok: report.ok };
}

function assertValidatorFlagsDivergence() {
  const doc = snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.1.0");
  doc.totals.return_amount_krw += 1_000_000;
  doc.totals.net_worth_krw += 5_000;
  const report = validateContractDocument(doc, { documentId: "divergent" });
  assert.equal(report.ok, true, "divergence is warning-severity, not a hard error");
  assert.ok(report.issues.some((i) => i.code === "return_amount_divergence"));
  assert.ok(report.issues.some((i) => i.code === "net_worth_divergence"));
  return { case: "validator flags total divergence", issues: report.issues.length };
}

function assertValidatorRejectsMissing() {
  const missingVersion = validateContractDocument({ snapshot_date: "2026-01-01", totals: {} });
  assert.equal(missingVersion.ok, false);
  assert.ok(missingVersion.issues.some((i) => i.code === "document_version_invalid"));

  const missingTotals = validateContractDocument({ document_version: "1.1.0", snapshot_date: "2026-01-01" });
  assert.equal(missingTotals.ok, false);
  assert.ok(missingTotals.issues.some((i) => i.code === "totals_missing"));
  return { case: "validator rejects missing version/totals", result: "errors reported" };
}

function assertContractTotalsFlowThroughPipeline() {
  // Phase D: prove the FULL pipeline (adapter -> buildPortfolioPageFromSnapshots)
  // surfaces the contract totals verbatim and does NOT recompute them. Feed
  // sentinels that are intentionally inconsistent with value - principal.
  const doc = snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, "1.1.0");
  doc.totals.return_amount_krw = 777000777;
  doc.totals.return_pct = 33.33;
  doc.totals.total_cash_krw = 555000555;
  doc.totals.total_assets_krw = 999000999;
  const adapted = adaptContractDocuments([{ id: doc.snapshot_date, data: doc }]);
  const model = buildPortfolioPageFromSnapshots(adapted.snapshots);
  assert.equal(model.summary.returnAmountKRW, 777000777, "returnAmount must come from contract, not recompute");
  assert.equal(model.summary.returnPct, 33.33, "returnPct must come from contract, not recompute");
  assert.equal(model.summary.cashAndOtherKRW, 555000555, "cash must come from contract.total_cash_krw");
  assert.equal(model.summary.totalAssetKRW, 999000999, "totalAsset must come from contract");
  assert.equal(model.summary.totalFinancialAssetSource, "contract.total_assets_krw");
  assert.equal(model.summary.investmentValueSource, "contract.total_investments_krw");
  return { case: "contract totals flow through pipeline (no recompute)", result: "sentinels surfaced in summary" };
}

function assertOfflineFallbackStillRecomputes() {
  // Offline / legacy parsed snapshot (no authoritativeTotals): recompute path
  // must still run so offline fallback is preserved.
  const model = buildPortfolioPageFromSnapshots([MOCK_LATEST_SNAPSHOT]);
  assert.equal(model.summary.totalFinancialAssetSource, "snapshot.totalAssetKRW");
  assert.equal(model.summary.investmentValueSource, "snapshot.investmentValueKRW");
  return { case: "offline fallback preserved (recompute path)", result: "non-contract source labels" };
}

function runCompatibility(version) {
  const offModel = buildPortfolioPageFromSnapshots([MOCK_LATEST_SNAPSHOT]);
  const doc = snapshotToContractDocument(MOCK_LATEST_SNAPSHOT, version);
  const adapted = adaptContractDocuments([{ id: doc.snapshot_date, data: doc }]);
  const onModel = buildPortfolioPageFromSnapshots(adapted.snapshots);
  const diffs = compareModels(offModel, onModel);
  return { version, diffs };
}

function main() {
  const rows = [
    assertVersionValidation(),
    assertVerbatimTotals(),
    assertAdapterSkipsBadDocs(),
    assertContractTotalsFlowThroughPipeline(),
    assertOfflineFallbackStillRecomputes(),
    assertEmptyContractOutcome(),
    assertInvalidContractOutcome(),
    assertNonDestructiveStore(),
    assertAuthoritativeTotalsProtected(),
    assertValidatorAcceptsConsistentDoc(),
    assertValidatorFlagsDivergence(),
    assertValidatorRejectsMissing(),
  ];

  const compatibility = [runCompatibility("1.0.0"), runCompatibility("1.1.0")];
  let totalDiffs = 0;
  for (const { version, diffs } of compatibility) {
    totalDiffs += diffs.length;
    if (diffs.length === 0) {
      console.log(`\nCompatibility OFF vs ON (document_version ${version}): NO DIFFERENCES.`);
    } else {
      console.log(`\nCompatibility OFF vs ON (document_version ${version}): ${diffs.length} difference(s):`);
      console.table(diffs);
    }
  }

  console.log("\nAssertions:");
  console.table(rows);

  if (totalDiffs > 0) {
    throw new Error(`Compatibility mismatch: ${totalDiffs} difference(s) between OFF and ON paths.`);
  }
  console.log("\nFirestore portfolio adapter (Phase C) verification passed.");
}

try {
  main();
} catch (error) {
  console.error("Firestore portfolio adapter (Phase C) verification FAILED.");
  console.error(error);
  process.exit(1);
}
