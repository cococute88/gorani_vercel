// =============================================================
// 포트폴리오 "최근 클라우드 동기화 시각" store (localStorage 기반).
//
// Firestore 저장/삭제/동기화가 실제로 성공한 시점의 timestamp(ms)를 기록하고,
// 포트폴리오 관리 화면 우측 상단에서 "최근 클라우드 동기화 시각"으로 표시한다.
//
// - Firestore metadata read-back 이후 즉시 렌더링을 깨우는 보조 cache다.
// - 표시 SSOT는 components/portfolio/PortfolioCloudSyncStatus.tsx 의 metadata.lastSyncedAt 이다.
// - SSR 안전: typeof window 가드.
// - React 구독: useSyncExternalStore (portfolio-store 와 동일 패턴).
//
// 기존 저장 로직(savePortfolioSnapshot 등)은 변경하지 않고, "성공 시점"에만
// markPortfolioCloudSyncNow() 를 호출해 시각을 갱신한다.
// =============================================================
import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storage-keys";

const STORAGE_KEY = STORAGE_KEYS.portfolioCloudSyncTime;

let cache: number | null = null;
let cacheLoaded = false;
const listeners = new Set<() => void>();

function read(): number | null {
  if (typeof window === "undefined") return null;
  if (cacheLoaded) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    cache = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    cache = null;
  }
  cacheLoaded = true;
  return cache;
}

/** Firestore 저장/삭제/동기화가 성공한 "지금" 시각을 마지막 동기화 시각으로 기록한다. */
export function markPortfolioCloudSyncNow(timestamp: number = Date.now()): void {
  cache = timestamp;
  cacheLoaded = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(timestamp));
    } catch {
      // localStorage 사용 불가 환경 방어
    }
  }
  listeners.forEach((listener) => listener());
}

export function getPortfolioCloudSyncTime(): number | null {
  return read();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getServerSnapshot(): number | null {
  return null;
}

/** 마지막 클라우드 동기화 시각(ms)을 구독하는 hook. 이력이 없으면 null. */
export function usePortfolioCloudSyncTime(): number | null {
  return useSyncExternalStore(subscribe, read, getServerSnapshot);
}

// 한국(Asia/Seoul) 기준 "YYYY.MM.DD HH:mm" 포맷. 예: 2026.06.19 14:12
export function formatPortfolioCloudSyncTime(timestamp: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  // hour12:false 환경에 따라 자정이 "24"로 나오는 경우를 "00"으로 보정한다.
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}.${pick("month")}.${pick("day")} ${hour}:${pick("minute")}`;
}
