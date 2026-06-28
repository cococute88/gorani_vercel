export type AssetMapEtfConstituent = {
  ticker: string;
  name: string;
  sector: string;
  weightPct: number;
};

export type AssetMapEtfConstituentFixture = {
  ticker: string;
  name: string;
  underlyingProxy?: string;
  leverageMultiplier?: number;
  notes: string;
  constituents: AssetMapEtfConstituent[];
};

const QQQ_CONSTITUENTS: AssetMapEtfConstituent[] = [
  { ticker: "MSFT", name: "Microsoft Corp", sector: "기술", weightPct: 8.7 },
  { ticker: "AAPL", name: "Apple Inc", sector: "기술", weightPct: 7.6 },
  { ticker: "NVDA", name: "NVIDIA Corp", sector: "기술", weightPct: 7.3 },
  { ticker: "AMZN", name: "Amazon.com Inc", sector: "경기소비재", weightPct: 5.4 },
  { ticker: "AVGO", name: "Broadcom Inc", sector: "기술", weightPct: 4.8 },
  { ticker: "META", name: "Meta Platforms Inc", sector: "커뮤니케이션", weightPct: 4.6 },
  { ticker: "NFLX", name: "Netflix Inc", sector: "커뮤니케이션", weightPct: 3.1 },
  { ticker: "COST", name: "Costco Wholesale Corp", sector: "필수소비재", weightPct: 2.8 },
  { ticker: "TSLA", name: "Tesla Inc", sector: "경기소비재", weightPct: 2.7 },
  { ticker: "GOOGL", name: "Alphabet Inc Class A", sector: "커뮤니케이션", weightPct: 2.5 },
  { ticker: "GOOG", name: "Alphabet Inc Class C", sector: "커뮤니케이션", weightPct: 2.4 },
  { ticker: "AMD", name: "Advanced Micro Devices Inc", sector: "기술", weightPct: 1.9 },
  { ticker: "ADBE", name: "Adobe Inc", sector: "기술", weightPct: 1.5 },
  { ticker: "PEP", name: "PepsiCo Inc", sector: "필수소비재", weightPct: 1.4 },
  { ticker: "LIN", name: "Linde PLC", sector: "소재", weightPct: 1.3 },
];

const SP500_CONSTITUENTS: AssetMapEtfConstituent[] = [
  { ticker: "MSFT", name: "Microsoft Corp", sector: "기술", weightPct: 7.2 },
  { ticker: "AAPL", name: "Apple Inc", sector: "기술", weightPct: 6.3 },
  { ticker: "NVDA", name: "NVIDIA Corp", sector: "기술", weightPct: 6.1 },
  { ticker: "AMZN", name: "Amazon.com Inc", sector: "경기소비재", weightPct: 3.8 },
  { ticker: "META", name: "Meta Platforms Inc", sector: "커뮤니케이션", weightPct: 2.8 },
  { ticker: "GOOGL", name: "Alphabet Inc Class A", sector: "커뮤니케이션", weightPct: 2.1 },
  { ticker: "GOOG", name: "Alphabet Inc Class C", sector: "커뮤니케이션", weightPct: 1.7 },
  { ticker: "BRK.B", name: "Berkshire Hathaway Inc Class B", sector: "금융", weightPct: 1.7 },
  { ticker: "AVGO", name: "Broadcom Inc", sector: "기술", weightPct: 1.6 },
  { ticker: "LLY", name: "Eli Lilly and Co", sector: "헬스케어", weightPct: 1.5 },
  { ticker: "JPM", name: "JPMorgan Chase & Co", sector: "금융", weightPct: 1.3 },
  { ticker: "V", name: "Visa Inc", sector: "금융", weightPct: 1.1 },
  { ticker: "XOM", name: "Exxon Mobil Corp", sector: "에너지", weightPct: 1.0 },
  { ticker: "UNH", name: "UnitedHealth Group Inc", sector: "헬스케어", weightPct: 0.9 },
  { ticker: "MA", name: "Mastercard Inc", sector: "금융", weightPct: 0.9 },
];

