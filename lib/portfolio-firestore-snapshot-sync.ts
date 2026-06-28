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

import { useEffect, useState, useSyncExternalStore } from "react";
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
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Publish the Firestore snapshot as the single source (or clear it with null). */
function setFirestoreSnapshot(snapshot: PortfolioSnapshot | null): void {
  if (firestoreSnapshot === snapshot) return;
  firestoreSnapshot = snapshot;
  emit();
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

// Only attempt the live read once per loaded module instance (page session),
// mirroring the existing cloud-sync's single-attempt guard.
let attempted = false;

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
      try {
        const res = await fetch(ENDPOINT, { cache: "no-store" });
        if (!res.ok) {
          // Treat any non-2xx as a graceful fallback to legacy data.
          if (!cancelled) {
            setFirestoreSnapshot(null);
            setState({ status: "fallback", snapshotDate: null });
          }
          attempted = false; // allow a later retry (e.g. remount)
          return;
        }

        const body = (await res.json()) as LatestSnapshotResponse;
        if (cancelled) return;

        if (body.source === "firestore" && body.snapshot) {
          // Single source: the Firestore snapshot fully drives the Portfolio
          // view. We do NOT merge with — or write to — localStorage.
          setFirestoreSnapshot(body.snapshot);
          setState({ status: "applied", snapshotDate: body.snapshotDate });
          return;
        }

        if (body.source === "empty") {
          // No Firestore document -> fall back to legacy localStorage data.
          setFirestoreSnapshot(null);
          setState({ status: "empty", snapshotDate: null });
          return;
        }

        // source === "error": keep/restore legacy data as the fallback.
        setFirestoreSnapshot(null);
        setState({ status: "fallback", snapshotDate: null });
      } catch {
        // Network / JSON failure -> keep legacy data, allow a later retry.
        if (!cancelled) {
          setFirestoreSnapshot(null);
          setState({ status: "fallback", snapshotDate: null });
        }
        attempted = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
