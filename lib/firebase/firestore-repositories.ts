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
import type { CalendarEventMetaTarget, CalendarEventSourceKind } from "@/lib/calendar-event-identity";
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
  source?: "yahoo" | "firestore" | "cache" | "sample";
  warnings?: string[];
  fetchedAt?: string;
  ttlHours?: number;
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
