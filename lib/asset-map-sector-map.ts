export const UNKNOWN_ASSET_MAP_SECTOR = "기타";

export type AssetMapSectorEntry = {
  name: string;
  sector: string;
};

export const ASSET_MAP_SECTOR_MAP: Record<string, AssetMapSectorEntry> = {
  MSFT: { name: "Microsoft Corp", sector: "기술" },
  AAPL: { name: "Apple Inc", sector: "기술" },
  GOOGL: { name: "Alphabet Inc Class A", sector: "커뮤니케이션" },
  GOOG: { name: "Alphabet Inc Class C", sector: "커뮤니케이션" },
  NVDA: { name: "NVIDIA Corp", sector: "기술" },
  TSLA: { name: "Tesla Inc", sector: "경기소비재" },
  NFLX: { name: "Netflix Inc", sector: "커뮤니케이션" },
  AMZN: { name: "Amazon.com Inc", sector: "경기소비재" },
  META: { name: "Meta Platforms Inc", sector: "커뮤니케이션" },
  AVGO: { name: "Broadcom Inc", sector: "기술" },
  COST: { name: "Costco Wholesale Corp", sector: "필수소비재" },
  JEPI: { name: "JPMorgan Equity Premium Income ETF", sector: UNKNOWN_ASSET_MAP_SECTOR },
  SCHD: { name: "Schwab US Dividend Equity ETF", sector: UNKNOWN_ASSET_MAP_SECTOR },
  QQQ: { name: "Invesco QQQ Trust", sector: UNKNOWN_ASSET_MAP_SECTOR },
  SPY: { name: "SPDR S&P 500 ETF Trust", sector: UNKNOWN_ASSET_MAP_SECTOR },
  VOO: { name: "Vanguard S&P 500 ETF", sector: UNKNOWN_ASSET_MAP_SECTOR },
  QLD: { name: "ProShares Ultra QQQ", sector: UNKNOWN_ASSET_MAP_SECTOR },
  TQQQ: { name: "ProShares UltraPro QQQ", sector: UNKNOWN_ASSET_MAP_SECTOR },
  "005930.KS": { name: "삼성전자", sector: "기술" },
  "000660.KS": { name: "SK하이닉스", sector: "기술" },
};

export const ASSET_MAP_KOREAN_NAME_TO_TICKER: Record<string, string> = {
  삼성전자: "005930.KS",
  "삼성전자우": "005935.KS",
  SK하이닉스: "000660.KS",
  "SK 하이닉스": "000660.KS",
};

export function getAssetMapSectorEntry(ticker: string): AssetMapSectorEntry {
  return (
    ASSET_MAP_SECTOR_MAP[ticker] ?? {
      name: ticker,
      sector: UNKNOWN_ASSET_MAP_SECTOR,
    }
  );
}
