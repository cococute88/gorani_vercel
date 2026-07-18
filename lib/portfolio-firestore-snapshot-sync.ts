"use client";

// =============================================================
// Client data-supply hook: make the LATEST Firestore portfolio snapshot the
// SINGLE data source for the 자산관리(Portfolio) screen on first page entry.
//
//   /api/portfolio/latest-snapshot  ->  this hook  ->  Firestore snapshot store
//                                                       (usePortfolioView reads here)
//
// Why a dedicated store (and not the localStorage portfolio-store):
//   The localStorage-backed `portfolio-store` can hold legacy localStorage data
//   AND report_input-derived data at the same time. Merging the Firestore
//   snapshot into it (the previous behaviour) meant Firestore + localStorage +
//   report_input data could all coexist on the Portfolio screen.
//
//   To guarantee a single source of truth we keep the Firestore snapshot in its
//   OWN store and have `usePortfolioView` read from it. The localStorage store
//   is left completely untouched, so:
//     - When Firestore succeeds, the Portfolio screen renders ONLY the Firestore
//       snapshot — localStorage is not read and not written (requirement: no
//       merge; "Firestore 성공 시 localStorage 미사용").
//     - When Firestore fails/has no document, this store stays null and
//       `usePortfolioView` falls back to the existing localStorage data.
//
// Non-destructive: because we never call replaceSnapshots/mergePortfolioSnapshots
// here, the localStorage history used by other views (performance / MDD) and by
// the Portfolio manager is preserved exactly as before.
//
// Fallback behaviour:
//   - source "firestore" : publish the snapshot as the single source.
//   - source "empty"     : no Firestore document -> clear store -> legacy data.
//   - source "error"     : Firestore/config failure -> clear store -> legacy data.
//   The fetch itself is wrapped so a network/parse failure also degrades to the
//   legacy data; the page never breaks.
// =============================================================

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PortfolioSnapshot } from "./portfolio-types";
import { isSnapshotDateDeleted, unmarkSnapshotDateDeleted } from "./portfolio-snapshot-deletions";
import { firebaseAuth } from "./firebase/client";
import { recordPortfolioCloudSyncSuccess, removeDeletedSnapshotDateFromCloud } from "./firebase/firestore-repositories";
import { markPortfolioCloudSyncNow } from "./portfolio-cloud-sync-time";
import { getSnapshots } from "./portfolio-store";
import { mergePortfolioSnapshotMetadata } from "./portfolio-snapshot-metadata";

const ENDPOINT = "/api/portfolio/latest-snapshot";

export type FirestoreSnapshotSyncStatus =
  | "idle"
  | "loading"
  | "applied" // a Firestore snapshot is the active single source
  | "empty" // no Firestore snapshot yet -> legacy data used as fallback
  | "fallback"; // Firestore/fetch error -> legacy data used as fallback

export interface FirestoreSnapshotSyncState {
  status: FirestoreSnapshotSyncStatus;
  snapshotDate: string | null;
}

type LatestSnapshotResponse =
  | { source: "firestore"; snapshotDate: string; snapshot: PortfolioSnapshot }
  | { source: "empty"; snapshot: null }
  | { source: "error"; snapshot: null; code?: string };

// -------------------------------------------------------------
// Dedicated Firestore-snapshot store (separate from the localStorage store).
// Holds the single authoritative snapshot once Firestore resolves successfully.
// `null` means "no Firestore snapshot active" -> consumers fall back to the
// legacy localStorage store.
// -------------------------------------------------------------
let firestoreSnapshot: PortfolioSnapshot | null = null;
// Date of the snapshot currently published in this store. Tracked separately so
// (a) the manual "최신화" refresh can detect an unchanged snapshot WITHOUT
// touching the store (requirement: no needless re-render on the same snapshot),
// and (b) the "최근 동기화" label can read the active Firestore date directly.
let firestoreSnapshotDate: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Publish a Firestore snapshot together with its date as the single source (or
 * clear it with `(null, null)`). Returns `true` only when the store actually
 * changed, so callers can distinguish an applied-new snapshot from an unchanged
 * one and avoid emitting a needless re-render.
 */
function setFirestoreSnapshot(
  snapshot: PortfolioSnapshot | null,
  snapshotDate: string | null,
): boolean {
  if (firestoreSnapshot === snapshot && firestoreSnapshotDate === snapshotDate) {
    return false;
  }
  firestoreSnapshot = snapshot;
  firestoreSnapshotDate = snapshotDate;
  emit();
  return true;
}

