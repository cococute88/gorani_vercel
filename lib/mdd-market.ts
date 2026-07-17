export type MddMarket = "US" | "KR";

export type MddTickerResolution =
  | { ok: true; requestedTicker: string; candidates: string[] }
  | { ok: false; error: string };

/**
 * Keep KRX codes as strings throughout the request path. A suffix-less code
 * intentionally produces both exchange candidates; Yahoo determines the
 * actual listing without a maintained local symbol directory.
 */
export function resolveMddTicker(input: string, market: MddMarket): MddTickerResolution {
  const requestedTicker = input.trim().replace(/\s+/g, "").toUpperCase();
  if (!requestedTicker) {
    return { ok: false, error: market === "KR" ? "한국 종목코드 6자리를 입력해주세요. 예: 000660" : "미국 티커를 입력해주세요. 예: SPY" };
  }

  if (market === "KR") {
    const match = requestedTicker.match(/^(\d{6})(?:\.(KS|KQ))?$/);
    if (!match) {
      return { ok: false, error: "한국 시장에서는 6자리 종목코드 또는 .KS/.KQ 티커를 입력해주세요. 예: 000660, 247540.KQ" };
    }
    const [, code, suffix] = match;
    return { ok: true, requestedTicker, candidates: suffix ? [`${code}.${suffix}`] : [`${code}.KS`, `${code}.KQ`] };
  }

  if (/^\d{6}(?:\.(KS|KQ))?$/.test(requestedTicker)) {
    return { ok: false, error: "한국 종목은 시장을 ‘한국’으로 선택한 뒤 6자리 종목코드를 입력해주세요." };
  }
  if (!/^[A-Z][A-Z0-9.-]*$/.test(requestedTicker)) {
    return { ok: false, error: "미국 티커 형식을 확인해주세요. 예: SPY, QQQ, AAPL" };
  }
  return { ok: true, requestedTicker, candidates: [requestedTicker] };
}

export function inferMddMarket(symbol: string, requestedMarket?: MddMarket): MddMarket {
  if (requestedMarket) return requestedMarket;
  return /\.K[QS]$/i.test(symbol) ? "KR" : "US";
}

export function fallbackCurrency(symbol: string, market: MddMarket): "USD" | "KRW" {
  return market === "KR" || /\.K[QS]$/i.test(symbol) ? "KRW" : "USD";
}

export function fallbackExchange(symbol: string): string | undefined {
  if (/\.KS$/i.test(symbol)) return "KOSPI";
  if (/\.KQ$/i.test(symbol)) return "KOSDAQ";
  return undefined;
}
