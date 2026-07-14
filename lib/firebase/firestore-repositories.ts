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
  arrayUnion,
  arrayRemove,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import type { StoredSimulatorPreview } from "@/lib/asset-simulator-types";
import { buildFirestoreSimulatorConfigPayload, findFirestoreUnsafePaths } from "@/lib/asset-simulator-persistence";
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

export function portfolioSyncMetadataPath(uid: string): string {
  return `users/${uid}/portfolioSyncMetadata/status`;
}

function devPortfolioSyncLog(message: string, details: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[Portfolio Sync]", message, details);
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

export type PortfolioSyncMetadata = {
  exists: boolean;
  lastSyncedAtMs: number | null;
  lastSyncedAtIso: string | null;
  updatedAtMs: number | null;
  updatedAtIso: string | null;
};

function portfolioSyncMetadataDoc(uid: string) {
  return doc(requireDb(), portfolioSyncMetadataPath(uid));
}

function firestoreTimeToMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && "toMillis" in value && typeof (value as Timestamp).toMillis === "function") {
    const parsed = (value as Timestamp).toMillis();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function metadataFromSnapshot(snap: { exists: () => boolean; data: () => DocumentData | undefined }): PortfolioSyncMetadata {
  const data = snap.exists() ? snap.data() : null;
  const lastSyncedAtMs = data ? firestoreTimeToMs(data.lastSyncedAt) : null;
  const updatedAtMs = data ? firestoreTimeToMs(data.updatedAt) : null;
  return {
    exists: snap.exists(),
    lastSyncedAtMs,
    lastSyncedAtIso: lastSyncedAtMs ? new Date(lastSyncedAtMs).toISOString() : null,
    updatedAtMs,
    updatedAtIso: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
  };
}

export async function recordPortfolioCloudSyncSuccess(uid: string): Promise<PortfolioSyncMetadata> {
  const path = portfolioSyncMetadataPath(uid);
  const ref = portfolioSyncMetadataDoc(uid);
  devPortfolioSyncLog("metadata write start", { uid, path });
  try {
    await setDoc(ref, { lastSyncedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    devPortfolioSyncLog("metadata write success", { uid, path });
  } catch (err) {
    console.error("[Portfolio Sync] Firestore metadata write FAILED", {
      uid,
      path,
      reason: err instanceof Error ? err.message : String(err),
      error: err,
    });
    throw err;
  }

  devPortfolioSyncLog("metadata read start", { uid, path });
  const snap = await getDoc(ref);
  const metadata = metadataFromSnapshot(snap);
  devPortfolioSyncLog("metadata read success", {
    uid,
    path,
    exists: metadata.exists,
    lastSyncedAt: metadata.lastSyncedAtIso,
    updatedAt: metadata.updatedAtIso,
  });
  return metadata;
}

export async function loadPortfolioSyncMetadata(uid: string): Promise<PortfolioSyncMetadata> {
  const path = portfolioSyncMetadataPath(uid);
  devPortfolioSyncLog("metadata read start", { uid, path });
  const snap = await getDoc(portfolioSyncMetadataDoc(uid));
  const metadata = metadataFromSnapshot(snap);
  devPortfolioSyncLog("metadata read success", {
    uid,
    path,
    exists: metadata.exists,
    lastSyncedAt: metadata.lastSyncedAtIso,
    updatedAt: metadata.updatedAtIso,
  });
  return metadata;
}

export async function savePortfolioSnapshot(uid: string, snapshot: PortfolioSnapshot): Promise<PortfolioSyncMetadata> {
  await setDoc(doc(requireDb(), "users", uid, "portfolioSnapshots", snapshot.id), {
    ...snapshot,
    updatedAt: serverTimestamp(),
  });
  return recordPortfolioCloudSyncSuccess(uid);
}

export async function loadPortfolioSnapshots(uid: string): Promise<PortfolioSnapshot[]> {
  const snap = await getDocs(query(collection(requireDb(), "users", uid, "portfolioSnapshots"), orderBy("snapshotDate", "asc")));
  return snap.docs.map((item) => item.data() as unknown as PortfolioSnapshot);
}

export async function deletePortfolioSnapshot(uid: string, snapshotId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "portfolioSnapshots", snapshotId));
}

// =============================================================
// 스냅샷 관리 상태(숨김/삭제 묘비)의 Firestore 영구 저장.
//
// 왜 필요한가: "등록된 스냅샷 히스토리"의 숨기기/삭제는 기존에 localStorage 에만
// 기록되어, 같은 Google 계정으로 다른 브라우저/기기에서 접속하면 숨김/삭제 상태가
// 반영되지 않았다(읽기 전용 파이프라인 오버레이 `portfolio_snapshots` 는 클라이언트가
// 문서를 지울 수 없으므로 묘비가 필수). 이 상태를 사용자 문서 하위
//   users/{uid}/portfolioSnapshotState/state  → { deletedDates: string[], hiddenDates: string[] }
// 단일 문서에 저장해, 모든 브라우저/기기에서 동일하게 적용되도록 한다.
//
// - 키 기준: snapshotDate(YYYY-MM-DD). localStorage 묘비/병합 로직과 동일 단위.
// - 추가/제거는 arrayUnion/arrayRemove 로 원자적으로 처리한다.
// - Firestore 규칙(users/{uid}/**: 본인 read/write 허용) 안에서 동작한다.
// =============================================================
export type PortfolioSnapshotManagementState = {
  deletedDates: string[];
  hiddenDates: string[];
};

function portfolioSnapshotStateDoc(uid: string) {
  return doc(requireDb(), "users", uid, "portfolioSnapshotState", "state");
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** 사용자의 스냅샷 숨김/삭제 상태를 읽는다(문서 없으면 빈 상태). */
export async function loadPortfolioSnapshotState(uid: string): Promise<PortfolioSnapshotManagementState> {
  const snap = await getDoc(portfolioSnapshotStateDoc(uid));
  if (!snap.exists()) return { deletedDates: [], hiddenDates: [] };
  const data = snap.data() as { deletedDates?: unknown; hiddenDates?: unknown };
  return {
    deletedDates: toStringArray(data.deletedDates),
    hiddenDates: toStringArray(data.hiddenDates),
  };
}

/** 삭제 묘비에 날짜 추가(영구 삭제 표시). */
export async function addDeletedSnapshotDateToCloud(uid: string, snapshotDate: string): Promise<void> {
  await setDoc(
    portfolioSnapshotStateDoc(uid),
    { deletedDates: arrayUnion(snapshotDate), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** 삭제 묘비에서 날짜 제거(같은 날짜 재등록 시). */
export async function removeDeletedSnapshotDateFromCloud(uid: string, snapshotDate: string): Promise<void> {
  await setDoc(
    portfolioSnapshotStateDoc(uid),
    { deletedDates: arrayRemove(snapshotDate), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** 숨김 목록에 날짜 추가. */
export async function addHiddenSnapshotDateToCloud(uid: string, snapshotDate: string): Promise<void> {
  await setDoc(
    portfolioSnapshotStateDoc(uid),
    { hiddenDates: arrayUnion(snapshotDate), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** 숨김 목록에서 날짜 제거(숨김 해제/재등록 시). */
export async function removeHiddenSnapshotDateFromCloud(uid: string, snapshotDate: string): Promise<void> {
  await setDoc(
    portfolioSnapshotStateDoc(uid),
    { hiddenDates: arrayRemove(snapshotDate), updatedAt: serverTimestamp() },
    { merge: true },
  );
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
  const payload = buildFirestoreSimulatorConfigPayload(config);
  const unsafePaths = findFirestoreUnsafePaths(payload);
  if (unsafePaths.length > 0) {
    console.warn("assetSimulator.save blocked Firestore-unsafe payload paths", unsafePaths);
    throw new Error(`Asset simulator Firestore payload is not serializable: ${unsafePaths.join(", ")}`);
  }
  await setDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"), {
    ...payload,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadAssetSimulatorConfig(uid: string): Promise<StoredSimulatorPreview | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"));
  return snap.exists() ? (snap.data() as unknown as StoredSimulatorPreview) : null;
}

export async function deleteAssetSimulatorConfig(uid: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"));
}

// =============================================================
// 자산 시뮬레이터 상단 개인 메모.
//
// 시뮬레이터 입력/계획표(assetSimulatorConfigs)와 독립된 단일 문서에 저장한다.
//   users/{uid}/assetSimulatorMemo/default  ->  { text, updatedAt }
// 로그인 사용자별로 분리되고, 다른 기기에서도 동일하게 표시된다. 저장 시각은
// serverTimestamp() 로 서버가 찍는다.
// =============================================================
export type AssetSimulatorMemo = { text: string; updatedAt?: unknown };

export async function loadAssetSimulatorMemo(uid: string): Promise<AssetSimulatorMemo | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "assetSimulatorMemo", "default"));
  if (!snap.exists()) return null;
  const data = snap.data() as { text?: unknown; updatedAt?: unknown };
  return { text: typeof data.text === "string" ? data.text : "", updatedAt: data.updatedAt };
}

export async function saveAssetSimulatorMemo(uid: string, text: string): Promise<void> {
  await setDoc(
    doc(requireDb(), "users", uid, "assetSimulatorMemo", "default"),
    { text, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// =============================================================
// 자산 시뮬레이터 "메모 관리"(다중 메모) 컬렉션.
//
//   users/{uid}/assetSimulatorMemos/{memoId}
//     -> { id, title, content, createdAt, updatedAt }
//
// 각 메모를 개별 문서로 저장해 개수 제한 없이 확장할 수 있고, 향후 즐겨찾기
// (favorite)·태그(tags) 등의 필드를 추가하기 쉽다. createdAt/updatedAt 은
// 로컬과 동일한 epoch(ms) 숫자로 저장해 기기 간 병합을 결정적으로 만든다.
// 레거시 단일 메모(assetSimulatorMemo/default)는 손실 방지를 위해 그대로 둔다.
// =============================================================
export type AssetSimulatorMemoItem = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export async function loadAssetSimulatorMemos(uid: string): Promise<AssetSimulatorMemoItem[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "assetSimulatorMemos"));
  const out: AssetSimulatorMemoItem[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const content = typeof data.content === "string" ? data.content : "";
    const title = typeof data.title === "string" ? data.title : "";
    const createdAt = typeof data.createdAt === "number" ? data.createdAt : Date.now();
    const updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : createdAt;
    out.push({ id: docSnap.id, title, content, createdAt, updatedAt });
  });
  return out;
}

export async function saveAssetSimulatorMemoItem(uid: string, memo: AssetSimulatorMemoItem): Promise<void> {
  await setDoc(
    doc(requireDb(), "users", uid, "assetSimulatorMemos", memo.id),
    {
      id: memo.id,
      title: memo.title,
      content: memo.content,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
    },
    { merge: true },
  );
}

export async function deleteAssetSimulatorMemoItem(uid: string, memoId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "assetSimulatorMemos", memoId));
}

// "현재 표시" 메모 id 를 별도 상태 문서에 저장한다. 메모 컬렉션과 분리해서
// (getDocs(assetSimulatorMemos) 결과를 오염시키지 않도록) 관리하며, 기기 간
// 동일한 메모가 열리도록 동기화한다.
//   users/{uid}/assetSimulatorMemoState/current  ->  { currentMemoId, updatedAt }
export async function loadAssetSimulatorMemoCurrentId(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "assetSimulatorMemoState", "current"));
  if (!snap.exists()) return null;
  const data = snap.data() as { currentMemoId?: unknown };
  return typeof data.currentMemoId === "string" && data.currentMemoId ? data.currentMemoId : null;
}

export async function saveAssetSimulatorMemoCurrentId(uid: string, memoId: string): Promise<void> {
  await setDoc(
    doc(requireDb(), "users", uid, "assetSimulatorMemoState", "current"),
    { currentMemoId: memoId, updatedAt: serverTimestamp() },
    { merge: true },
  );
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

// NAV-FAVORITES-CALCULATOR-MENU-UX-1: 상단 nav 즐겨찾기 메뉴.
// 단일 문서 users/{uid}/uiSettings/favorites 에 items 배열로 저장한다.
export type NavFavoriteItem = { id: string; name: string; href: string; order: number };

export async function loadNavFavorites(uid: string): Promise<NavFavoriteItem[] | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "uiSettings", "favorites"));
  if (!snap.exists()) return null;
  const items = (snap.data() as { items?: unknown } | undefined)?.items;
  if (!Array.isArray(items)) return null;
  return items
    .map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : "",
        name: typeof record.name === "string" ? record.name : "",
        href: typeof record.href === "string" ? record.href : "",
        order: typeof record.order === "number" ? record.order : index,
      };
    })
    .filter((item) => item.name.trim().length > 0 && item.href.trim().length > 0);
}