/**
 * 활성 Firestore 오버레이 스냅샷이 삭제 대상과 일치하면 store 를 비운다(`null`).
 *
 * 히스토리의 휴지통은 localStorage 스냅샷만 지우던 기존 handleDeleteSnapshot 으로는
 * 이 전용 store 에 들어 있는 오버레이(최신/단일 소스) 스냅샷을 절대 제거하지 못해
 * "클릭해도 아무 일도 일어나지 않는" 증상을 만들었다. 이 함수가 store 를 비우면
 * 구독 중인 모든 컴포넌트가 useSyncExternalStore 로 즉시 재렌더되어, 새로고침 없이
 * 해당 행이 사라지고 상단 카드(총자산/보유종목)는 localStorage 로 폴백한다.
 *
 * id(오버레이는 id === snapshotDate) 또는 snapshotDate 중 하나라도 일치하면 비운다.
 * 실제로 store 가 바뀐 경우에만 `true` 를 반환한다.
 */
export function removeActiveFirestoreSnapshot(target: {
  id?: string | null;
  snapshotDate?: string | null;
}): boolean {
  if (firestoreSnapshot === null) return false;
  const matchesId = target.id != null && firestoreSnapshot.id === target.id;
  const matchesDate =
    target.snapshotDate != null && firestoreSnapshotDate === target.snapshotDate;
  if (!matchesId && !matchesDate) return false;
  return setFirestoreSnapshot(null, null);
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getFirestoreSnapshotRef(): PortfolioSnapshot | null {
  return firestoreSnapshot;
}

// SSR: never resolve a Firestore snapshot on the server; always start as null.
function getFirestoreSnapshotServer(): PortfolioSnapshot | null {
  return null;
}

function getFirestoreSnapshotDateRef(): string | null {
  return firestoreSnapshotDate;
}

/**
 * Subscribe to the active Firestore snapshot. Returns the snapshot when
 * Firestore resolved successfully, or `null` while loading / on empty / on
 * error — in which case the Portfolio view falls back to localStorage data.
 */
export function usePortfolioFirestoreSnapshotData(): PortfolioSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    getFirestoreSnapshotRef,
    getFirestoreSnapshotServer,
  );
}

/** Non-hook accessor (mirrors the localStorage store's getSnapshots()). */
export function getFirestoreSnapshot(): PortfolioSnapshot | null {
  return firestoreSnapshot;
}

/**
 * Subscribe to the date of the snapshot currently driving the Portfolio screen.
 * Returns the active Firestore `snapshotDate` (e.g. "2026-06-19") or `null` when
 * no Firestore snapshot is active (loading / empty / fallback to localStorage).
 * Used by the "최근 동기화" label.
 */
export function usePortfolioFirestoreSnapshotDate(): string | null {
  return useSyncExternalStore(
    subscribe,
    getFirestoreSnapshotDateRef,
    () => null,
  );
}

// On-mount fetch concurrency guard. We deliberately do NOT use a permanent
// "attempted-once" latch: if an earlier mount resolved to empty/error (e.g. the
// snapshot did not exist yet, or the very first page the user opened ran before
// the document was created) the store stays null, and a LATER mount — including
// navigating to the Portfolio manager — MUST be allowed to re-read so a snapshot
// that now exists becomes the active source. This flag only prevents two reads
// from overlapping at the same instant.
let onMountFetchInFlight = false;

// -------------------------------------------------------------
// Shared fetch core. Reads /api/portfolio/latest-snapshot once and normalises
// the discriminated response into a simple result. NEVER throws — a network /
// parse failure degrades to `{ kind: "error" }` so callers can decide how to
// react (the page never breaks).
// -------------------------------------------------------------
type FetchedSnapshot =
  | { kind: "firestore"; snapshotDate: string; snapshot: PortfolioSnapshot }
  | { kind: "empty" }
  | { kind: "error" };

