// =============================================================
// 포트폴리오 공통 store (localStorage 기반).
// 포트폴리오 관리에서 등록한 스냅샷/보유종목을 저장하고,
// 배당 / 워치리스트 / 시장현황 / 전체 종목 / QLD 대시보드 화면이 함께 읽는다.
//
// - 백엔드 없음. 우선 localStorage 로만 동작.
// - SSR 안전: typeof window 가드.
// - React 구독: useSyncExternalStore 로 변경을 반영.
// TODO(codex): Firebase/Supabase 등 백엔드 저장 연결 시 read/write 만 교체.
// =============================================================
import { useSyncExternalStore } from "react";
import type {
  Holding,
  PortfolioSnapshot,
  PortfolioSummary,
  SnapshotHistoryRow,
} from "./portfolio-types";
import { filterAggregateHoldings } from "./portfolio-summary-row";

const STORAGE_KEY = "qld2.portfolio.snapshots.v1";

let cache: PortfolioSnapshot[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: PortfolioSnapshot[] = [];

function recalcInvestment(holdings: Holding[]): Pick<
  PortfolioSnapshot,
  "investmentPrincipalKRW" | "investmentValueKRW" | "returnAmountKRW" | "returnPct"
> {
  const investmentPrincipalKRW = holdings.reduce((sum, holding) => sum + holding.principalKRW, 0);
  const investmentValueKRW = holdings.reduce((sum, holding) => sum + holding.valueKRW, 0);
  const returnAmountKRW = investmentValueKRW - investmentPrincipalKRW;
  const returnPct =
    investmentPrincipalKRW > 0 ? (returnAmountKRW / investmentPrincipalKRW) * 100 : 0;

  return {
    investmentPrincipalKRW,
    investmentValueKRW,
    returnAmountKRW,
    returnPct,
  };
}

function sanitizeSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  const holdings = filterAggregateHoldings(snapshot.holdings ?? []);
  if (holdings.length === (snapshot.holdings ?? []).length) return snapshot;

  return {
    ...snapshot,
    ...recalcInvestment(holdings),
    holdings,
  };
}

function sanitizeSnapshots(snapshots: PortfolioSnapshot[]): PortfolioSnapshot[] {
  return snapshots.map(sanitizeSnapshot);
}

function read(): PortfolioSnapshot[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? sanitizeSnapshots(parsed as PortfolioSnapshot[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: PortfolioSnapshot[]): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage 사용 불가 환경 방어
    }
  }
  listeners.forEach((l) => l());
}

// ---- 구독 (React useSyncExternalStore 용) ----
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 내부 캐시의 안정적인 참조를 반환 (write 전까지 동일 참조). */
function getServerSnapshot(): PortfolioSnapshot[] {
  return EMPTY;
}

function getRawSnapshot(): PortfolioSnapshot[] {
  return read();
}

// ---- 기본 selector (어디서나 호출 가능) ----

/** 날짜 오름차순으로 정렬된 스냅샷 목록 (새 배열). */
export function getSnapshots(): PortfolioSnapshot[] {
  return [...read()].sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));
}

/** 같은 snapshotDate 가 이미 있는지 (덮어쓰기 확인용). */
export function hasSnapshotDate(date: string): boolean {
  return read().some((s) => s.snapshotDate === date);
}

/** 스냅샷 저장. 같은 snapshotDate 는 덮어쓴다. */
export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  const cleanSnapshot = sanitizeSnapshot(snapshot);
  const rest = read().filter((s) => s.snapshotDate !== cleanSnapshot.snapshotDate);
  write([...rest, cleanSnapshot]);
}

/** 스냅샷 삭제. */
export function deleteSnapshot(id: string): void {
  write(read().filter((s) => s.id !== id));
}

/** 전체 삭제. */
export function clearSnapshots(): void {
  write([]);
}

/** 가장 최신 snapshotDate 의 스냅샷. */
export function getLatestSnapshot(): PortfolioSnapshot | null {
  return latestOf(read());
}

/** 현재(최신 스냅샷) 보유종목. */
export function getCurrentHoldings(): Holding[] {
  return filterAggregateHoldings(getLatestSnapshot()?.holdings ?? []);
}

/** 특정 ticker 의 보유종목 (대소문자 무시). */
export function getHoldingsByTicker(ticker: string): Holding[] {
  const t = (ticker || "").toUpperCase();
  return getCurrentHoldings().filter((h) => (h.ticker || "").toUpperCase() === t);
}

/** 최신 스냅샷 요약. */
export function getPortfolioSummary(): PortfolioSummary {
  return summaryOf(getLatestSnapshot());
}

/** 스냅샷 히스토리 (날짜 오름차순). */
export function getSnapshotHistory(): SnapshotHistoryRow[] {
  return getSnapshots().map((s) => ({
    id: s.id,
    snapshotDate: s.snapshotDate,
    totalAssetKRW: s.totalAssetKRW,
    investmentValueKRW: s.investmentValueKRW,
    investmentPrincipalKRW: s.investmentPrincipalKRW,
    returnPct: s.returnPct,
  }));
}

// ---- 순수 헬퍼 (배열을 인자로) ----
export function latestOf(snaps: PortfolioSnapshot[]): PortfolioSnapshot | null {
  if (!snaps.length) return null;
  return snaps.reduce((a, b) => (a.snapshotDate >= b.snapshotDate ? a : b));
}

export function summaryOf(snap: PortfolioSnapshot | null): PortfolioSummary {
  if (!snap) {
    return {
      snapshotDate: null,
      totalAssetKRW: 0,
      totalDebtKRW: 0,
      netAssetKRW: 0,
      investmentPrincipalKRW: 0,
      investmentValueKRW: 0,
      returnAmountKRW: 0,
      returnPct: 0,
      holdingCount: 0,
    };
  }
  const holdings = filterAggregateHoldings(snap.holdings ?? []);
  const investment = recalcInvestment(holdings);

  return {
    snapshotDate: snap.snapshotDate,
    totalAssetKRW: snap.totalAssetKRW,
    totalDebtKRW: snap.totalDebtKRW,
    netAssetKRW: snap.netAssetKRW,
    investmentPrincipalKRW: investment.investmentPrincipalKRW,
    investmentValueKRW: investment.investmentValueKRW,
    returnAmountKRW: investment.returnAmountKRW,
    returnPct: investment.returnPct,
    holdingCount: holdings.length,
  };
}

// ---- React hooks ----

/** 스냅샷 목록을 구독하는 hook (안정적인 참조 반환). */
export function usePortfolioSnapshots(): PortfolioSnapshot[] {
  return useSyncExternalStore(subscribe, getRawSnapshot, getServerSnapshot);
}