export async function saveNavFavorites(uid: string, items: NavFavoriteItem[]): Promise<void> {
  // sanitizeFirestorePayload 로 undefined 값을 제거해 Firestore 저장 오류를 막는다.
  const payload = sanitizeFirestorePayload({
    items: items.map((item, index) => ({
      id: item.id,
      name: item.name,
      href: item.href,
      order: index,
    })),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(requireDb(), "users", uid, "uiSettings", "favorites"), payload, { merge: true });
}

export async function saveCalendarCacheEntry(uid: string, entry: CalendarCacheEntry): Promise<void> {
  const { ticker: rawTicker, ...rest } = entry;
  const ticker = rawTicker?.trim().toUpperCase();
  const payload: CalendarCacheEntry = {
    ...rest,
    ...(ticker ? { ticker } : {}),
    tickers: rest.tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean),
  };
  console.info("[dividend-calendar:trace] Firestore document save", { path: `users/${uid}/calendarCache/${entry.id}`, document: payload });
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
    entry.source === "mock" || entry.source === "yahoo" || entry.source === "finnhub" || entry.source === "polygon" || entry.source === "partial" || entry.source === "sample" || entry.source === "cache"
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
  const document = snap.exists() ? (snap.data() as unknown as CalendarCacheEntry) : null;
  console.info("[dividend-calendar:trace] Firestore document load", { path: `users/${uid}/calendarCache/${normalizedTicker}`, document });
  return document ? fromCalendarCacheEntry(document) : null;
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

export type UserDisplayProfile = { displayName: string; updatedAt?: unknown };

export function sanitizeFirestorePayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => sanitizeFirestorePayload(item)).filter((item) => item !== undefined) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) continue;
      out[key] = sanitizeFirestorePayload(child);
    }
    return out as T;
  }
  return value;
}

