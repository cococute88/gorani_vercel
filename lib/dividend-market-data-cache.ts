import { STORAGE_KEYS } from "./storage-keys";
import type { QuoteDividendsResponse, QuoteFxResponse, QuoteLastResponse } from "./quote-types";

export type DividendMarketDataKind = "quote" | "dividends" | "fx";
export type DividendMarketDataResponse = QuoteLastResponse | QuoteDividendsResponse | QuoteFxResponse;

type CacheEntry = {
  kind: DividendMarketDataKind;
  key: string;
  savedAt: number;
  data: DividendMarketDataResponse;
};

type CacheEnvelope = {
  schemaVersion: 1;
  entries: Record<string, CacheEntry>;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const CACHE_SCHEMA_VERSION = 1;
const SHARED_RESULT_TTL_MS = 30_000;
export const DIVIDEND_MARKET_DATA_MAX_AGE_MS: Record<DividendMarketDataKind, number> = {
  // Four days covers normal weekends/market holidays while remaining clearly
  // marked stale in the response consumed by the UI.
  quote: 4 * 24 * 60 * 60 * 1_000,
  dividends: 14 * 24 * 60 * 60 * 1_000,
  fx: 4 * 24 * 60 * 60 * 1_000,
};

const inFlightRequests = new Map<string, Promise<DividendMarketDataResponse | undefined>>();
const sharedResults = new Map<string, { expiresAt: number; value: DividendMarketDataResponse | undefined }>();

function storageOrUndefined(): StorageLike | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function entryKey(kind: DividendMarketDataKind, key: string): string {
  return `${kind}:${key.trim().toUpperCase()}`;
}

function emptyEnvelope(): CacheEnvelope {
  return { schemaVersion: CACHE_SCHEMA_VERSION, entries: {} };
}

function readEnvelope(storage: StorageLike | undefined): CacheEnvelope {
  if (!storage) return emptyEnvelope();
  try {
    const raw = storage.getItem(STORAGE_KEYS.dividendMarketDataCache);
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope>;
    if (parsed.schemaVersion !== CACHE_SCHEMA_VERSION || !parsed.entries || typeof parsed.entries !== "object") {
      return emptyEnvelope();
    }
    return { schemaVersion: CACHE_SCHEMA_VERSION, entries: parsed.entries };
  } catch {
    return emptyEnvelope();
  }
}

function writeTrustedResponse(
  storage: StorageLike | undefined,
  kind: DividendMarketDataKind,
  key: string,
  data: DividendMarketDataResponse,
  now: number,
): void {
  if (!storage) return;
  try {
    const envelope = readEnvelope(storage);
    for (const [storedKey, entry] of Object.entries(envelope.entries)) {
      if (!Number.isFinite(entry.savedAt) || now - entry.savedAt > DIVIDEND_MARKET_DATA_MAX_AGE_MS[entry.kind]) {
        delete envelope.entries[storedKey];
      }
    }
    envelope.entries[entryKey(kind, key)] = { kind, key: key.trim().toUpperCase(), savedAt: now, data };
    storage.setItem(STORAGE_KEYS.dividendMarketDataCache, JSON.stringify(envelope));
  } catch {
    // 캐시 저장 실패는 실데이터 요청 결과를 바꾸지 않는다.
  }
}

export function isTrustedDividendMarketData(
  kind: DividendMarketDataKind,
  value: DividendMarketDataResponse | undefined,
): boolean {
  if (!value || value.source === "sample") return false;
  if (kind === "quote") {
    const quote = value as QuoteLastResponse;
    return typeof quote.price === "number" && Number.isFinite(quote.price) && quote.price > 0;
  }
  if (kind === "dividends") {
    const dividends = value as QuoteDividendsResponse;
    return Array.isArray(dividends.dividends) && dividends.dividends.length > 0;
  }
  const fx = value as QuoteFxResponse;
  return fx.source === "yahoo" && typeof fx.rate === "number" && Number.isFinite(fx.rate) && fx.rate >= 700 && fx.rate <= 3_000;
}

export function readLastKnownGood<T extends DividendMarketDataResponse>(options: {
  kind: DividendMarketDataKind;
  key: string;
  storage?: StorageLike;
  now?: number;
}): T | undefined {
  return readLastKnownGoodEntry(options)?.data as T | undefined;
}

function readLastKnownGoodEntry(options: {
  kind: DividendMarketDataKind;
  key: string;
  storage?: StorageLike;
  now?: number;
}): CacheEntry | undefined {
  const now = options.now ?? Date.now();
  const entry = readEnvelope(options.storage ?? storageOrUndefined()).entries[entryKey(options.kind, options.key)];
  if (!entry || entry.kind !== options.kind || entry.key !== options.key.trim().toUpperCase()) return undefined;
  if (!Number.isFinite(entry.savedAt) || now - entry.savedAt > DIVIDEND_MARKET_DATA_MAX_AGE_MS[options.kind]) return undefined;
  if (!isTrustedDividendMarketData(options.kind, entry.data)) return undefined;
  return entry;
}

function recoveryWarning(kind: DividendMarketDataKind, key: string, updatedAt: string): string {
  const label = kind === "quote" ? "현재가" : kind === "dividends" ? "배당 이력" : "환율";
  return `${key}: ${label} provider 일시 실패로 최근 정상 데이터(${updatedAt})를 사용합니다.`;
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings.filter(Boolean)));
}