// Invesco S&P 500 Momentum ETF(SPMO) 상위 보유 비중표.
// S&P 500 중 모멘텀 스코어 상위 종목을 담아 SPY/QQQ 와 부분적으로 겹친다.
// 출처: 공개 보유 비중 스냅샷(상위 15종목, 전체 102종목 중). 전체 목록이 아니다.
const SPMO_CONSTITUENTS: AssetMapEtfConstituent[] = [
  { ticker: "MU", name: "Micron Technology Inc", sector: "기술", weightPct: 12.6 },
  { ticker: "NVDA", name: "NVIDIA Corp", sector: "기술", weightPct: 7.4 },
  { ticker: "AVGO", name: "Broadcom Inc", sector: "기술", weightPct: 6.1 },
  { ticker: "LRCX", name: "Lam Research Corp", sector: "기술", weightPct: 4.2 },
  { ticker: "GOOGL", name: "Alphabet Inc Class A", sector: "커뮤니케이션", weightPct: 4.1 },
  { ticker: "AMD", name: "Advanced Micro Devices Inc", sector: "기술", weightPct: 4.0 },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "헬스케어", weightPct: 3.9 },
  { ticker: "GOOG", name: "Alphabet Inc Class C", sector: "커뮤니케이션", weightPct: 3.3 },
  { ticker: "INTC", name: "Intel Corp", sector: "기술", weightPct: 3.2 },
  { ticker: "SNDK", name: "Sandisk Corp", sector: "기술", weightPct: 3.2 },
  { ticker: "CAT", name: "Caterpillar Inc", sector: "산업재", weightPct: 3.0 },
  { ticker: "XOM", name: "Exxon Mobil Corp", sector: "에너지", weightPct: 2.5 },
  { ticker: "AMAT", name: "Applied Materials Inc", sector: "기술", weightPct: 2.5 },
  { ticker: "WDC", name: "Western Digital Corp", sector: "기술", weightPct: 2.1 },
  { ticker: "STX", name: "Seagate Technology Holdings PLC", sector: "기술", weightPct: 2.1 },
];

const SCHD_CONSTITUENTS: AssetMapEtfConstituent[] = [
  { ticker: "TXN", name: "Texas Instruments Inc", sector: "기술", weightPct: 4.4 },
  { ticker: "AMGN", name: "Amgen Inc", sector: "헬스케어", weightPct: 4.3 },
  { ticker: "PEP", name: "PepsiCo Inc", sector: "필수소비재", weightPct: 4.2 },
  { ticker: "CSCO", name: "Cisco Systems Inc", sector: "기술", weightPct: 4.1 },
  { ticker: "AVGO", name: "Broadcom Inc", sector: "기술", weightPct: 4.0 },
  { ticker: "HD", name: "Home Depot Inc", sector: "경기소비재", weightPct: 4.0 },
  { ticker: "KO", name: "Coca-Cola Co", sector: "필수소비재", weightPct: 3.9 },
  { ticker: "ABBV", name: "AbbVie Inc", sector: "헬스케어", weightPct: 3.9 },
  { ticker: "MRK", name: "Merck & Co Inc", sector: "헬스케어", weightPct: 3.8 },
  { ticker: "CVX", name: "Chevron Corp", sector: "에너지", weightPct: 3.7 },
  { ticker: "LMT", name: "Lockheed Martin Corp", sector: "산업재", weightPct: 3.5 },
  { ticker: "VZ", name: "Verizon Communications Inc", sector: "커뮤니케이션", weightPct: 3.4 },
  { ticker: "PFE", name: "Pfizer Inc", sector: "헬스케어", weightPct: 3.3 },
  { ticker: "UPS", name: "United Parcel Service Inc", sector: "산업재", weightPct: 3.0 },
  { ticker: "BLK", name: "BlackRock Inc", sector: "금융", weightPct: 2.8 },
];

