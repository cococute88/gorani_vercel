import "server-only";

import { parseKrxTicker } from "@/lib/krx-ticker";

const METADATA_TIMEOUT_MS = 5_000;

export type KoreanStockMarket = "KOSPI" | "KOSDAQ";

export type KoreanStockMetadata = {
  code: string;
  stockName: string;
  market: KoreanStockMarket;
  stockExchangeName: string;
  stockExchangeType?: { name?: string };
};

export type KoreanStockMetadataLookup =
  | { status: "found"; metadata: KoreanStockMetadata }
  | { status: "not_found" }
  | { status: "unavailable"; error: string };

type NaverKoreanStockMetadata = {
  itemCode?: string;
  stockName?: string;
  stockExchangeName?: string;
  stockExchangeType?: { name?: string };
};

function inferMarket(payload: NaverKoreanStockMetadata): KoreanStockMarket | null {
  const value = `${payload.stockExchangeName ?? ""} ${payload.stockExchangeType?.name ?? ""}`.toUpperCase();
  if (value.includes("KOSDAQ")) return "KOSDAQ";
  if (value.includes("KOSPI") || value.includes("KSE")) return "KOSPI";
  return null;
}

export async function lookupKoreanStockMetadata(input: string): Promise<KoreanStockMetadataLookup> {
  const parsed = parseKrxTicker(input);
  if (!parsed) return { status: "not_found" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${encodeURIComponent(parsed.code)}/basic`, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 gorani-finance korean-stock-metadata",
      },
      next: { revalidate: 60 * 60 * 6 },
      signal: controller.signal,
    });
    if (response.status === 404 || response.status === 409) return { status: "not_found" };
    if (!response.ok) return { status: "unavailable", error: `Naver stock metadata HTTP ${response.status}` };

    const payload = (await response.json()) as NaverKoreanStockMetadata;
    const code = payload.itemCode?.trim().toUpperCase();
    const stockName = payload.stockName?.trim();
    const market = inferMarket(payload);
    if (code !== parsed.code || !stockName || !market) return { status: "not_found" };
    return {
      status: "found",
      metadata: {
        code,
        stockName,
        market,
        stockExchangeName: payload.stockExchangeName?.trim() || market,
        stockExchangeType: payload.stockExchangeType,
      },
    };
  } catch (error) {
    return { status: "unavailable", error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}
