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

// Only attempt the live read once per loaded module instance (page session),
// mirroring the existing cloud-sync's single-attempt guard.
let attempted = false;

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

async function fetchLatestSnapshot(): Promise<FetchedSnapshot> {
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (!res.ok) return { kind: "error" };

    const body = (await res.json()) as LatestSnapshotResponse;
    if (body.source === "firestore" && body.snapshot) {
      return {
        kind: "firestore",
        snapshotDate: body.snapshotDate,
        snapshot: body.snapshot,
      };
    }
    if (body.source === "empty") return { kind: "empty" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * On first mount, read the latest Firestore snapshot through the API route and
 * publish it as the single data source for the Portfolio screen. Safe to call
 * from a client page; on any failure it clears the Firestore store so the view
 * falls back to the existing (legacy) localStorage data.
 */
export function usePortfolioFirestoreSnapshot(): FirestoreSnapshotSyncState {
  const [state, setState] = useState<FirestoreSnapshotSyncState>({
    status: "idle",
    snapshotDate: null,
  });

  useEffect(() => {
    if (attempted) return;
    attempted = true;

    let cancelled = false;
    setState({ status: "loading", snapshotDate: null });

    (async () => {
      const result = await fetchLatestSnapshot();
      if (cancelled) return;

      if (result.kind === "firestore") {
        // Single source: the Firestore snapshot fully drives the Portfolio
        // view. We do NOT merge with — or write to — localStorage.
        setFirestoreSnapshot(result.snapshot, result.snapshotDate);
        setState({ status: "applied", snapshotDate: result.snapshotDate });
        return;
      }

      if (result.kind === "empty") {
        // No Firestore document -> fall back to legacy localStorage data.
        setFirestoreSnapshot(null, null);
        setState({ status: "empty", snapshotDate: null });
        return;
      }

      // result.kind === "error": keep/restore legacy data as the fallback and
      // allow a later retry (e.g. remount).
      setFirestoreSnapshot(null, null);
      setState({ status: "fallback", snapshotDate: null });
      attempted = false;
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
    const result = await fetchLatestSnapshot();

    if (result.kind === "firestore") {
      const sameAsActive =
        firestoreSnapshot !== null &&
        firestoreSnapshotDate === result.snapshotDate;
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
