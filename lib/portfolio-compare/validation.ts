import { resolveMddTicker } from "@/lib/mdd-market";
import type {
  AnalysisMode,
  PortfolioCompareRequest,
  PortfolioHoldingInput,
  PortfolioInput,
  PortfolioMarket,
} from "@/lib/portfolio-compare/types";

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function normalizePortfolioTicker(ticker: string, market: PortfolioMarket): string {
  const normalized = ticker.trim().replace(/\s+/g, "").toUpperCase();
  if (market === "KR") return normalized.replace(/\.(KS|KQ)$/, "");
  return normalized.replace(/^\$/, "");
}

function validateWeights(rows: Array<{ ticker: string; weightPct: number }>, label: string): string[] {
  const errors: string[] = [];
  for (const row of rows) {
    if (!finitePositive(row.weightPct)) errors.push(`${label}의 모든 비중은 0보다 큰 유한한 숫자여야 합니다.`);
  }
  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.weightPct) ? row.weightPct : 0), 0);
  if (Math.abs(total - 100) > 1e-8) errors.push(`${label} 비중 합계는 정확히 100%여야 합니다. 현재 ${total.toFixed(2)}%입니다.`);
  return errors;
}

function validateTickerRows(rows: PortfolioHoldingInput[], label: string): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const row of rows) {
    const resolution = resolveMddTicker(row.ticker, row.market);
    if (!resolution.ok) errors.push(`${label} ${row.ticker || "(빈 티커)"}: ${resolution.error}`);
    const key = `${row.market}:${normalizePortfolioTicker(row.ticker, row.market)}`;
    if (keys.has(key)) errors.push(`${label}에 중복 종목 ${row.ticker.trim().toUpperCase()}이(가) 있습니다.`);
    keys.add(key);
  }
  return errors;
}

function validatePortfolio(portfolio: PortfolioInput, label: string, mode: AnalysisMode): string[] {
  const errors: string[] = [];
  if (!portfolio.name.trim()) errors.push(`${label} 이름을 입력해 주세요.`);
  if (portfolio.holdings.length < 1 || portfolio.holdings.length > 10) {
    errors.push(`${label} 구성종목은 1개 이상 10개 이하여야 합니다.`);
  }
  errors.push(...validateWeights(portfolio.holdings, label), ...validateTickerRows(portfolio.holdings, label));

  if (mode === "virtual") {
    for (const holding of portfolio.holdings) {
      if (!holding.virtual?.enabled) continue;
      const prefix = `${label} ${holding.ticker} Virtual 프록시`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(holding.virtual.startDate)) {
        errors.push(`${prefix} 적용 시작일을 입력해 주세요.`);
      }
      if (holding.virtual.proxies.length < 1 || holding.virtual.proxies.length > 10) {
        errors.push(`${prefix}는 1개 이상 10개 이하로 구성해야 합니다.`);
      }
      errors.push(
        ...validateWeights(holding.virtual.proxies, prefix),
        ...validateTickerRows(
          holding.virtual.proxies.map((proxy) => ({ ...proxy })),
          prefix,
        ),
      );
    }
  }
  return Array.from(new Set(errors));
}

export function validatePortfolioCompareRequest(request: PortfolioCompareRequest): string[] {
  return [
    ...validatePortfolio(request.portfolioA, "포트폴리오 A", request.analysisMode),
    ...validatePortfolio(request.portfolioB, "포트폴리오 B", request.analysisMode),
  ];
}
