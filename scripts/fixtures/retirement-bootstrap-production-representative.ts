import { resolveEtfPatternMapping } from "../../lib/retirement-bootstrap-mapping";
import type { RetirementBootstrapInput } from "../../lib/retirement-bootstrap-types";

/** 실제 사용자를 뜻하지 않는 production 데이터 검증·benchmark 전용 대표 가정입니다. */
export function buildRetirementBootstrapProductionRepresentativeInput(): RetirementBootstrapInput {
  return {
    startYear: 2026,
    initialIsa: 5_000,
    initialPension: 10_000,
    initialBrokerage: 15_000,
    expectedInflationPct: 3,
    withdrawalRatePct: 3.5,
    withdrawalGrowthRatePct: 2,
    withdrawalDelayYears: 1,
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
