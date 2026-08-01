import { isLikelySuffixlessKrxTicker, normalizeTickerText, parseKrxTicker } from "@/lib/krx-ticker";
import type { MddMarket } from "@/lib/mdd-market";

// 2년 역산 성과 분석에서 사용자가 빠르게 고를 수 있는 비교 티커 목록.
// datalist 자동완성에만 쓰이며, 여기에 없는 미국 ETF/주식도 직접 입력 가능하다.
export type CompareTickerOption = {
  ticker: string;
  name: string;
};

export const COMPARE_TICKER_OPTIONS: CompareTickerOption[] = [
  { ticker: "SCHD", name: "Schwab US Dividend Equity" },
  { ticker: "QLD", name: "ProShares Ultra QQQ (2x)" },
  { ticker: "JEPQ", name: "JPMorgan Nasdaq Equity Premium" },
  { ticker: "JEPI", name: "JPMorgan Equity Premium Income" },
  { ticker: "SPY", name: "SPDR S&P 500" },
  { ticker: "QQQ", name: "Invesco QQQ (Nasdaq 100)" },
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ (3x)" },
  { ticker: "VOO", name: "Vanguard S&P 500" },
  { ticker: "VTI", name: "Vanguard Total Stock Market" },
  { ticker: "SOXL", name: "Direxion Semiconductor Bull (3x)" },
  { ticker: "SOXX", name: "iShares Semiconductor" },
  { ticker: "SCHG", name: "Schwab US Large-Cap Growth" },
  { ticker: "DIA", name: "SPDR Dow Jones Industrial" },
  { ticker: "IWM", name: "iShares Russell 2000" },
  { ticker: "VIG", name: "Vanguard Dividend Appreciation" },
  { ticker: "DGRO", name: "iShares Core Dividend Growth" },
  { ticker: "O", name: "Realty Income" },
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "GOOGL", name: "Alphabet" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "TSLA", name: "Tesla" },
];

export const DEFAULT_COMPARE_TICKER = "SCHD";

// 사용자 입력을 비교 티커로 정규화한다(공백/소문자/$ 제거).
export function normalizeCompareTicker(input: string): string {
  return normalizeTickerText(input).replace(/^\$/, "");
}

export type CompareTickerResolution =
  | { ok: true; ticker: string; market: MddMarket }
  | { ok: false; error: string };

export function resolveCompareTickerInput(input: string): CompareTickerResolution {
  const ticker = normalizeCompareTicker(input);
  if (!ticker) return { ok: false, error: "티커를 입력해 주세요." };

  const krx = parseKrxTicker(ticker);
  if (krx?.suffix) {
    return { ok: true, ticker: krx.requestedTicker, market: "KR" };
  }
  if (krx && isLikelySuffixlessKrxTicker(ticker)) return { ok: true, ticker: krx.requestedTicker, market: "KR" };
  if (/\.K[QS]/.test(ticker)) {
    return { ok: false, error: "한국 종목은 영숫자 6자리 코드 뒤에 .KS 또는 .KQ 접미사를 한 번만 입력해 주세요." };
  }
  if (!/^[A-Z][A-Z0-9.-]*$/.test(ticker)) {
    return { ok: false, error: "미국 티커 또는 영숫자 6자리 한국 종목코드를 입력해 주세요." };
  }
  return { ok: true, ticker, market: "US" };
}
