"use client";

// =============================================================
// 스냅샷 숨김(hidden) store — localStorage 기반 + Firestore 동기화 미러.
//
// 왜 필요한가:
//   "등록된 스냅샷 히스토리"의 관리 컬럼에 "숨기기" 기능이 추가되었다. 숨김은
//   삭제와 달리 원본 데이터를 보존하되 기본 조회에서만 제외한다. 숨김 상태는
//   Firestore(users/{uid}/portfolioSnapshotState/state.hiddenDates)에 영구 저장되어
//   같은 Google 계정으로 다른 브라우저/기기에서 접속해도 동일하게 유지된다.
//
//   이 store 는 그 숨김 상태의 "로컬 미러"로, 즉각적인 UI 반영(useSyncExternalStore)과
//   로그아웃/오프라인 시의 동작을 담당한다. 로그인 시 hydrateHiddenSnapshotDates 로
//   Firestore 상태를 합쳐 모든 기기에서 일관되게 만든다.
//
// - 키 기준: snapshotDate(YYYY-MM-DD). 삭제 묘비/병합 로직과 동일 단위.
// - SSR 안전: typeof window 가드.
// - React 구독: useSyncExternalStore.
// 구조는 portfolio-snapshot-deletions.ts 와 동일하다(삭제 묘비의 숨김 버전).
// =============================================================

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storage-keys";

const STORAGE_KEY = STORAGE_KEYS.hiddenPortfolioSnapshotDates;

let cache: ReadonlySet<string> | null = null;
const EMPTY: ReadonlySet<string> = new Set<string>();
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = new Set<string>();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = new Set<string>(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    cache = new Set<string>();
  }
  return cache;
}

function write(next: Set<string>): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // localStorage 사용 불가 환경 방어
    }
  }
  listeners.forEach((l) => l());
}

// ---- 비-React 접근자 ----

/** 해당 snapshotDate 가 숨김 처리되어 있는지. */
export function isSnapshotDateHidden(snapshotDate: string | null | undefined): boolean {
  if (!snapshotDate) return false;
  return read().has(snapshotDate);
}

/** 현재 숨김 날짜 집합(읽기 전용 사본). */
export function getHiddenSnapshotDates(): ReadonlySet<string> {
  return read();
}

/** snapshotDate 를 숨김 처리한다(이미 있으면 무시). */
export function markSnapshotDateHidden(snapshotDate: string | null | undefined): void {
  if (!snapshotDate) return;
  const current = read();
  if (current.has(snapshotDate)) return;
  const next = new Set(current);
  next.add(snapshotDate);
  write(next);
}

/** snapshotDate 의 숨김을 해제한다(재등록/숨김 해제 시). */
export function unmarkSnapshotDateHidden(snapshotDate: string | null | undefined): void {
  if (!snapshotDate) return;
  const current = read();
  if (!current.has(snapshotDate)) return;
  const next = new Set(current);
  next.delete(snapshotDate);
  write(next);
}

/**
 * Firestore 에서 읽은 숨김 날짜들을 로컬 캐시에 합친다(union 병합).
 * 로컬 전용(아직 클라우드 미반영) 항목을 지우지 않도록 합집합으로 병합하며,
 * 실제로 추가된 항목이 있을 때만 write 해 불필요한 재렌더를 막는다.
 */
export function hydrateHiddenSnapshotDates(dates: Iterable<string>): void {
  const current = read();
  const next = new Set(current);
  for (const date of Array.from(dates)) {
    if (typeof date === "string" && date) next.add(date);
  }
  if (next.size === current.size) return;
  write(next);
}

// ---- React 구독 ----

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

/** 숨김 날짜 집합을 구독하는 hook. 병합 목록에서 숨김 날짜를 걸러낼 때 사용한다. */
export function useHiddenSnapshotDates(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, getServerSnapshot);
}
