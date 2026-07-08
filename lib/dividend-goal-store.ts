"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storage-keys";

// 배당 목표 설정(목표 티커·목표 주수)의 단일 공유 소스.
// 배당현황 페이지의 "배당 목표 설정" 입력과 투자현황 카드의 "(목표 …주)" 표시가
// 이 store 하나만 읽고/쓰도록 하여, 한쪽에서 목표를 바꾸면 다른 쪽도 자동으로 같은
// 값을 쓰게 한다(중복 상태·중복 저장값 없음). localStorage 로 새로고침/탭 간에도 유지된다.

const STORAGE_KEY = STORAGE_KEYS.dividendGoal;

export type DividendGoal = { ticker: string; qty: number };

export const DEFAULT_DIVIDEND_GOAL: DividendGoal = { ticker: "SCHD", qty: 3300 };

let cache: DividendGoal | null = null;
const listeners = new Set<() => void>();

function sanitize(value: unknown): DividendGoal {
  if (value && typeof value === "object") {
    const raw = value as Partial<DividendGoal>;
    const ticker = typeof raw.ticker === "string" && raw.ticker.trim() ? raw.ticker.trim().toUpperCase() : DEFAULT_DIVIDEND_GOAL.ticker;
    const qty = Number.isFinite(raw.qty) ? Math.max(0, Math.round(raw.qty as number)) : DEFAULT_DIVIDEND_GOAL.qty;
    return { ticker, qty };
  }
  return { ...DEFAULT_DIVIDEND_GOAL };
}

function read(): DividendGoal {
  if (typeof window === "undefined") return { ...DEFAULT_DIVIDEND_GOAL };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_DIVIDEND_GOAL };
    return sanitize(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_DIVIDEND_GOAL };
  }
}

function getSnapshot(): DividendGoal {
  if (cache) return cache;
  cache = read();
  return cache;
}

function getServerSnapshot(): DividendGoal {
  return DEFAULT_DIVIDEND_GOAL;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    // 다른 탭에서의 변경(native storage 이벤트)도 반영한다.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) {
        cache = read();
        listeners.forEach((l) => l());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => listeners.delete(cb);
}

// 목표 설정 갱신. 같은 탭의 모든 구독자에게 즉시 반영되고 localStorage 에 저장된다.
export function setDividendGoal(patch: Partial<DividendGoal>): void {
  const next = sanitize({ ...getSnapshot(), ...patch });
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage 사용 불가 환경 방어(메모리 캐시로만 동작).
    }
  }
  listeners.forEach((l) => l());
}

// 배당 목표 설정을 구독하는 hook(배당현황·투자현황 공유).
export function useDividendGoal(): DividendGoal {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
