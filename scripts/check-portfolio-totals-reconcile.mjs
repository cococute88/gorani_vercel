import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reconcilePortfolioTotals } from "../lib/portfolio-totals-reconcile.ts";

function snapshot(overrides = {}) {
  const holdings = overrides.holdings ?? [
    { id: "h1", broker: "A", assetType: "ETF", productName: "ETF", principalKRW: 80, valueKRW: 100 },
  ];
  return {
    id: "s1",
    snapshotDate: "2026-06-15",
    sourceFileName: "sample.xlsx",
    totalAssetKRW: 0,
    totalDebtKRW: 0,
    netAssetKRW: 0,
    investmentPrincipalKRW: 80,
    investmentValueKRW: 100,
    returnAmountKRW: 20,
    returnPct: 25,
    holdings,
    financeAssets: overrides.financeAssets ?? [],
    createdAt: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

{
  const result = reconcilePortfolioTotals(snapshot({ totalAssetKRW: 200, financeAssets: [{ id: "a", groupName: "현금", productName: "CMA", amountKRW: 150 }] }));
  assert.equal(result.totalFinancialAssetKRW, 200);
  assert.equal(result.totalFinancialAssetSource, "snapshot.totalAssetKRW");
}
{
  const result = reconcilePortfolioTotals(snapshot({ totalAssetKRW: Number.NaN, financeAssets: [{ id: "a", groupName: "현금", productName: "CMA", amountKRW: 150 }] }));
  assert.equal(result.totalFinancialAssetKRW, 150);
  assert.equal(result.totalFinancialAssetSource, "financeAssets.sum");
}
{
  const result = reconcilePortfolioTotals(snapshot({ totalAssetKRW: 0, financeAssets: [], investmentValueKRW: 123 }));
  assert.equal(result.totalFinancialAssetKRW, 123);
  assert.equal(result.totalFinancialAssetSource, "investmentValueKRW");
}
{
  const result = reconcilePortfolioTotals(snapshot({ totalAssetKRW: 0, investmentValueKRW: Number.NaN, financeAssets: [], holdings: [{ id: "h", broker: "A", assetType: "ETF", productName: "ETF", principalKRW: 10, valueKRW: 77 }] }));
  assert.equal(result.totalFinancialAssetKRW, 77);
  assert.equal(result.totalFinancialAssetSource, "investmentValueKRW");
  assert.equal(result.investmentValueSource, "holdings.sum");
}
{
  const result = reconcilePortfolioTotals(snapshot({ totalAssetKRW: 657_130_417, investmentValueKRW: 588_134_175, investmentPrincipalKRW: 377_777_733 }));
  assert.equal(result.cashAndOtherKRW, 68_996_242);
  assert.equal(result.returnAmountKRW, 210_356_442);
  assert.equal(Number(result.returnPct?.toFixed(2)), 55.68);
}
{
  const result = reconcilePortfolioTotals(snapshot({ totalAssetKRW: 50, investmentValueKRW: 100 }));
  assert.equal(result.cashAndOtherKRW, 0);
  assert.ok(result.warnings.some((w) => w.code === "total_less_than_investment"));
}
{
  const result = reconcilePortfolioTotals(snapshot({ totalAssetKRW: Number.NaN, investmentValueKRW: Number.NaN, financeAssets: [{ id: "bad", groupName: "bad", productName: "bad", amountKRW: Number.NaN }], holdings: [] }));
  assert.equal(result.totalFinancialAssetKRW, null);
  assert.ok(result.warnings.some((w) => w.code === "invalid_numeric_field_ignored"));
}

const summary = readFileSync("components/PortfolioSummary.tsx", "utf8");
assert.ok(summary.includes("총 금융자산"));
assert.ok(summary.includes("투자 평가금액"));
assert.ok(summary.includes("현금성/기타 자산"));
assert.ok(!summary.includes("총 평가금액"));
assert.ok(!summary.includes("총평가금액"));
console.log("portfolio totals reconciliation checks passed");
