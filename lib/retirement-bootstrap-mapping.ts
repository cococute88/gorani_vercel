import type {
  AssetClassPatternId,
  DistributionPolicyId,
  EtfPatternMapping,
} from "./retirement-bootstrap-types";

export const ETF_PATTERN_MAPPINGS: Readonly<Record<string, EtfPatternMapping>> = Object.freeze({
  SPY: {
    ticker: "SPY",
    assetClass: "us_large_cap",
    distributionPolicy: "standard_dividend",
    rationale: "미국 대형주 시장 변동·회복 패턴을 사용합니다.",
  },
  QQQ: {
    ticker: "QQQ",
    assetClass: "us_large_growth",
    distributionPolicy: "standard_dividend",
    rationale: "미국 대형 성장주 변동 패턴을 사용합니다.",
  },
  SCHD: {
    ticker: "SCHD",
    assetClass: "us_dividend_value",
    distributionPolicy: "standard_dividend",
    rationale: "미국 배당·가치주 변동 및 이용 가능한 배당성장 패턴을 사용합니다.",
  },
  JEPQ: {
    ticker: "JEPQ",
    assetClass: "us_large_growth",
    distributionPolicy: "income_strategy",
    rationale: "가격 변동 순서만 미국 대형 성장주에서 참고하고 CAGR·분배율·분배성장은 사용자 입력을 유지합니다.",
  },
});

export const INCOME_STRATEGY_DISTRIBUTION_POLICY = Object.freeze({
  severeDownturnThresholdPct: -20,
  severeDownturnPaymentMultiplier: 0.9,
});

export function normalizeBootstrapTicker(ticker: string): string {
  return ticker.trim().replace(/\$/g, "").replace(/\s+/g, "").toUpperCase();
}

export function resolveEtfPatternMapping(
  ticker: string,
  overrides: Partial<Record<string, EtfPatternMapping>> = {},
): EtfPatternMapping {
  const normalized = normalizeBootstrapTicker(ticker);
  const mapping = overrides[normalized] ?? ETF_PATTERN_MAPPINGS[normalized];
  if (!mapping) {
    throw new Error(`${normalized || "빈 티커"}의 승인된 자산군 패턴 매핑이 없습니다.`);
  }
  return { ...mapping, ticker: normalized };
}

export function distributionPaymentMultiplier(
  policy: DistributionPolicyId,
  assetClassPricePatternPct: number,
): number {
  if (
    policy === "income_strategy"
    && assetClassPricePatternPct <= INCOME_STRATEGY_DISTRIBUTION_POLICY.severeDownturnThresholdPct
  ) {
    return INCOME_STRATEGY_DISTRIBUTION_POLICY.severeDownturnPaymentMultiplier;
  }
  return 1;
}

export function requiredAssetClasses(mappings: EtfPatternMapping[]): AssetClassPatternId[] {
  return Array.from(new Set(mappings.map((mapping) => mapping.assetClass)));
}