async function fetchLatestSnapshot(options: { respectDeletedTombstone?: boolean } = {}): Promise<FetchedSnapshot> {
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (!res.ok) return { kind: "error" };

    const body = (await res.json()) as LatestSnapshotResponse;
    if (body.source === "firestore" && body.snapshot) {
      // 삭제 묘비 적용: 사용자가 히스토리에서 지운 날짜라면, 읽기 전용 파이프라인
      // 컬렉션(`portfolio_snapshots`)에서 같은 스냅샷이 다시 내려와도 게시하지 않는다.
      // 이렇게 해야 새로고침/재진입 후에도 삭제 상태가 유지된다(읽기 전용이라 원본
      // 문서를 클라이언트가 지울 수 없으므로 게시 단계에서 차단). store 는 null 로
      // 남아 화면은 localStorage 데이터로 폴백한다 — "empty" 와 동일하게 처리.
      if (options.respectDeletedTombstone !== false && isSnapshotDateDeleted(body.snapshotDate)) {
        if (process.env.NODE_ENV !== "production") {
          console.info("[Portfolio Sync] snapshot reload skipped by deleted tombstone", {
            snapshotDate: body.snapshotDate,
          });
        }
        return { kind: "empty" };
      }
      return {
        kind: "firestore",
        snapshotDate: body.snapshotDate,
        snapshot: mergePortfolioSnapshotMetadata(
          body.snapshot,
          [firestoreSnapshot, ...getSnapshots()].filter((snapshot): snapshot is PortfolioSnapshot => snapshot !== null),
        ),
      };
    }
    if (body.source === "empty") return { kind: "empty" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}


async function recordLatestSnapshotMetadata(scope: string, snapshotDate: string): Promise<void> {
  const uid = firebaseAuth?.currentUser?.uid ?? null;
  if (!uid) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Portfolio Sync] metadata write skipped", {
        scope,
        snapshotDate,
        reason: "No authenticated Firebase user is available.",
      });
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[Portfolio Sync] latest snapshot metadata sync start", { uid, scope, snapshotDate });
  }
  const metadata = await recordPortfolioCloudSyncSuccess(uid);
  markPortfolioCloudSyncNow(metadata.lastSyncedAtMs ?? Date.now());
  if (process.env.NODE_ENV !== "production") {
    console.info("[Portfolio Sync] latest snapshot metadata sync complete", {
      uid,
      scope,
      snapshotDate,
      exists: metadata.exists,
      lastSyncedAt: metadata.lastSyncedAtIso,
      updatedAt: metadata.updatedAtIso,
    });
  }
}
/**
 * On mount, ensure the latest Firestore snapshot is the active data source for
 * the Portfolio screen.
 *
 * Behaviour:
 *   - If the store ALREADY holds a snapshot (populated by an earlier mount on
 *     this SPA session), reuse it — no refetch.
 *   - Otherwise read /api/portfolio/latest-snapshot. On a `firestore` result the
 *     snapshot is published as the single source. On `empty`/`error` the store
 *     stays null so the view falls back to legacy localStorage data — but, since
 *     we no longer latch, a subsequent mount can re-read and pick up a snapshot
 *     created in the meantime.
 *
 * The store write on success is intentionally NOT gated on this mount's lifetime
 * (only the local status state is): even if this component unmounts mid-fetch
 * (fast navigation / React Strict Mode), the shared store is still populated so
 * every subscribed component re-renders via useSyncExternalStore.
 */
