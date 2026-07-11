import "server-only";

import { resolvePortfolioHoldingMetrics } from "@/lib/asset-simulator-portfolio-resolver";
import { normalizePortfolioTicker } from "@/lib/asset-simulator-portfolio";
import type { PortfolioHoldingResolution, ResolvePortfolioHoldingInput } from "@/lib/asset-simulator-types";
import { getLongDailySeries } from "@/lib/server/long-series-fetcher";

export async function resolvePortfolioHolding(
  input: ResolvePortfolioHoldingInput,
): Promise<PortfolioHoldingResolution> {
  const ticker = normalizePortfolioTicker(input.ticker);
  if (!ticker) {
    return resolvePortfolioHoldingMetrics(
      { ...input, ticker },
      { symbol: ticker, source: "empty", updatedAt: new Date().toISOString(), points: [], dividends: [], warnings: ["empty ticker"] },
    );
  }
  const series = await getLongDailySeries({ symbol: ticker });
  return resolvePortfolioHoldingMetrics({ ...input, ticker }, series);
}
