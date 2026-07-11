import assert from "node:assert/strict";

import { calculateAssetSimulatorPreview } from "../lib/asset-simulator.ts";
import { calculateRetirementSafety } from "../lib/asset-simulator-safety.ts";
import { resolveEffectivePortfolioProjectionAssumptions } from "../lib/asset-simulator-portfolio-assumptions.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type {
  AppliedPortfolioAssumptionsV1,
  AppliedPortfolioHoldingAssumption,
  SimulatorInputs,
} from "../lib/asset-simulator-types.ts";

const APPLIED_AT = "2026-07-12T00:00:00.000Z";

function holding(
  holdingId: string,
  ticker: string,
  weightPct: number,
  metrics: {
    totalReturnCagrPct?: number;
    priceCagrPct?: number;
    dividendYieldPct?: number;
    dividendGrowthPct?: number;
  },
): AppliedPortfolioHoldingAssumption {
  return {
    holdingId,
    ticker,
    weightPct,
    metricMode: "manual",
    totalReturnCagrPct: metrics.totalReturnCagrPct ?? null,
    priceCagrPct: metrics.priceCagrPct ?? null,
    dividendYieldPct: metrics.dividendYieldPct ?? null,
    dividendGrowthPct: metrics.dividendGrowthPct ?? null,
    sources: {
      totalReturnCagr: "manual",
      priceCagr: "manual",
      dividendYield: "manual",
      dividendGrowth: "manual",
    },
    statuses: {
      totalReturnCagr: "manual",
      priceCagr: "manual",
      dividendYield: "manual",
      dividendGrowth: "manual",
    },
    warnings: [],
  };
}

function assumptions(overrides: {
  taxReturnPct?: number;
  brokeragePricePct?: number;
  brokerageYieldPct?: number;
  brokerageGrowthPct?: number;
} = {}): AppliedPortfolioAssumptionsV1 {
  return {
    version: 1,
    appliedAt: APPLIED_AT,
    taxSaving: {
      accountType: "taxSaving",
      holdings: [holding("tax-schd", "SCHD", 100, {
        totalReturnCagrPct: overrides.taxReturnPct ?? 6,
      })],
    },
    brokerage: {
      accountType: "brokerage",
      holdings: [holding("broker-schd", "SCHD", 100, {
        priceCagrPct: overrides.brokeragePricePct ?? 6,
        dividendYieldPct: overrides.brokerageYieldPct ?? 3.5,
        dividendGrowthPct: overrides.brokerageGrowthPct ?? 0,
      })],
    },
  };
}

const inputs: SimulatorInputs = {
  ...DEFAULT_SIMULATOR_INPUTS,
  initialTaxableDividend: 10_000,
};
const plans = buildDefaultYearPlans(inputs.startYear, inputs.years);

const legacy = calculateAssetSimulatorPreview(inputs, plans);
assert.deepEqual(calculateAssetSimulatorPreview(inputs, plans, false, {}), legacy, "options 미지정 legacy 결과 동일");
assert.deepEqual(
  calculateAssetSimulatorPreview(inputs, plans, false, { portfolioAssumptions: null }),
  legacy,
  "null assumptions legacy 결과 동일",
);
assert.equal(legacy.summary.portfolioSummary, undefined, "legacy summary에 portfolioSummary를 주입하지 않음");

const lowTax = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ taxReturnPct: 2 }),
});
const highTax = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ taxReturnPct: 10 }),
});
assert.ok(highTax.results.at(-1)!.isaNominal > lowTax.results.at(-1)!.isaNominal, "절세계좌 CAGR이 ISA projection 변경");
assert.ok(highTax.results.at(-1)!.pensionNominal > lowTax.results.at(-1)!.pensionNominal, "절세계좌 CAGR이 연금 projection 변경");
assert.notEqual(highTax.withdrawPlan!.finalPensionBalance, lowTax.withdrawPlan!.finalPensionBalance, "은퇴 후 절세계좌 성장률 변경");

const lowPrice = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ brokeragePricePct: 1 }),
});
const highPrice = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ brokeragePricePct: 9 }),
});
assert.ok(
  highPrice.dividendRows.at(-1)!.taxableDividendBalanceNominal > lowPrice.dividendRows.at(-1)!.taxableDividendBalanceNominal,
  "위탁 price CAGR이 평가잔고 변경",
);

const lowYield = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ brokerageYieldPct: 2 }),
});
const highYield = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ brokerageYieldPct: 8 }),
});
assert.ok(
  highYield.dividendRows.at(-1)!.afterTaxAnnualDividendNominal > lowYield.dividendRows.at(-1)!.afterTaxAnnualDividendNominal,
  "위탁 dividend yield가 배당 현금흐름 변경",
);

