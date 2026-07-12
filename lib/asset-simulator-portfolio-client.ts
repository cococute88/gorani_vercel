import type {
  PortfolioAccountType,
  PortfolioHoldingResolution,
} from "./asset-simulator-types";

// Client-side helper for the portfolio metric resolver. The browser never calls
// Yahoo directly — it goes through the server route which builds the long-range
// series and runs resolvePortfolioHoldingMetrics.
export type PortfolioMetricsResponse = {
  ticker: string;
  accountType: PortfolioAccountType;
  seriesSource: string;
  resolution: PortfolioHoldingResolution;
};

export function portfolioMetricsPath(ticker: string, accountType: PortfolioAccountType): string {
  const params = new URLSearchParams({ ticker, accountType });
  return `/api/asset-simulator/portfolio-metrics?${params.toString()}`;
}

export async function fetchPortfolioHoldingResolution(
  ticker: string,
  accountType: PortfolioAccountType,
  signal?: AbortSignal,
): Promise<PortfolioHoldingResolution> {
  const response = await fetch(portfolioMetricsPath(ticker, accountType), {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`portfolio-metrics request failed (HTTP ${response.status})`);
  }
  const payload = (await response.json()) as PortfolioMetricsResponse;
  if (!payload?.resolution) {
    throw new Error("portfolio-metrics response missing resolution");
  }
  return payload.resolution;
}
