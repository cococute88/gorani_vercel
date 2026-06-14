import type { Holding } from "./portfolio-types";
import { STORAGE_KEYS } from "./storage-keys";

export type KrxTickerNameMapEntry = {
  ticker: string;
  displayTicker: string;
  rawProductName: string;
  updatedAt: string;
};

export type KrxTickerNameMap = Record<string, KrxTickerNameMapEntry>;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type HoldingNameInput = Partial<Pick<Holding, "productName" | "cleanName" | "ticker">> & {
  name?: string | null;
};

export type NormalizedKrxTickerInput = {
  ticker: string;
  displayTicker: string;
  suffix: "KS" | "KQ";
};

export type UpsertKrxTickerMappingInput = {
  holding?: HoldingNameInput | null;
  rawProductName?: string | null;
  tickerInput: string;
  storage?: StorageLike;
  now?: string;
};

export type UpsertKrxTickerMappingResult =
  | {
      ok: true;
      normalizedProductName: string;
      entry: KrxTickerNameMapEntry;
      map: KrxTickerNameMap;
    }
  | {
      ok: false;
      error: "invalid_product_name" | "invalid_ticker";
      normalizedProductName: string;
      map: KrxTickerNameMap;
    };

const STORAGE_KEY = STORAGE_KEYS.krxTickerNameMap;
const DEFAULT_SUFFIX: "KS" = "KS";
const ORDERED_TAG_PATTERN = /([①②③④])\s*([^#①②③④\s][^#①②③④]*)/g;
const HASH_ORDERED_TAG_PATTERN = /#\s*([①②③④]|[1-4])\s*([^#①②③④\s][^#①②③④]*)/g;
const HASH_TAG_PATTERN = /#([^#\s]+)/g;
const ACCOUNT_PREFIX_PATTERN = /^(미래연금저축|미래연금|KBISA|ISA|IRP|KB위탁)+/i;
const ACCOUNT_WORD_PATTERN = /\b(KBISA|ISA|IRP)\b|(?:연금저축|개인연금|퇴직연금|위탁|절세계좌)/gi;
const FUND_WORD_PATTERN = /(상장지수펀드|인덱스펀드|증권투자신탁|투자신탁|ETF|ETN|펀드)/gi;

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKrxTickerInput(value: string): NormalizedKrxTickerInput | null {
  const raw = (value ?? "").trim().replace(/\s+/g, "").toUpperCase();
  const match = raw.match(/^(\d{6})(?:\.(KS|KQ))?$/);
  if (!match) return null;

  const ticker = match[1];
  const suffix = (match[2] as "KS" | "KQ" | undefined) ?? DEFAULT_SUFFIX;
  return {
    ticker,
    suffix,
    displayTicker: `${ticker}.${suffix}`,
  };
}

function productNameOf(input: HoldingNameInput | null | undefined, rawProductName?: string | null): string {
  return (
    rawProductName ??
    input?.cleanName ??
    input?.productName ??
    input?.name ??
    ""
  ).trim();
}

export function normalizeProductNameForTickerMap(value: string | null | undefined): string {
  let text = (value ?? "").normalize("NFKC").replace(/＆/g, "&").trim();
  if (!text) return "";

  text = text
    .replace(HASH_ORDERED_TAG_PATTERN, " ")
    .replace(ORDERED_TAG_PATTERN, " ")
    .replace(HASH_TAG_PATTERN, " ");

  text = text
    .replace(/[([{［【]\s*(KBISA|ISA|IRP|위탁|연금저축|개인연금|퇴직연금|절세계좌)\s*[\])}］】]/gi, " ")
    .replace(ACCOUNT_PREFIX_PATTERN, "")
    .replace(ACCOUNT_WORD_PATTERN, " ")
    .replace(FUND_WORD_PATTERN, " ")
    .replace(/S\s*&\s*P/gi, "SP")
    .replace(/S\s*AND\s*P/gi, "SP")
    .replace(/SNP/gi, "SP")
    .replace(/NASDAQ\s*100/gi, "NASDAQ100")
    .toUpperCase();

  return text.replace(/[^0-9A-Z가-힣]/g, "");
}

function normalizeStoredEntry(value: unknown): KrxTickerNameMapEntry | null {
  if (!isRecord(value)) return null;
  const tickerValue = typeof value.ticker === "string" ? value.ticker : "";
  const displayValue = typeof value.displayTicker === "string" ? value.displayTicker : tickerValue;
  const normalized = normalizeKrxTickerInput(displayValue) ?? normalizeKrxTickerInput(tickerValue);
  if (!normalized) return null;

  return {
    ticker: normalized.ticker,
    displayTicker: normalized.displayTicker,
    rawProductName: typeof value.rawProductName === "string" ? value.rawProductName : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

export function loadKrxTickerNameMap(storage: StorageLike | undefined = getBrowserStorage()): KrxTickerNameMap {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [normalizeProductNameForTickerMap(key), normalizeStoredEntry(value)] as const)
        .filter((entry): entry is readonly [string, KrxTickerNameMapEntry] => Boolean(entry[0] && entry[1])),
    );
  } catch {
    return {};
  }
}

export function saveKrxTickerNameMap(
  map: KrxTickerNameMap,
  storage: StorageLike | undefined = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable or full: keep in-memory UI state only.
  }
}

export function upsertKrxTickerMapping(input: UpsertKrxTickerMappingInput): UpsertKrxTickerMappingResult {
  const map = loadKrxTickerNameMap(input.storage);
  const rawProductName = productNameOf(input.holding, input.rawProductName);
  const normalizedProductName = normalizeProductNameForTickerMap(rawProductName);
  if (!normalizedProductName) {
    return { ok: false, error: "invalid_product_name", normalizedProductName, map };
  }

  const ticker = normalizeKrxTickerInput(input.tickerInput);
  if (!ticker) {
    return { ok: false, error: "invalid_ticker", normalizedProductName, map };
  }

  const entry: KrxTickerNameMapEntry = {
    ticker: ticker.ticker,
    displayTicker: ticker.displayTicker,
    rawProductName,
    updatedAt: input.now ?? new Date().toISOString(),
  };
  const next = { ...map, [normalizedProductName]: entry };
  saveKrxTickerNameMap(next, input.storage);
  return { ok: true, normalizedProductName, entry, map: next };
}

export function findKrxTickerMappingForHolding(
  holding: HoldingNameInput | null | undefined,
  map: KrxTickerNameMap = loadKrxTickerNameMap(),
): KrxTickerNameMapEntry | null {
  const normalizedProductName = normalizeProductNameForTickerMap(productNameOf(holding));
  return normalizedProductName ? (map[normalizedProductName] ?? null) : null;
}

export function applyKrxTickerMappingsToHoldings(
  holdings: Holding[],
  map: KrxTickerNameMap = loadKrxTickerNameMap(),
): { holdings: Holding[]; appliedCount: number } {
  let appliedCount = 0;
  const next = holdings.map((holding) => {
    if ((holding.ticker ?? "").trim()) return holding;
    const mapping = findKrxTickerMappingForHolding(holding, map);
    if (!mapping) return holding;
    appliedCount += 1;
    return {
      ...holding,
      ticker: mapping.displayTicker,
      tickerConfidence: "high" as const,
      needsReview: false,
    };
  });

  return { holdings: next, appliedCount };
}

export function normalizeKrxTickerForTickerMap(value: string): NormalizedKrxTickerInput | null {
  return normalizeKrxTickerInput(value);
}