export async function loadUserDisplayProfile(uid: string): Promise<UserDisplayProfile | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "profile", "display"));
  if (!snap.exists()) return null;
  const displayName = typeof snap.data().displayName === "string" ? snap.data().displayName.trim() : "";
  return displayName ? { displayName, updatedAt: snap.data().updatedAt } : null;
}

export async function saveUserDisplayProfile(uid: string, displayName: string): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "profile", "display"), sanitizeFirestorePayload({ displayName: displayName.trim(), updatedAt: serverTimestamp() }), { merge: true });
}

export type CalendarPortfolioRecord = { id: string; name: string; createdAt?: unknown; updatedAt?: unknown };

export async function loadCalendarActivePortfolioId(uid: string): Promise<string> {
  const settings = await loadCalendarSettings(uid);
  return typeof settings?.activePortfolioId === "string" && settings.activePortfolioId.trim() ? settings.activePortfolioId : "default";
}

export async function saveCalendarActivePortfolioId(uid: string, activePortfolioId: string): Promise<void> {
  await saveCalendarSettings(uid, sanitizeFirestorePayload({ activePortfolioId: activePortfolioId || "default" }));
}

export async function loadCalendarPortfolios(uid: string): Promise<CalendarPortfolioRecord[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarPortfolios"));
  return snap.docs.map((item) => item.data() as CalendarPortfolioRecord).filter((item) => Boolean(item.id && item.name));
}

