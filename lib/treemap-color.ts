// 보유종목 트리맵의 색상 카테고리.
// - nasdaq: 나스닥 계열 → 붉은색 (TQQQ/QQQ/QLD/나스닥100 등)
// - cash: 현금성 → 초록색 (현금/MMF/SGOV/예수금/달러 등)
// - sp: S&P / SCHD / MSFT → 노란색 (SPY/VOO/SPYM 포함)
// - other: 기타 → 파란색
export type TreemapColorCategory = "nasdaq" | "cash" | "sp" | "other";

const NASDAQ_TICKERS = new Set(["TQQQ", "QQQ", "QQQM", "QLD", "TQQ"]);
const CASH_TICKERS = new Set(["SGOV", "BIL", "CASH", "CASH_LIKE", "MMF", "KRW", "USD"]);
const SP_TICKERS = new Set(["SPY", "SPYM", "SPLG", "VOO", "IVV", "SCHD", "MSFT"]);

const NASDAQ_SIGNALS = ["나스닥", "NASDAQ"];
const CASH_SIGNALS = ["현금", "예수금", "예치금", "대기자금", "MMF", "MMW", "CMA", "파킹", "달러", "예적금"];
const SP_SIGNALS = ["S&P", "SP500", "S&P500", "에스앤피", "SCHD", "MSFT"];

function baseTicker(ticker: string | null | undefined): string {
  return (ticker ?? "").trim().toUpperCase().split(".")[0];
}

function includesAny(haystack: string, signals: string[]): boolean {
  return signals.some((signal) => haystack.includes(signal.toUpperCase()));
}

// 종목 이름/티커를 기준으로 트리맵 색상 카테고리를 결정한다.
export function treemapColorCategory(input: { name?: string | null; ticker?: string | null }): TreemapColorCategory {
  const code = baseTicker(input.ticker);
  const haystack = `${input.name ?? ""} ${input.ticker ?? ""}`.toUpperCase();

  if (NASDAQ_TICKERS.has(code) || includesAny(haystack, NASDAQ_SIGNALS)) return "nasdaq";
  if (CASH_TICKERS.has(code) || includesAny(haystack, CASH_SIGNALS)) return "cash";
  if (SP_TICKERS.has(code) || includesAny(haystack, SP_SIGNALS)) return "sp";
  return "other";
}

// 카테고리별 라이트/다크 배경·텍스트 클래스.
// 라이트모드는 100~200 톤의 연한 배경 + slate-900 텍스트로 검은 글씨가 잘 보이게 한다.
// 다크모드는 진한 배경 + near-white 텍스트를 유지한다.
export const TREEMAP_CATEGORY_CLASSES: Record<TreemapColorCategory, { light: string; dark: string }> = {
  nasdaq: { light: "bg-red-100 text-slate-900", dark: "bg-red-600/85 text-white" },
  cash: { light: "bg-green-100 text-slate-900", dark: "bg-emerald-600/85 text-white" },
  sp: { light: "bg-yellow-100 text-slate-900", dark: "bg-amber-500/85 text-white" },
  other: { light: "bg-blue-100 text-slate-900", dark: "bg-blue-600/85 text-white" },
};