async function loadMarketData<T extends DividendMarketDataResponse>(options: {
  path: string;
  kind: DividendMarketDataKind;
  key: string;
  fetcher: (path: string) => Promise<T>;
  storage?: StorageLike;
  now: number;
}): Promise<T | undefined> {
  let providerValue: T | undefined;
  let requestWarning: string | undefined;
  try {
    providerValue = await options.fetcher(options.path);
  } catch (error) {
    requestWarning = `${options.key}: 요청 실패 (${error instanceof Error ? error.message : String(error)})`;
  }

  if (providerValue && isTrustedDividendMarketData(options.kind, providerValue)) {
    writeTrustedResponse(options.storage ?? storageOrUndefined(), options.kind, options.key, providerValue, options.now);
    return providerValue;
  }

  const cachedEntry = readLastKnownGoodEntry({
    kind: options.kind,
    key: options.key,
    storage: options.storage ?? storageOrUndefined(),
    now: options.now,
  });
  if (!cachedEntry) {
    if (!providerValue || !requestWarning) return providerValue;
    return {
      ...providerValue,
      warnings: dedupeWarnings([...(providerValue.warnings ?? []), requestWarning]),
    };
  }
  const cached = cachedEntry.data as T;

  return {
    ...cached,
    cacheStatus: "stale",
    cachedAt: new Date(cachedEntry.savedAt).toISOString(),
    warnings: dedupeWarnings([
      ...(cached.warnings ?? []),
      ...(providerValue?.warnings ?? []),
      ...(requestWarning ? [requestWarning] : []),
      recoveryWarning(options.kind, options.key, cached.updatedAt),
    ]),
  };
}

/**
 * Dividend overview requests share in-flight and very recent results across
 * hook instances. Only provider-backed responses enter last-known-good storage;
 * deterministic sample/mock payloads are never persisted or promoted.
 */
export function requestDividendMarketData<T extends DividendMarketDataResponse>(options: {
  path: string;
  kind: DividendMarketDataKind;
  key: string;
  fetcher: (path: string) => Promise<T>;
  storage?: StorageLike;
  now?: number;
}): Promise<T | undefined> {
  const now = options.now ?? Date.now();
  const requestKey = `${options.kind}:${options.path}`;
  const shared = sharedResults.get(requestKey);
  if (shared && shared.expiresAt > now) return Promise.resolve(shared.value as T | undefined);

  const existing = inFlightRequests.get(requestKey);
  if (existing) return existing as Promise<T | undefined>;

  const pending = loadMarketData({ ...options, now })
    .then((value) => {
      sharedResults.set(requestKey, { expiresAt: now + SHARED_RESULT_TTL_MS, value });
      return value;
    })
    .finally(() => {
      inFlightRequests.delete(requestKey);
    });
  inFlightRequests.set(requestKey, pending);
  return pending as Promise<T | undefined>;
}

export function resetDividendMarketDataRequestCacheForTests(): void {
  inFlightRequests.clear();
  sharedResults.clear();
}
