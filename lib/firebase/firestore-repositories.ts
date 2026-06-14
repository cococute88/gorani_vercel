import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import type { StoredSimulatorPreview } from "@/lib/asset-simulator-types";
import { normalizeCalendarCustomEvent, type CalendarCustomEvent } from "@/lib/calendar-custom-events";
import {
  LEGACY_DIVIDEND_IMPORT_SOURCE,
  LEGACY_DIVIDEND_META_COLLECTION,
  normalizeLegacyImportedCalendarEventDoc,
  type LegacyImportedCalendarEvent,
} from "@/lib/legacy-dividend-calendar-import";
import { canonicalMemoTickerKey } from "@/lib/calendar-memo-matching";
import {
  MANUAL_CALENDAR_TICKERS_SOURCE,
  MANUAL_CALENDAR_TICKERS_VERSION,
  isValidManualCalendarTickerList,
  uniqueCalendarTickers,
  type ManualCalendarTickerList,
} from "@/lib/calendar-ticker-source";
import {
  normalizeCalendarTicker,
  type CalendarEventMetaTarget,
  type CalendarEventSourceKind,
  type CalendarTickerCache,
  type CalendarTickerCacheSource,
} from "@/lib/calendar-event-identity";
import type { CalendarEvent } from "@/lib/mock-calendar-data";
import { firestoreDb } from "./client";

export type CalendarTickerData = {
  ticker: string;
  name?: string;
  enabled?: boolean;
};

export type CalendarEventMeta = CalendarEventMetaTarget & {
  ticker?: string;
  sourceKind?: CalendarEventSourceKind;
  star?: boolean;
  heart?: boolean;
  memo?: string;
};

export type CalculatorPresetType = "dividend-capture" | "conversion" | "mdd";

export type CalculatorPreset = {
  id: string;
  type: CalculatorPresetType;
  name: string;
  values: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type DividendLedgerTransactionType = "dividend" | "buy" | "sell" | "fee" | "tax" | "adjustment";

export type DividendLedgerTransaction = {
  id: string;
  ticker: string;
  type: DividendLedgerTransactionType;
  tradeDate: string;
  account?: string;
  currency?: "USD" | "KRW" | string;
  shares?: number;
  amount: number;
  taxAmount?: number;
  feeAmount?: number;
  fxRate?: number;
  exDate?: string;
  payDate?: string;
  memo?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type DividendLedgerSettings = {
  baseCurrency?: "KRW" | "USD" | string;
  defaultTaxRate?: number;
  targetMonthlyDividendKRW?: number;
  targetAnnualDividendKRW?: number;
  watchedTickers?: string[];
  updatedAt?: unknown;
};

export type DividendLedgerTarget = {
  id: string;
  ticker?: string;
  label: string;
  targetAmountKRW: number;
  targetDate?: string;
  memo?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type FavoriteLink = {
  id: string;
  title: string;
  url: string;
  group?: string;
  tags?: string[];
  sortOrder?: number;
  memo?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CalendarCacheEntry = {
  id: string;
  ticker?: string;
  tickers: string[];
  month?: string;
  rangeStart?: string;
  rangeEnd?: string;
  events: Array<Record<string, unknown>>;
  source?: CalendarTickerCacheSource | "firestore";
  warnings?: string[];
  fetchedAt?: string;
  ttlHours?: number;
  schemaVersion?: number;
  expiresAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type UiPreferences = {
  theme?: "dark" | "light" | "system" | string;
  density?: "compact" | "comfortable" | string;
  locale?: string;
  defaultCurrency?: "KRW" | "USD" | string;
  updatedAt?: unknown;
};

export type TrackerConfig = {
  id?: string;
  values: Record<string, unknown>;
  updatedAt?: unknown;
};

function requireDb() {
  if (!firestoreDb) throw new Error("Firebase is not configured");
  return firestoreDb;
}

function userDoc(uid: string) {
  return doc(requireDb(), "users", uid);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const ref = userDoc(user.uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function savePortfolioSnapshot(uid: string, snapshot: PortfolioSnapshot): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "portfolioSnapshots", snapshot.id), {
    ...snapshot,
    updatedAt: serverTimestamp(),
  });
}

export async function loadPortfolioSnapshots(uid: string): Promise<PortfolioSnapshot[]> {
  const snap = await getDocs(query(collection(requireDb(), "users", uid, "portfolioSnapshots"), orderBy("snapshotDate", "asc")));
  return snap.docs.map((item) => item.data() as unknown as PortfolioSnapshot);
}

export async function deletePortfolioSnapshot(uid: string, snapshotId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "portfolioSnapshots", snapshotId));
}

export async function saveCalendarTicker(uid: string, tickerData: CalendarTickerData): Promise<void> {
  const ticker = tickerData.ticker.trim().toUpperCase();
  await setDoc(
    doc(requireDb(), "users", uid, "calendarTickers", ticker),
    { ...tickerData, ticker, enabled: tickerData.enabled ?? true, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadCalendarTickers(uid: string): Promise<CalendarTickerData[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarTickers"));
  return snap.docs.map((item) => item.data() as unknown as CalendarTickerData);
}

export async function deleteCalendarTicker(uid: string, ticker: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "calendarTickers", ticker.trim().toUpperCase()));
}

// CALENDAR-UX-POLISH-4: the manual calendar ticker override is stored as a
// single metadata-tagged doc (source/version), NOT as the legacy per-ticker
// `calendarTickers` collection. Only this metadata shape is allowed to override
// the imported legacy ticker universe; old array/collection values are stale.
const MANUAL_CALENDAR_TICKERS_DOC = "manualTickers";

export async function loadManualCalendarTickers(uid: string): Promise<ManualCalendarTickerList | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "calendarSettings", MANUAL_CALENDAR_TICKERS_DOC));
  if (!snap.exists()) return null;
  const data = snap.data();
  return isValidManualCalendarTickerList(data) ? (data as ManualCalendarTickerList) : null;
}