export const ASSET_MAP_ETF_CONSTITUENTS: Record<string, AssetMapEtfConstituentFixture> = {
  QQQ: {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    notes: "Deterministic top-holdings fixture. It is intentionally not a full constituent list.",
    constituents: QQQ_CONSTITUENTS,
  },
  QLD: {
    ticker: "QLD",
    name: "ProShares Ultra QQQ",
    underlyingProxy: "QQQ",
    leverageMultiplier: 2,
    notes: "Uses QQQ top holdings as the underlying proxy. Asset-map exposure is not leverage multiplied.",
    constituents: QQQ_CONSTITUENTS,
  },
  TQQQ: {
    ticker: "TQQQ",
    name: "ProShares UltraPro QQQ",
    underlyingProxy: "QQQ",
    leverageMultiplier: 3,
    notes: "Uses QQQ top holdings as the underlying proxy. Asset-map exposure is not leverage multiplied.",
    constituents: QQQ_CONSTITUENTS,
  },
  SPY: {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    notes: "Deterministic top-holdings fixture. It is intentionally not a full constituent list.",
    constituents: SP500_CONSTITUENTS,
  },
  SPYM: {
    ticker: "SPYM",
    name: "SPDR Portfolio S&P 500 High Dividend ETF",
    underlyingProxy: "SPY",
    notes: "Uses the same S&P 500 top-holdings fixture as SPY for conservative asset-map look-through.",
    constituents: SP500_CONSTITUENTS,
  },
  VOO: {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    underlyingProxy: "SPY",
    notes: "Uses the same S&P 500 top-holdings fixture as SPY.",
    constituents: SP500_CONSTITUENTS,
  },
  SCHD: {
    ticker: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    notes: "Deterministic top-holdings fixture. It is intentionally not a full constituent list.",
    constituents: SCHD_CONSTITUENTS,
  },
  SPMO: {
    ticker: "SPMO",
    name: "Invesco S&P 500 Momentum ETF",
    notes: "Deterministic top-holdings fixture (top 15 of ~102). Momentum tilt of the S&P 500.",
    constituents: SPMO_CONSTITUENTS,
  },
};

// 같은 지수를 추종하거나 사실상 동일한 구성종목을 갖는 ETF 별칭(alias).
// 직접 fixture 가 없어도 동일 지수의 대표 fixture 로 look-through 하기 위한 매핑이다.
// 값은 ASSET_MAP_ETF_CONSTITUENTS 의 키(원본 티커)여야 한다.
export const ASSET_MAP_ETF_ALIASES: Record<string, string> = {
  // S&P 500 추종(동일 지수, 운용사만 다름).
  IVV: "SPY", // iShares Core S&P 500
  SPLG: "SPY", // SPDR Portfolio S&P 500
  VV: "SPY", // Vanguard Large-Cap (S&P 500 근사)
  IVW: "SPY", // iShares S&P 500 Growth (S&P 500 상위로 근사)
  // 미국 전체 시장(대형주 비중이 지배적 → S&P 500 상위 fixture 로 근사).
  VTI: "SPY", // Vanguard Total Stock Market
  ITOT: "SPY", // iShares Core S&P Total US Stock Market
  SCHB: "SPY", // Schwab US Broad Market
  // Nasdaq-100 추종.
  QQQM: "QQQ", // Invesco NASDAQ 100 ETF
};

// 별칭을 원본 fixture 티커로 해석한다(없으면 입력 그대로).
export function resolveEtfFixtureTicker(ticker: string): string {
  const upper = ticker.trim().toUpperCase();
  return ASSET_MAP_ETF_ALIASES[upper] ?? upper;
}

export const KNOWN_ASSET_MAP_ETF_TICKERS = new Set([
  ...Object.keys(ASSET_MAP_ETF_CONSTITUENTS),
  ...Object.keys(ASSET_MAP_ETF_ALIASES),
  "JEPI",
  "JEPQ",
  "VTI",
  "VYM",
  "SPYD",
  "DIA",
  "IWM",
  "TLT",
  "SHY",
  "VIG",
  "DGRO",
  "SCHG",
  "SOXX",
  "SOXL",
]);

export function getAssetMapEtfFixture(ticker: string): AssetMapEtfConstituentFixture | null {
  const direct = ASSET_MAP_ETF_CONSTITUENTS[ticker.trim().toUpperCase()];
  if (direct) return direct;
  // 별칭(동일 지수 ETF)은 원본 fixture 로 fallback 한다.
  const resolved = resolveEtfFixtureTicker(ticker);
  return ASSET_MAP_ETF_CONSTITUENTS[resolved] ?? null;
}
