import { resolveEtfPatternMapping } from "../../lib/retirement-bootstrap-mapping";
import type {
  MarketPatternDatasetV1,
  RetirementBootstrapInput,
} from "../../lib/retirement-bootstrap-types";

// 엔진 검증 전용 synthetic fixture입니다. 실제 역사 데이터나 production 성공률에 사용하면 안 됩니다.
const LARGE_CAP_TOTAL = [12, -8, 18, 7, 11, -32, 26, 15, 4, 9, -12, 20, 6, 13, 8];
const LARGE_GROWTH_TOTAL = [18, -14, 28, 10, 16, -40, 38, 22, 2, 13, -20, 31, 8, 19, 11];
const DIVIDEND_VALUE_TOTAL = [9, -4, 12, 6, 8, -24, 18, 11, 5, 7, -6, 14, 5, 10, 7];
const INFLATION = [2.2, 2.8, 3.1, 1.7, 2.4, 6.8, 4.9, 3.5, 2.1, 1.4, 0.2, 1.8, 2.6, 3.2, 2.5];
const DIVIDEND_GROWTH = [6, 4, 7, 5, 6, -12, 2, 8, 5, 6, -3, 7, 5, 6, 5];

export const RETIREMENT_BOOTSTRAP_SYNTHETIC_FIXTURE: MarketPatternDatasetV1 = {
  schemaVersion: 1,
  datasetId: "synthetic-market-pattern-v1",
  datasetVersion: "test-only-2026-07-17",
  usage: "test_fixture",
  periodStartYear: 2000,
  periodEndYear: 2014,
  sources: [{
    name: "명시적 synthetic 엔진 fixture",
    license: "테스트 전용이며 production 사용 금지",
  }],
  observations: LARGE_CAP_TOTAL.map((largeCapTotal, index) => ({
    year: 2000 + index,
    inflationPct: INFLATION[index],
    assetClasses: {
      us_large_cap: {
        totalReturnPct: largeCapTotal,
        priceReturnPct: largeCapTotal - 2,
        dividendGrowthPct: DIVIDEND_GROWTH[index],
      },
      us_large_growth: {
        totalReturnPct: LARGE_GROWTH_TOTAL[index],
        priceReturnPct: LARGE_GROWTH_TOTAL[index] - 0.8,
      },
      us_dividend_value: {
        totalReturnPct: DIVIDEND_VALUE_TOTAL[index],
        priceReturnPct: DIVIDEND_VALUE_TOTAL[index] - 3.5,
        dividendGrowthPct: DIVIDEND_GROWTH[index],
      },
    },
  })),
};

export function buildRetirementBootstrapSyntheticInput(): RetirementBootstrapInput {
  return {
    startYear: 2026,
    initialIsa: 5_000,
    initialPension: 10_000,
    initialBrokerage: 15_000,
    expectedInflationPct: 3,
    withdrawalRatePct: 3.5,
    withdrawalGrowthRatePct: 2,
    withdrawalDelayYears: 1,
    // 성공·실패 경로가 모두 나오도록 고정한 테스트용 세후 필수 인출액.
    annualRequiredWithdrawalReal: 600,
    taxSavingHoldings: [
      {
        ticker: "QQQ",
        weightPct: 50,
        expectedTotalReturnCagrPct: 8,
        mapping: resolveEtfPatternMapping("QQQ"),
      },
      {
        ticker: "SPY",
        weightPct: 50,
        expectedTotalReturnCagrPct: 7,
        mapping: resolveEtfPatternMapping("SPY"),
      },
    ],
    brokerageHoldings: [
      {
        ticker: "SCHD",
        weightPct: 90,
        expectedPriceCagrPct: 4,
        initialDividendYieldPct: 3.2,
        expectedDividendGrowthPct: 5,
        mapping: resolveEtfPatternMapping("SCHD"),
      },
      {
        ticker: "JEPQ",
        weightPct: 10,
        expectedPriceCagrPct: 2,
        initialDividendYieldPct: 9,
        expectedDividendGrowthPct: 1,
        mapping: resolveEtfPatternMapping("JEPQ"),
      },
    ],
  };
}
