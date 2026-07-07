import { STORAGE_KEYS } from "@/lib/storage-keys";

// =============================================================
// 자산 시뮬레이터 "메모 관리" 모델.
//
// 기존에는 단일 메모(문자열 하나)만 저장했으나, 이제 여러 개의 메모를
// 제목/내용/작성일/수정일과 함께 관리한다. 로컬(localStorage)과 클라우드
// (Firestore) 모두 동일한 AssetMemo 형태로 다룬다.
//
// createdAt/updatedAt 은 표시·정렬·병합(더 최신 것 우선)을 단순화하기 위해
// 클라이언트 epoch(ms) 숫자로 저장한다. 로컬/클라우드 간 형식이 동일하므로
// 기기 간 병합이 결정적으로 동작한다.
// =============================================================

export type AssetMemo = {
  id: string;
  title: string;
  content: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

export const MEMO_MAX_CONTENT_LENGTH = 5000;
export const MEMO_MAX_TITLE_LENGTH = 120;
export const MEMO_AUTO_TITLE_LENGTH = 28;

const NEW_STORAGE_KEY = STORAGE_KEYS.assetSimulatorMemos;
const LEGACY_STORAGE_KEY = STORAGE_KEYS.assetSimulatorMemo;
const CURRENT_ID_KEY = STORAGE_KEYS.assetSimulatorMemoCurrent;

// crypto.randomUUID 우선, 없으면 deterministic fallback 으로 id 생성.
export function createMemoId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `memo-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `memo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 제목 미입력 시 내용 앞부분(첫 줄 기준 ~28자)을 제목으로 자동 생성한다.
export function deriveMemoTitle(content: string, explicitTitle?: string): string {
  const t = (explicitTitle ?? "").trim();
  if (t) return t.slice(0, MEMO_MAX_TITLE_LENGTH);

  // 줄바꿈/여분 공백을 하나로 접어 미리보기용 제목을 만든다.
  const flattened = content.replace(/\s+/g, " ").trim();
  if (!flattened) return "제목 없음";
  if (flattened.length <= MEMO_AUTO_TITLE_LENGTH) return flattened;
  return `${flattened.slice(0, MEMO_AUTO_TITLE_LENGTH).trimEnd()}…`;
}

export function createNewMemo(): AssetMemo {
  const now = Date.now();
  return { id: createMemoId(), title: "", content: "", createdAt: now, updatedAt: now };
}

// 알 수 없는 값(로컬/클라우드 원본)을 안전한 AssetMemo 로 정규화한다.
export function normalizeAssetMemo(value: unknown): AssetMemo | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const content = typeof raw.content === "string" ? raw.content : "";
  const id = typeof raw.id === "string" && raw.id ? raw.id : createMemoId();
  const title = typeof raw.title === "string" ? raw.title : "";
  const createdAt = toEpochMs(raw.createdAt) ?? Date.now();
  const updatedAt = toEpochMs(raw.updatedAt) ?? createdAt;
  return {
    id,
    title: title.slice(0, MEMO_MAX_TITLE_LENGTH),
    content: content.slice(0, MEMO_MAX_CONTENT_LENGTH),
    createdAt,
    updatedAt,
  };
}

// Firestore Timestamp({seconds}) / number / ISO 문자열 등 다양한 형태를 epoch(ms)로.
function toEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === "object") {
    const raw = value as Record<string, unknown>;
    if (typeof raw.seconds === "number") return raw.seconds * 1000;
    // Firestore Timestamp 인스턴스(toMillis)
    const toMillis = (raw as { toMillis?: unknown }).toMillis;
    if (typeof toMillis === "function") {
      try {
        const ms = (toMillis as () => number).call(value);
        if (typeof ms === "number" && Number.isFinite(ms)) return ms;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

// 최신 작성순(작성일 내림차순). 동일 작성일이면 수정일로 보정.
export function sortMemosByRecent(memos: AssetMemo[]): AssetMemo[] {
  return [...memos].sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt);
}

// 제목 + 내용 전체를 대상으로 대소문자 무관 포함 단어 검색.
export function searchMemos(memos: AssetMemo[], queryText: string): AssetMemo[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return memos;
  return memos.filter(
    (memo) => memo.title.toLowerCase().includes(q) || memo.content.toLowerCase().includes(q),
  );
}

// id 기준 합집합. 충돌 시 updatedAt 이 더 큰(최신) 메모를 채택한다.
export function mergeMemos(base: AssetMemo[], incoming: AssetMemo[]): AssetMemo[] {
  const byId = new Map<string, AssetMemo>();
  for (const memo of base) byId.set(memo.id, memo);
  for (const memo of incoming) {
    const existing = byId.get(memo.id);
    if (!existing || memo.updatedAt >= existing.updatedAt) byId.set(memo.id, memo);
  }
  return sortMemosByRecent(Array.from(byId.values()));
}

// ---------------------------------------------------------------
// 로컬 저장소 (localStorage)
// ---------------------------------------------------------------

export function readLocalMemos(): AssetMemo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEW_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return sortMemosByRecent(
          parsed.map((item) => normalizeAssetMemo(item)).filter((m): m is AssetMemo => m !== null),
        );
      }
    }
  } catch {
    // 파싱 실패 시 아래 레거시 마이그레이션으로 폴백.
  }
  // 신규 목록이 없으면 기존 단일 메모(레거시)를 안전하게 마이그레이션.
  const migrated = migrateLegacyLocalMemo();
  return migrated;
}

export function writeLocalMemos(memos: AssetMemo[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(memos));
  } catch {
    // 저장소 사용 불가 환경 방어(클라우드 저장은 별도 진행).
  }
}

// "현재 표시" 메모 id 로컬 캐시. 새로고침 후에도 같은 메모가 열리도록 한다.
export function readLocalCurrentMemoId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem(CURRENT_ID_KEY);
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

export function writeLocalCurrentMemoId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(CURRENT_ID_KEY, id);
    else window.localStorage.removeItem(CURRENT_ID_KEY);
  } catch {
    // ignore
  }
}

// 기존 단일 메모(localStorage 문자열)를 신규 목록으로 1회 변환한다.
// 원본 레거시 키는 손실 방지를 위해 삭제하지 않는다.
export function migrateLegacyLocalMemo(): AssetMemo[] {
  if (typeof window === "undefined") return [];
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && legacy.trim()) {
      const memo = memoFromLegacyText(legacy);
      writeLocalMemos([memo]);
      return [memo];
    }
  } catch {
    // ignore
  }
  return [];
}

// 레거시 단일 메모 텍스트 → AssetMemo. 제목은 내용 앞부분으로 자동 생성.
export function memoFromLegacyText(text: string): AssetMemo {
  const now = Date.now();
  return {
    id: createMemoId(),
    title: deriveMemoTitle(text),
    content: text.slice(0, MEMO_MAX_CONTENT_LENGTH),
    createdAt: now,
    updatedAt: now,
  };
}
