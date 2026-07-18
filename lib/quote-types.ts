export type DataSource = "yahoo" | "stooq" | "firestore" | "localStorage" | "sample" | "cache";

export type DataResult<T> = {
  data: T;
  source: DataSource;
  warnings: string[];
  updatedAt?: string;
};

export type DataResultMeta<S extends DataSource = DataSource> = {
  source: S;
  warnings: string[];
  updatedAt: string;
};

export type QuoteSource = Extract<DataSource, "yahoo" | "stooq" | "sample">;

export type QuoteHistoryPrice = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export type QuoteHistoryResponse = DataResultMeta<QuoteSource> & {
  ticker: string;
  normalizedTicker: string;
  prices: QuoteHistoryPrice[];
};

export type QuoteDividendsResponse = DataResultMeta<Extract<DataSource, "yahoo" | "sample">> & {
  ticker: string;
  normalizedTicker: string;
  dividends: Array<{
    date: string;
    amount: number;
  }>;
};

export type QuoteLastResponse = DataResultMeta<QuoteSource> & {
  ticker: string;
  normalizedTicker: string;
  price: number | null;
  date: string | null;
};

export type QuoteFxResponse = DataResultMeta<Extract<DataSource, "yahoo" | "sample">> & {
  pair: "USDKRW";
  rate: number | null;
  date: string | null;
};