export async function saveManualCalendarTickers(uid: string, tickers: string[]): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calendarSettings", MANUAL_CALENDAR_TICKERS_DOC), {
    source: MANUAL_CALENDAR_TICKERS_SOURCE,
    version: MANUAL_CALENDAR_TICKERS_VERSION,
    tickers: uniqueCalendarTickers(tickers),
    updatedAt: serverTimestamp(),
  });
}

export async function saveCalendarSettings(uid: string, settings: Record<string, unknown>): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calendarSettings", "default"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadCalendarSettings(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "calendarSettings", "default"));
  return snap.exists() ? snap.data() : null;
}

export async function saveCalendarEventMeta(uid: string, eventId: string, meta: CalendarEventMeta): Promise<void> {
  await setDoc(
    doc(requireDb(), "users", uid, "calendarEvents", eventId),
    { ...meta, eventId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadCalendarEventMetas(uid: string): Promise<CalendarEventMeta[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarEvents"));
  return snap.docs.map((item) => item.data() as unknown as CalendarEventMeta);
}

// Legacy imported ticker memos live in a single doc:
//   users/{uid}/legacyDividendCalendarMeta/memos  ->  { items: { TICKER: memo } }
// These are shared per-ticker memos (not per-event), matching the original
// Streamlit `dividend_calendar.memos` behavior.
export async function loadLegacyDividendCalendarMemos(uid: string): Promise<Record<string, string>> {
  const snap = await getDoc(doc(requireDb(), "users", uid, LEGACY_DIVIDEND_META_COLLECTION, "memos"));
  if (!snap.exists()) return {};
  const items = (snap.data() as { items?: unknown } | undefined)?.items;
  const out: Record<string, string> = {};
  if (items && typeof items === "object" && !Array.isArray(items)) {
    for (const [key, value] of Object.entries(items as Record<string, unknown>)) {
      const ticker = canonicalMemoTickerKey(key);
      if (ticker && typeof value === "string" && value.trim()) out[ticker] = value;
    }
  }
  return out;
}

// Legacy imported portfolios live in a single doc:
//   users/{uid}/legacyDividendCalendarMeta/portfolios  ->  { items: { name: ticker[] } }
// This is the calendar's preferred ticker universe (NOT /portfolio holdings).
export async function loadLegacyDividendCalendarPortfolios(uid: string): Promise<Record<string, string[]>> {
  const snap = await getDoc(doc(requireDb(), "users", uid, LEGACY_DIVIDEND_META_COLLECTION, "portfolios"));
  if (!snap.exists()) return {};
  const items = (snap.data() as { items?: unknown } | undefined)?.items;
  const out: Record<string, string[]> = {};
  if (items && typeof items === "object" && !Array.isArray(items)) {
    for (const [name, value] of Object.entries(items as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const tickers = value.map((item) => normalizeCalendarTicker(String(item))).filter(Boolean);
      out[name] = Array.from(new Set(tickers));
    }
  }
  return out;
}

export async function saveLegacyDividendCalendarMemo(uid: string, ticker: string, memo: string): Promise<void> {
  const key = canonicalMemoTickerKey(ticker);
  if (!key) throw new Error("A valid ticker is required to save a memo");
  await setDoc(
    doc(requireDb(), "users", uid, LEGACY_DIVIDEND_META_COLLECTION, "memos"),
    {
      source: LEGACY_DIVIDEND_IMPORT_SOURCE,
      importedFrom: "dividend_calendar.memos",
      items: { [key]: memo },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function loadLegacyImportedCalendarEvents(uid: string): Promise<CalendarEvent[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarEvents"));
  return snap.docs
    .map((item) => normalizeLegacyImportedCalendarEventDoc({ id: item.id, ...item.data() }))
    .filter((event): event is LegacyImportedCalendarEvent => Boolean(event))
    .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker) || a.type.localeCompare(b.type));
}

export async function saveCalendarCustomEvent(uid: string, event: CalendarCustomEvent): Promise<void> {
  const normalized = normalizeCalendarCustomEvent(event);
  if (!normalized) throw new Error("Invalid custom calendar event");
  await setDoc(
    doc(requireDb(), "users", uid, "calendarCustomEvents", normalized.id),
    { ...normalized, syncedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadCalendarCustomEvents(uid: string): Promise<CalendarCustomEvent[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarCustomEvents"));
  return snap.docs
    .map((item) => normalizeCalendarCustomEvent({ id: item.id, ...item.data() }))
    .filter((event): event is CalendarCustomEvent => Boolean(event))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.ticker ?? "").localeCompare(b.ticker ?? "") || a.title.localeCompare(b.title));
}

export async function deleteCalendarCustomEvent(uid: string, eventId: string): Promise<void> {
  const normalized = normalizeCalendarCustomEvent({
    id: eventId,
    title: "delete",
    date: "2000-01-01",
    type: "custom",
    sourceKind: "custom",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });
  if (!normalized) return;
  await deleteDoc(doc(requireDb(), "users", uid, "calendarCustomEvents", normalized.id));
}

export async function saveAssetSimulatorConfig(uid: string, config: StoredSimulatorPreview): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"), {
    ...config,
    updatedAt: serverTimestamp(),
  });
}

export async function loadAssetSimulatorConfig(uid: string): Promise<StoredSimulatorPreview | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"));
  return snap.exists() ? (snap.data() as unknown as StoredSimulatorPreview) : null;
}

export async function deleteAssetSimulatorConfig(uid: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"));
}

export async function saveCalculatorPreset(uid: string, preset: CalculatorPreset): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calculatorPresets", preset.id), {
    ...preset,
    updatedAt: serverTimestamp(),
    createdAt: preset.createdAt ?? serverTimestamp(),
  });
}

