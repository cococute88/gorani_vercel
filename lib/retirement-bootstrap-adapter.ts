import type { AppliedPortfolioHoldingAssumption } from "./asset-simulator-types";
import { resolveEtfPatternMapping } from "./retirement-bootstrap-mapping";
import type {
  BootstrapBrokerageHolding,
  BootstrapTaxSavingHolding,
  BuildRetirementBootstrapInputOptions,
  RetirementBootstrapInput,
} from "./retirement-bootstrap-types";

function requiredMetric(
  holding: AppliedPortfolioHoldingAssumption,
  key: "totalReturnCagrPct" | "priceCagrPct" | "dividendYieldPct" | "dividendGrowthPct",
): number {
  const value = holding[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${holding.ticker}의 ${key} 사용자 적용값이 없습니다.`);
  }
  return value;
}

function taxHolding(holding: AppliedPortfolioHoldingAssumption): BootstrapTaxSavingHolding {
  return {
    ticker: holding.ticker,
    weightPct: holding.weightPct,
    expectedTotalReturnCagrPct: requiredMetric(holding, "totalReturnCagrPct"),
    mapping: resolveEtfPatternMapping(holding.ticker),
  };
}

function brokerageHolding(holding: AppliedPortfolioHoldingAssumption): BootstrapBrokerageHolding {
  return {
    ticker: holding.ticker,
    weightPct: holding.weightPct,
    expectedPriceCagrPct: requiredMetric(holding, "priceCagrPct"),
    initialDividendYieldPct: requiredMetric(holding, "dividendYieldPct"),
    expectedDividendGrowthPct: requiredMetric(holding, "dividendGrowthPct"),
    mapping: resolveEtfPatternMapping(holding.ticker),
  };
}

/** UI 연결 후 사용할 명시적 adapter. 적용된 portfolioAssumptions가 없으면 기본값으로 대체하지 않는다. */
export function buildRetirementBootstrapInput(
  options: BuildRetirementBootstrapInputOptions,
): RetirementBootstrapInput {
  const { inputs, portfolioAssumptions, targetMonthlyExpenseReal } = options;
  if (!portfolioAssumptions || portfolioAssumptions.version !== 1) {
    throw new Error("장기 지속 가능성 분석에는 사용자가 확정한 portfolioAssumptions가 필요합니다.");
  }
  if (
    typeof targetMonthlyExpenseReal !== "number"
    || !Number.isFinite(targetMonthlyExpenseReal)
    || targetMonthlyExpenseReal <= 0
  ) {
    throw new Error("장기 지속 가능성 분석에는 양수인 목표 월생활비가 필요합니다.");
  }

  return {
    startYear: inputs.startYear,
    initialIsa: inputs.initialIsa,
    initialPension: inputs.initialPension,
    initialBrokerage: inputs.initialTaxableDividend,
    expectedInflationPct: inputs.inflationRate,
    withdrawalRatePct: inputs.withdrawalRate,
    withdrawalGrowthRatePct: inputs.withdrawalGrowthRate,
    withdrawalDelayYears: inputs.withdrawalDelayYears,
    annualRequiredWithdrawalReal: targetMonthlyExpenseReal * 12,
    taxSavingHoldings: portfolioAssumptions.taxSaving.holdings.map(taxHolding),
    brokerageHoldings: portfolioAssumptions.brokerage.holdings.map(brokerageHolding),
  };
}
