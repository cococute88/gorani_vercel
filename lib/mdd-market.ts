import { isLikelySuffixlessKrxTicker, krxYahooCandidates, normalizeTickerText, parseKrxTicker } from "@/lib/krx-ticker";

export type MddMarket = "US" | "KR";

export type MddTickerResolution =
  | { ok: true; requestedTicker: string; candidates: string[] }
  | { ok: false; error: string };

/**
 * Keep KRX codes as strings throughout the request path. A suffix-less code
 * intentionally produces both exchange candidates. Server callers may narrow
 * them with current exchange metadata before requesting a price provider.
 */
export function resolveMddTicker(input: string, market: MddMarket): MddTickerResolution {
  const requestedTicker = normalizeTickerText(input);
  if (!requestedTicker) {
    return { ok: false, error: market === "KR" ? "한국 종목은 숫자 또는 영문자가 포함된 6자리 종목코드를 입력해주세요. 예: 000660, 0049M0" : "미국 티커를 입력해주세요. 예: SPY" };
  }

  if (market === "KR") {
    const parsed = parseKrxTicker(requestedTicker);
    if (!parsed) {
      return { ok: false, error: "한국 종목은 숫자 또는 영문자가 포함된 6자리 종목코드와 선택적인 .KS/.KQ 접미사를 입력해주세요. 예: 000660, 0049M0, 247540.KQ" };
    }
    return { ok: true, requestedTicker: parsed.requestedTicker, candidates: krxYahooCandidates(parsed.requestedTicker) };
  }

  if (/\.K[QS]$/.test(requestedTicker) || isLikelySuffixlessKrxTicker(requestedTicker)) {
    return { ok: false, error: "한국 종목은 시장을 ‘한국’으로 선택한 뒤 숫자 또는 영문자가 포함된 6자리 종목코드를 입력해주세요." };
  }
  if (!/^[A-Z][A-Z0-9.-]*$/.test(requestedTicker)) {
    return { ok: false, error: "미국 티커 형식을 확인해주세요. 예: SPY, QQQ, AAPL" };
  }
  return { ok: true, requestedTicker, candidates: [requestedTicker] };
}

export function inferMddMarket(symbol: string, requestedMarket?: MddMarket): MddMarket {
  if (requestedMarket) return requestedMarket;
  return /\.K[QS]$/i.test(symbol) || isLikelySuffixlessKrxTicker(symbol) ? "KR" : "US";
}

export function fallbackCurrency(symbol: string, market: MddMarket): "USD" | "KRW" {
  return market === "KR" || /\.K[QS]$/i.test(symbol) ? "KRW" : "USD";
}

export function fallbackExchange(symbol: string): string | undefined {
  if (/\.KS$/i.test(symbol)) return "KOSPI";
  if (/\.KQ$/i.test(symbol)) return "KOSDAQ";
  return undefined;
}
