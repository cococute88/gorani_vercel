"use client";

// =============================================================
// 스냅샷 삭제 묘비(tombstone) store — localStorage 기반.
//
// 왜 필요한가:
//   "등록된 스냅샷 히스토리"는 여러 소스를 하나의 목록(mergedSnapshots)으로 합쳐 보여준다.
//     1) localStorage portfolio-store          (사용자가 등록한 스냅샷)
//     2) /api/portfolio/latest-snapshot 오버레이 (top-level `portfolio_snapshots`,
//                                                bs-report-auto 파이프라인이 쓰는 읽기 전용 컬렉션)
//     3) Firestore 계약 어댑터(users/{uid}/portfolioContract, 읽기 전용)
//
//   (1)은 클라이언트가 직접 지울 수 있지만, (2)/(3)은 읽기 전용이라 클라이언트가
//   문서를 삭제할 수 없다. 따라서 그 행을 화면에서 지워도 새로고침/재진입 시 다시
//   불려와 "삭제가 유지되지 않는" 문제가 생긴다.
//
//   이 묘비 store 는 "사용자가 삭제한 snapshotDate" 집합을 localStorage 에 영구
//   기록해, 다시 불려온 동일 날짜의 스냅샷을 게시/병합 단계에서 걸러낸다. 이로써
//   소스에 관계없이 삭제 상태가 새로고침 후에도 일관되게 유지된다.
//
//   동일 날짜를 다시 등록하면(handleRegister) 묘비를 해제해 정상적으로 다시 보이게 한다.
//
// - 키 기준: snapshotDate(YYYY-MM-DD). 오버레이 스냅샷의 문서 ID 가 곧 날짜이고,
//   localStorage/병합 로직도 날짜로 중복 제거하므로 날짜 단위가 가장 견고하다.
// - SSR 안전: typeof window 가드.
// - React 구독: useSyncExternalStore.
// =============================================================

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storage-keys";

const STORAGE_KEY = STORAGE_KEYS.deletedPortfolioSnapshotDates;

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

// ---- 비-React 접근자 (어디서나 호출 가능) ----

/** 해당 snapshotDate 가 삭제 묘비에 등록되어 있는지. */
export function isSnapshotDateDeleted(snapshotDate: string | null | undefined): boolean {
  if (!snapshotDate) return false;
  return read().has(snapshotDate);
}

/** 현재 삭제된 날짜 집합(읽기 전용 사본). */
export function getDeletedSnapshotDates(): ReadonlySet<string> {
  return read();
}

/** snapshotDate 를 삭제 묘비에 추가한다(이미 있으면 무시). */
export function markSnapshotDateDeleted(snapshotDate: string | null | undefined): void {
  if (!snapshotDate) return;
  const current = read();
  if (current.has(snapshotDate)) return;
  const next = new Set(current);
  next.add(snapshotDate);
  write(next);
}

/** snapshotDate 를 삭제 묘비에서 제거한다(재등록 시 사용). */
export function unmarkSnapshotDateDeleted(snapshotDate: string | null | undefined): void {
  if (!snapshotDate) return;
  const current = read();
  if (!current.has(snapshotDate)) return;
  const next = new Set(current);
  next.delete(snapshotDate);
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

/** 삭제된 날짜 집합을 구독하는 hook. 병합 목록에서 묘비 날짜를 걸러낼 때 사용한다. */
export function useDeletedSnapshotDates(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, getServerSnapshot);
}