export function usePortfolioFirestoreSnapshot(): FirestoreSnapshotSyncState {
  const [state, setState] = useState<FirestoreSnapshotSyncState>({
    status: "idle",
    snapshotDate: null,
  });

  useEffect(() => {
    // Already have an active Firestore snapshot from an earlier mount/fetch on
    // this page session -> reuse it as-is (report applied), no refetch.
    if (firestoreSnapshot !== null) {
      setState({ status: "applied", snapshotDate: firestoreSnapshotDate });
      return;
    }
    if (onMountFetchInFlight) return;
    onMountFetchInFlight = true;

    let cancelled = false;
    setState({ status: "loading", snapshotDate: null });

    (async () => {
      try {
        const result = await fetchLatestSnapshot({ respectDeletedTombstone: true });

        if (result.kind === "firestore") {
          await recordLatestSnapshotMetadata("on-mount latest-snapshot", result.snapshotDate);
          // Publish to the shared store regardless of this mount's lifetime so
          // subscribers (incl. a remounted page) always see the snapshot.
          setFirestoreSnapshot(result.snapshot, result.snapshotDate);
          if (!cancelled) {
            setState({ status: "applied", snapshotDate: result.snapshotDate });
          }
          return;
        }

        // empty / error: leave the store null (legacy fallback). Do NOT latch —
        // a later mount may re-read once a document exists.
        if (!cancelled) {
          setState({
            status: result.kind === "empty" ? "empty" : "fallback",
            snapshotDate: null,
          });
        }
      } finally {
        onMountFetchInFlight = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// =============================================================
// Manual "최신화" (refresh) — re-read the latest Firestore snapshot ON DEMAND.
//
// Unlike the on-mount hook above, this NEVER clears the active snapshot on a
// failed read: if the fetch fails (or returns empty), the screen keeps the data
// it is already showing (requirement: "조회 실패 시 현재 화면 데이터를 그대로 유지").
// There is no polling — the fetch only runs when the user clicks the button.
// =============================================================
export type PortfolioRefreshOutcome =
  | "updated" // a newer snapshot was fetched and applied -> screen updated
  | "unchanged" // the latest snapshot equals the active one -> nothing changed
  | "error"; // fetch failed / no snapshot available -> current data kept

export interface PortfolioRefreshController {
  /** True while a refresh request is in flight (drives the disabled/spinner UI). */
  isRefreshing: boolean;
  /** Trigger a manual refresh. Concurrent calls are ignored while one is running. */
  refresh: () => Promise<PortfolioRefreshOutcome>;
}

// Module-level guard shared by every caller of the standalone applier below, so
// overlapping re-fetches (e.g. a manual refresh racing the pipeline's
// post-success apply) can never publish two snapshots at once.
let applyInFlight = false;

/**
 * Standalone, non-hook version of the manual refresh: re-fetch the latest
 * Firestore snapshot and publish it as the single source ONLY when it differs
 * from the active one. Returns:
 *   - "updated"   : a newer snapshot was applied -> screen updates immediately
 *   - "unchanged" : the latest snapshot equals the active one -> no re-render
 *   - "error"     : fetch failed / no snapshot -> current screen data is kept
 *
 * Reused by both `usePortfolioRefresh` and the GitHub Actions pipeline hook
 * (which calls this after the workflow succeeds). Like the hook, it NEVER clears
 * the active snapshot on a failed read (requirement: keep current data on error).
 */
export async function applyLatestFirestoreSnapshot(): Promise<PortfolioRefreshOutcome> {
  if (applyInFlight) return "unchanged";
  applyInFlight = true;

  try {
    const result = await fetchLatestSnapshot({ respectDeletedTombstone: false });

    if (result.kind === "firestore") {
      await recordLatestSnapshotMetadata("manual/pipeline latest-snapshot", result.snapshotDate);
      unmarkSnapshotDateDeleted(result.snapshotDate);
      const uid = firebaseAuth?.currentUser?.uid ?? null;
      if (uid) {
        await removeDeletedSnapshotDateFromCloud(uid, result.snapshotDate).catch((err) => {
          console.error("[Portfolio Sync] Snapshot create failed", {
            function: "removeDeletedSnapshotDateFromCloud",
            documentPath: `users/${uid}/portfolioSnapshotState/state`,
            reason: err instanceof Error ? err.message : String(err),
            exception: err,
          });
        });
      }
      if (process.env.NODE_ENV !== "production") {
        console.info("[Portfolio Sync] snapshot reload", {
          snapshotId: result.snapshot.id,
          snapshotDate: result.snapshotDate,
          snapshotCreated: result.snapshot.createdAt,
          snapshotSelected: true,
        });
      }
      // 같은 날짜라도 파이프라인이 재생성해 서버 생성 시각(generated_at → createdAt)이
      // 갱신되었으면 "변경"으로 취급해 새로 게시한다. 이렇게 해야 같은 날 여러 번
      // 최신화해도 "최근 클라우드 동기화" 시각이 즉시 갱신된다(요구사항: 최신화 즉시 변경).
      const sameAsActive =
        firestoreSnapshot !== null &&
        firestoreSnapshotDate === result.snapshotDate &&
        firestoreSnapshot.createdAt === result.snapshot.createdAt;
      if (sameAsActive) {
        // Identical snapshot: do NOT touch the store (no re-render).
        return "unchanged";
      }
      // New snapshot: publish it as the single source -> immediate update.
      setFirestoreSnapshot(result.snapshot, result.snapshotDate);
      return "updated";
    }

    // "empty" or "error": never clear what the user is currently seeing.
    return "error";
  } finally {
    applyInFlight = false;
  }
}

/**
 * Provides the manual refresh action for the Portfolio screen. The returned
 * `refresh()` re-fetches the latest Firestore snapshot and, only when it differs
 * from the currently active one, publishes it so every Portfolio component
 * re-renders immediately (no browser F5 needed). An identical snapshot is a
 * no-op (no store change, no re-render).
 */
export function usePortfolioRefresh(): PortfolioRefreshController {
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Ref guard so rapid double-clicks can't launch overlapping fetches even
  // before the `isRefreshing` state has committed.
  const inFlight = useRef(false);

  const refresh = useCallback(async (): Promise<PortfolioRefreshOutcome> => {
    if (inFlight.current) return "unchanged";
    inFlight.current = true;
    setIsRefreshing(true);

    try {
      // Delegate to the shared applier (single source of the fetch+compare+
      // publish logic, also used by the GitHub Actions pipeline hook).
      return await applyLatestFirestoreSnapshot();
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, []);

  return { isRefreshing, refresh };
}
