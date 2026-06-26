// =============================================================
// NAV-FAVORITES-CALCULATOR-MENU-UX-1
// 상단 nav 즐겨찾기 메뉴의 데이터 모델 · 검증 · 로컬 저장 유틸.
// Firestore 동기화는 lib/firebase/firestore-repositories.ts 의
// loadNavFavorites / saveNavFavorites 와 함께 동작한다.
// =============================================================

import { STORAGE_KEYS } from "@/lib/storage-keys";

export type FavoriteItem = {
  id: string;
  name: string;
  href: string;
  order: number;
};

// 첫 사용자에게 제공하는 기본 즐겨찾기. 모두 실제 존재하는 내부 route 만 사용한다
// (NAV_ITEMS 기준: /portfolio, /calendar, /market, /calculator).
export const DEFAULT_FAVORITES: FavoriteItem[] = [
  { id: "fav-portfolio", name: "투자현황", href: "/portfolio", order: 0 },
  { id: "fav-calendar", name: "캘린더", href: "/calendar", order: 1 },
  { id: "fav-market", name: "시장 현황", href: "/market", order: 2 },
  { id: "fav-mdd", name: "티커MDD 계산기", href: "/calculator?tab=mdd", order: 3 },
];

// crypto.randomUUID 우선, 없으면 deterministic fallback 으로 id 생성.
export function createFavoriteId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `fav-${crypto.randomUUID()}`;
    }
  } catch {
    /* ignore and fall through to the deterministic fallback */
  }
  return `fav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// javascript:/data:/vbscript: 같은 위험 URL 을 차단한다.
// 내부 상대경로(/...) 또는 http(s) 절대 URL 만 허용.
export function isSafeFavoriteHref(href: string): boolean {
  const trimmed = (href ?? "").trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return false;
  }
  if (trimmed.startsWith("/")) return true;
  return lower.startsWith("http://") || lower.startsWith("https://");
}

export function isInternalFavoriteHref(href: string): boolean {
  return (href ?? "").trim().startsWith("/");
}

// 이름/주소 trim, 빈 항목·위험 URL 제거, id 보강, order 를 배열 순서로 재부여.
export function sanitizeFavoriteItems(items: Array<Partial<FavoriteItem>>): FavoriteItem[] {
  return items
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      name: typeof item.name === "string" ? item.name.trim() : "",
      href: typeof item.href === "string" ? item.href.trim() : "",
    }))
    .filter((item) => item.name.length > 0 && isSafeFavoriteHref(item.href))
    .map((item, index) => ({
      id: item.id || createFavoriteId(),
      name: item.name,
      href: item.href,
      order: index,
    }));
}

// 외부에서 들어온 raw 배열을 안전한 FavoriteItem[] 으로 정규화.
export function normalizeFavoriteItems(raw: unknown): FavoriteItem[] {
  if (!Array.isArray(raw)) return [];
  return sanitizeFavoriteItems(raw as Array<Partial<FavoriteItem>>);
}

export function loadLocalFavorites(): FavoriteItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.navFavorites);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    const normalized = normalizeFavoriteItems(items);
    return normalized.length > 0 ? normalized : [];
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.navFavorites);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function saveLocalFavorites(items: FavoriteItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.navFavorites,
      JSON.stringify({ items: sanitizeFavoriteItems(items), updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* private mode 등에서 저장 실패는 무시한다 */
  }
}
