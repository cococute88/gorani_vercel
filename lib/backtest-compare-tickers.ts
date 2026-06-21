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
  return input.trim().replace(/^\$/, "").replace(/\s+/g, "").toUpperCase();
}