const noGrowth = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ brokerageGrowthPct: 0 }),
});
const growingDividend = calculateAssetSimulatorPreview(inputs, plans, false, {
  portfolioAssumptions: assumptions({ brokerageGrowthPct: 3 }),
});
assert.ok(
  growingDividend.dividendRows.at(-1)!.afterTaxAnnualDividendNominal > noGrowth.dividendRows.at(-1)!.afterTaxAnnualDividendNominal,
  "위탁 dividend growth가 후반 배당 현금흐름 변경",
);

const lowWithdrawalInputs = { ...inputs, withdrawalRate: 1 };
const highWithdrawalInputs = { ...inputs, withdrawalRate: 9 };
const fixedPortfolio = assumptions({ brokerageYieldPct: 4 });
const portfolioLowWithdrawal = calculateAssetSimulatorPreview(lowWithdrawalInputs, plans, false, { portfolioAssumptions: fixedPortfolio });
const portfolioHighWithdrawal = calculateAssetSimulatorPreview(highWithdrawalInputs, plans, false, { portfolioAssumptions: fixedPortfolio });
assert.deepEqual(
  portfolioLowWithdrawal.dividendRows.map((row) => row.afterTaxAnnualDividendNominal),
  portfolioHighWithdrawal.dividendRows.map((row) => row.afterTaxAnnualDividendNominal),
  "portfolio mode에서 withdrawalRate를 위탁 배당률로 사용하지 않음",
);
const legacyLowWithdrawal = calculateAssetSimulatorPreview(lowWithdrawalInputs, plans);
const legacyHighWithdrawal = calculateAssetSimulatorPreview(highWithdrawalInputs, plans);
assert.notDeepEqual(
  legacyLowWithdrawal.dividendRows.map((row) => row.afterTaxAnnualDividendNominal),
  legacyHighWithdrawal.dividendRows.map((row) => row.afterTaxAnnualDividendNominal),
  "legacy mode에서 withdrawalRate 배당률 재사용 유지",
);

const weighted = resolveEffectivePortfolioProjectionAssumptions({
  version: 1,
  appliedAt: APPLIED_AT,
  taxSaving: {
    accountType: "taxSaving",
    holdings: [
      holding("tax-schd", "SCHD", 60, { totalReturnCagrPct: 8 }),
      holding("tax-qld", "QLD", 40, { totalReturnCagrPct: 12 }),
    ],
  },
  brokerage: {
    accountType: "brokerage",
    holdings: [
      holding("broker-schd", "SCHD", 60, { priceCagrPct: 5, dividendYieldPct: 2, dividendGrowthPct: 10 }),
      holding("broker-jepq", "JEPQ", 40, { priceCagrPct: 3, dividendYieldPct: 8, dividendGrowthPct: 1 }),
    ],
  },
});
assert.equal(weighted.taxSavingTotalReturnPct, 9.6, "절세계좌 비중 가중 total return");
assert.equal(weighted.brokeragePriceReturnPct, 4.2, "위탁 비중 가중 price return");
assert.equal(weighted.brokerageDividendYieldPct, 4.4, "위탁 비중 가중 dividend yield");
assert.ok(Math.abs(weighted.brokerageDividendGrowthPct - (15.2 / 4.4)) < 1e-12, "배당기여도 가중 dividend growth");
assert.deepEqual(weighted.portfolioSummary.taxSaving.tickers, ["SCHD", "QLD"], "portfolioSummary 절세계좌 티커");
assert.deepEqual(weighted.portfolioSummary.brokerage.tickers, ["SCHD", "JEPQ"], "portfolioSummary 위탁계좌 티커");

const zeroDividend = resolveEffectivePortfolioProjectionAssumptions(assumptions({
  brokerageYieldPct: 0,
  brokerageGrowthPct: 50,
}));
assert.equal(zeroDividend.brokerageDividendGrowthPct, 0, "유효 배당률 0이면 dividend growth 0");

const portfolioProjection = calculateAssetSimulatorPreview(inputs, plans, false, { portfolioAssumptions: fixedPortfolio });
assert.deepEqual(portfolioProjection.summary.portfolioSummary, resolveEffectivePortfolioProjectionAssumptions(fixedPortfolio).portfolioSummary, "portfolioSummary 생성");

const lowSafety = calculateRetirementSafety(lowPrice);
const highSafety = calculateRetirementSafety(highPrice);
assert.notEqual(
  highSafety.brokerage.metrics.endingRealAssets,
  lowSafety.brokerage.metrics.endingRealAssets,
  "projection 변경만으로 Safety 위탁계좌 결과 변경",
);

console.log("asset simulator portfolio projection checks passed");