export async function loadCalculatorPresets(uid: string): Promise<CalculatorPreset[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calculatorPresets"));
  return snap.docs.map((item) => item.data() as unknown as CalculatorPreset);
}

export async function deleteCalculatorPreset(uid: string, presetId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "calculatorPresets", presetId));
}

export async function saveDividendLedgerTransaction(uid: string, transaction: DividendLedgerTransaction): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "dividendLedgerTransactions", transaction.id), {
    ...transaction,
    ticker: transaction.ticker.trim().toUpperCase(),
    updatedAt: serverTimestamp(),
    createdAt: transaction.createdAt ?? serverTimestamp(),
  });
}

export async function loadDividendLedgerTransactions(uid: string): Promise<DividendLedgerTransaction[]> {
  const snap = await getDocs(query(collection(requireDb(), "users", uid, "dividendLedgerTransactions"), orderBy("tradeDate", "desc")));
  return snap.docs.map((item) => item.data() as unknown as DividendLedgerTransaction);
}

export async function deleteDividendLedgerTransaction(uid: string, transactionId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "dividendLedgerTransactions", transactionId));
}

export async function saveDividendLedgerSettings(uid: string, settings: DividendLedgerSettings): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "dividendLedgerSettings", "default"), {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadDividendLedgerSettings(uid: string): Promise<DividendLedgerSettings | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "dividendLedgerSettings", "default"));
  return snap.exists() ? (snap.data() as unknown as DividendLedgerSettings) : null;
}

export async function saveDividendLedgerTarget(uid: string, target: DividendLedgerTarget): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "dividendLedgerTargets", target.id), {
    ...target,
    updatedAt: serverTimestamp(),
    createdAt: target.createdAt ?? serverTimestamp(),
  });
}

export async function loadDividendLedgerTargets(uid: string): Promise<DividendLedgerTarget[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "dividendLedgerTargets"));
  return snap.docs.map((item) => item.data() as unknown as DividendLedgerTarget);
}

export async function deleteDividendLedgerTarget(uid: string, targetId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "dividendLedgerTargets", targetId));
}

