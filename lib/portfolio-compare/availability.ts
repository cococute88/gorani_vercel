import { hasUsablePricePoints } from "@/lib/price-series-validation";
import type { PortfolioMarket, ResolvedMarketSeries } from "@/lib/portfolio-compare/types";

export type PortfolioAvailabilityInput = {
  key: string;
  label: string;
  ticker: string;
  market: PortfolioMarket;
};

export type PortfolioAvailabilityRow = PortfolioAvailabilityInput & {
  resolvedSymbol: string | null;
  error: string | null;
};

export type PortfolioAvailabilityLoader = (ticker: string, market: PortfolioMarket) => Promise<ResolvedMarketSeries>;

export async function checkPortfolioSeriesAvailability(
  inputs: PortfolioAvailabilityInput[],
  loadSeries: PortfolioAvailabilityLoader,
): Promise<PortfolioAvailabilityRow[]> {
  return Promise.all(inputs.map(async (input) => {
    try {
      const series = await loadSeries(input.ticker, input.market);
      if (!hasUsablePricePoints(series.points)) {
        return { ...input, resolvedSymbol: series.resolvedSymbol || null, error: "가격 데이터가 비어 있거나 유효한 양수 가격이 부족합니다." };
      }
      return { ...input, resolvedSymbol: series.resolvedSymbol, error: null };
    } catch (error) {
      return { ...input, resolvedSymbol: null, error: error instanceof Error ? error.message : String(error) };
    }
  }));
}