export async function saveCalendarPortfolio(uid: string, portfolio: CalendarPortfolioRecord): Promise<void> {
  const id = portfolio.id || "default";
  await setDoc(doc(requireDb(), "users", uid, "calendarPortfolios", id), sanitizeFirestorePayload({ ...portfolio, id, updatedAt: serverTimestamp(), createdAt: portfolio.createdAt ?? serverTimestamp() }), { merge: true });
}

export async function loadPortfolioManualCalendarTickers(uid: string, portfolioId: string): Promise<ManualCalendarTickerList | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "settings", "tickers"));
  if (!snap.exists()) return null;
  const data = snap.data();
  const candidate = { source: MANUAL_CALENDAR_TICKERS_SOURCE, version: MANUAL_CALENDAR_TICKERS_VERSION, tickers: Array.isArray(data.tickers) ? data.tickers : [] };
  return isValidManualCalendarTickerList(candidate) ? candidate as ManualCalendarTickerList : { source: MANUAL_CALENDAR_TICKERS_SOURCE, version: MANUAL_CALENDAR_TICKERS_VERSION, tickers: [] };
}

export async function savePortfolioManualCalendarTickers(uid: string, portfolioId: string, tickers: string[]): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "settings", "tickers"), sanitizeFirestorePayload({ source: MANUAL_CALENDAR_TICKERS_SOURCE, version: MANUAL_CALENDAR_TICKERS_VERSION, tickers: uniqueCalendarTickers(tickers), updatedAt: serverTimestamp() }), { merge: true });
}

