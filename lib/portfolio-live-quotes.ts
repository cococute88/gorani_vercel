import { fetchQuoteLast } from "@/lib/calculator-data-provider";
import type { QuoteSource } from "@/lib/quote-types";
import type { Holding } from "./portfolio-types";
import { classifyPortfolioAsset, getQuoteTickerForHolding } from "./ticker-mapper";

export type PortfolioQuoteStatus = {
  ticker: string;
  price: number | null;
  source: QuoteSource;
  updatedAt: string | null;
  warnings: string[];
  holdingIds: string[];
  canRevalue: boolean;
};

export type PortfolioQuoteSkippedHolding = {
  holdingId: string;
  label: string;
  classification: ReturnType<typeof classifyPortfolioAsset>;
};

export type PortfolioQuoteSummary = {
  statuses: PortfolioQuoteStatus[];
  skippedHoldings: PortfolioQuoteSkippedHolding[];
  warnings: string[];
  canRevaluePortfolio: boolean;
};

export function extractQuoteEligibleHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter((holding) => getQuoteTickerForHolding(holding) !== null);
}

export function getUniqueQuoteTickers(holdings: Holding[]): string[] {
  return Array.from(
    new Set(
      holdings
        .map((holding) => getQuoteTickerForHolding(holding))
        .filter((ticker): ticker is string => Boolean(ticker)),
    ),
  ).sort();
}

function buildSkippedHoldings(holdings: Holding[]): PortfolioQuoteSkippedHolding[] {
  return holdings
    .filter((holding) => getQuoteTickerForHolding(holding) === null)
    .map((holding) => ({
      holdingId: holding.id,
      label: holding.cleanName || holding.productName || holding.ticker || holding.id,
      classification: classifyPortfolioAsset(holding),
    }));
}

export async function fetchPortfolioQuoteStatuses(holdings: Holding[]): Promise<PortfolioQuoteSummary> {
  const tickers = getUniqueQuoteTickers(holdings);
  const warnings: string[] = [];
  const tickerToHoldingIds = new Map<string, string[]>();

  for (const holding of holdings) {
    const ticker = getQuoteTickerForHolding(holding);
    if (!ticker) continue;
    tickerToHoldingIds.set(ticker, [...(tickerToHoldingIds.get(ticker) ?? []), holding.id]);
    if (holding.quantity == null || !Number.isFinite(holding.quantity) || holding.quantity <= 0) {
      warnings.push(`${ticker}: quantity is missing, so portfolio value is not recalculated.`);
    }
  }

  const statuses = await Promise.all(
    tickers.map(async (ticker): Promise<PortfolioQuoteStatus> => {
      try {
        const quote = await fetchQuoteLast({ ticker });
        const missingQuantity = holdings
          .filter((holding) => getQuoteTickerForHolding(holding) === ticker)
          .some((holding) => holding.quantity == null || !Number.isFinite(holding.quantity) || holding.quantity <= 0);

        return {
          ticker,
          price: quote.price,
          source: quote.source,
          updatedAt: quote.updatedAt ?? null,
          warnings: quote.warnings,
          holdingIds: tickerToHoldingIds.get(ticker) ?? [],
          canRevalue: !missingQuantity && quote.price !== null,
        };
      } catch (error) {
        return {
          ticker,
          price: null,
          source: "sample",
          updatedAt: null,
          warnings: [`Quote lookup failed: ${error instanceof Error ? error.message : String(error)}`],
          holdingIds: tickerToHoldingIds.get(ticker) ?? [],
          canRevalue: false,
        };
      }
    }),
  );

  if (statuses.some((status) => status.source === "sample")) {
    warnings.push("At least one quote used the sample fallback.");
  }

  return {
    statuses,
    skippedHoldings: buildSkippedHoldings(holdings),
    warnings: Array.from(new Set(warnings)),
    canRevaluePortfolio: statuses.length > 0 && statuses.every((status) => status.canRevalue),
  };
}