export async function saveFavoriteLink(uid: string, link: FavoriteLink): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "favoriteLinks", link.id), {
    ...link,
    updatedAt: serverTimestamp(),
    createdAt: link.createdAt ?? serverTimestamp(),
  });
}

export async function loadFavoriteLinks(uid: string): Promise<FavoriteLink[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "favoriteLinks"));
  return snap.docs
    .map((item) => item.data() as unknown as FavoriteLink)
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
}

export async function deleteFavoriteLink(uid: string, linkId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "favoriteLinks", linkId));
}

export async function saveCalendarCacheEntry(uid: string, entry: CalendarCacheEntry): Promise<void> {
  const { ticker: rawTicker, ...rest } = entry;
  const ticker = rawTicker?.trim().toUpperCase();
  const payload: CalendarCacheEntry = {
    ...rest,
    ...(ticker ? { ticker } : {}),
    tickers: rest.tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean),
  };
  await setDoc(doc(requireDb(), "users", uid, "calendarCache", entry.id), {
    ...payload,
    updatedAt: serverTimestamp(),
    createdAt: entry.createdAt ?? serverTimestamp(),
  });
}

export async function loadCalendarCacheEntries(uid: string): Promise<CalendarCacheEntry[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarCache"));
  return snap.docs.map((item) => item.data() as unknown as CalendarCacheEntry);
}

export async function deleteCalendarCacheEntry(uid: string, entryId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "calendarCache", entryId));
}

function toCalendarTickerCacheEntry(entry: CalendarTickerCache<Record<string, unknown>>): CalendarCacheEntry {
  const ticker = normalizeCalendarTicker(entry.ticker);
  return {
    id: ticker,
    ticker,
    tickers: ticker ? [ticker] : [],
    events: entry.events,
    source: entry.source,
    warnings: entry.warnings,
    fetchedAt: entry.fetchedAt,
    expiresAt: entry.expiresAt,
    schemaVersion: entry.schemaVersion,
  };
}

function fromCalendarCacheEntry(entry: CalendarCacheEntry): CalendarTickerCache<Record<string, unknown>> | null {
  const ticker = normalizeCalendarTicker(entry.ticker ?? entry.id ?? entry.tickers?.[0] ?? "");
  if (!ticker) return null;
  const source: CalendarTickerCacheSource =
    entry.source === "mock" || entry.source === "yahoo" || entry.source === "sample" || entry.source === "cache"
      ? entry.source
      : "cache";

  return {
    ticker,
    events: entry.events,
    fetchedAt: entry.fetchedAt ?? "",
    expiresAt: typeof entry.expiresAt === "string" ? entry.expiresAt : "",
    source,
    warnings: entry.warnings ?? [],
    schemaVersion: entry.schemaVersion ?? 0,
  };
}

export async function saveCalendarTickerCacheEntry(
  uid: string,
  entry: CalendarTickerCache<Record<string, unknown>>,
): Promise<void> {
  await saveCalendarCacheEntry(uid, toCalendarTickerCacheEntry(entry));
}

export async function loadCalendarTickerCacheEntry(
  uid: string,
  ticker: string,
): Promise<CalendarTickerCache<Record<string, unknown>> | null> {
  const normalizedTicker = normalizeCalendarTicker(ticker);
  if (!normalizedTicker) return null;
  const snap = await getDoc(doc(requireDb(), "users", uid, "calendarCache", normalizedTicker));
  return snap.exists() ? fromCalendarCacheEntry(snap.data() as unknown as CalendarCacheEntry) : null;
}

export async function deleteCalendarTickerCacheEntry(uid: string, ticker: string): Promise<void> {
  const normalizedTicker = normalizeCalendarTicker(ticker);
  if (!normalizedTicker) return;
  await deleteCalendarCacheEntry(uid, normalizedTicker);
}

export async function saveUiPreferences(uid: string, preferences: UiPreferences): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "uiPreferences", "default"), {
    ...preferences,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadUiPreferences(uid: string): Promise<UiPreferences | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "uiPreferences", "default"));
  return snap.exists() ? (snap.data() as unknown as UiPreferences) : null;
}

export async function saveTrackerConfig(uid: string, config: TrackerConfig): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "trackerConfig", config.id ?? "default"), {
    ...config,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadTrackerConfig(uid: string, configId = "default"): Promise<TrackerConfig | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "trackerConfig", configId));
  return snap.exists() ? (snap.data() as unknown as TrackerConfig) : null;
}

export function warnFirestoreFallback(scope: string, err: unknown): void {
  console.warn(`${scope} Firestore operation failed; keeping localStorage fallback`, err as DocumentData);
}