export async function savePortfolioCalendarEventMeta(uid: string, portfolioId: string, eventId: string, meta: CalendarEventMeta): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "calendarEventMetas", eventId), sanitizeFirestorePayload({ ...meta, eventId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function loadPortfolioCalendarEventMetas(uid: string, portfolioId: string): Promise<CalendarEventMeta[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "calendarEventMetas"));
  return snap.docs.map((item) => item.data() as CalendarEventMeta);
}

export async function savePortfolioCalendarCustomEvent(uid: string, portfolioId: string, event: CalendarCustomEvent): Promise<void> {
  const normalized = normalizeCalendarCustomEvent(event);
  if (!normalized) throw new Error("Invalid custom calendar event");
  await setDoc(doc(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "calendarCustomEvents", normalized.id), sanitizeFirestorePayload({ ...normalized, syncedAt: serverTimestamp() }), { merge: true });
}

export async function loadPortfolioCalendarCustomEvents(uid: string, portfolioId: string): Promise<CalendarCustomEvent[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "calendarCustomEvents"));
  return snap.docs.map((item) => normalizeCalendarCustomEvent({ id: item.id, ...item.data() })).filter((event): event is CalendarCustomEvent => Boolean(event));
}

export async function deletePortfolioCalendarCustomEvent(uid: string, portfolioId: string, eventId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "calendarCustomEvents", eventId));
}

export async function savePortfolioCalendarTickerCacheEntry(uid: string, portfolioId: string, entry: CalendarTickerCache<Record<string, unknown>>): Promise<void> {
  const normalizedTicker = normalizeCalendarTicker(entry.ticker);
  const payload = sanitizeFirestorePayload(toCalendarTickerCacheEntry(entry));
  console.info("[dividend-calendar:trace] Firestore document save", { path: `users/${uid}/calendarPortfolios/${portfolioId}/calendarCache/${normalizedTicker}`, document: payload });
  await setDoc(doc(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "calendarCache", normalizedTicker), payload, { merge: true });
}

export async function loadPortfolioCalendarTickerCacheEntry(uid: string, portfolioId: string, ticker: string): Promise<CalendarTickerCache<Record<string, unknown>> | null> {
  const normalizedTicker = normalizeCalendarTicker(ticker);
  if (!normalizedTicker) return null;
  const snap = await getDoc(doc(requireDb(), "users", uid, "calendarPortfolios", portfolioId, "calendarCache", normalizedTicker));
  const document = snap.exists() ? (snap.data() as unknown as CalendarCacheEntry) : null;
  console.info("[dividend-calendar:trace] Firestore document load", { path: `users/${uid}/calendarPortfolios/${portfolioId}/calendarCache/${normalizedTicker}`, document });
  return document ? fromCalendarCacheEntry(document) : null;
}

export async function saveCalendarCloudSavedAt(uid: string, portfolioId: string, savedAt: string): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calendarSettings", `cloudSavedAt_${portfolioId}`), { savedAt, updatedAt: serverTimestamp() });
}

export async function loadCalendarCloudSavedAt(uid: string, portfolioId: string): Promise<string | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "calendarSettings", `cloudSavedAt_${portfolioId}`));
  if (!snap.exists()) return null;
  const data = snap.data();
  return typeof data.savedAt === "string" ? data.savedAt : null;
}
