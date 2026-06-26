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
const { MOCK_LATEST_SNAPSHOT } = require("../lib/mock-portfolio-data.ts");

// ---- Build a contract document from a PortfolioSnapshot --------------------

function snapshotToContractDocument(snapshot, version) {
  const totalCashKRW = snapshot.totalAssetKRW - snapshot.investmentValueKRW;
  const enriched = version === "1.1.0";
  return {
    document_version: version,
    snapshot_date: snapshot.snapshotDate,
    source_file_name: snapshot.sourceFileName,
    generated_at: snapshot.createdAt,
    totals: {
      total_assets_krw: snapshot.totalAssetKRW,
      total_investments_krw: snapshot.investmentValueKRW,
      investment_principal_krw: snapshot.investmentPrincipalKRW,
      return_amount_krw: snapshot.returnAmountKRW,
      return_pct: snapshot.returnPct,
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
  return { case: "adapter skips invalid docs", skipped: result.skipped.length };
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
  const rows = [assertVersionValidation(), assertVerbatimTotals(), assertAdapterSkipsBadDocs()];

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
