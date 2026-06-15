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
};

export const KNOWN_ASSET_MAP_ETF_TICKERS = new Set([
  ...Object.keys(ASSET_MAP_ETF_CONSTITUENTS),
  "JEPI",
  "JEPQ",
  "VTI",
  "VYM",
  "SPYD",
  "DIA",
  "IWM",
  "TLT",
  "SHY",
]);

export function getAssetMapEtfFixture(ticker: string): AssetMapEtfConstituentFixture | null {
  return ASSET_MAP_ETF_CONSTITUENTS[ticker] ?? null;
}
