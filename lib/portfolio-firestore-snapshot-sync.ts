"use client";

// =============================================================
// Client data-supply hook: feed the LATEST Firestore portfolio snapshot into
// the existing portfolio store on first page entry.
//
//   /api/portfolio/latest-snapshot  ->  this hook  ->  portfolio-store
//                                                       (existing UI reads here)
//
// Why a hook + the existing store (and not new props):
//   Every consumer on the 자산관리 page (PortfolioSummary, AssetAccountCards,
//   the donut charts) reads through `usePortfolioView()` -> the store. Injecting
//   the Firestore snapshot into the same store means the data source is swapped
//   with ZERO changes to UI, charts, or calculations. The UI never imports
//   anything Firestore-specific — it only ever sees the `PortfolioSnapshot`
//   view model.
//
// Fallback behaviour (requirements 4 & 5):
//   - source "firestore" : merge the snapshot into the store (authoritative for
//                          its date) and keep any existing snapshot history.
//   - source "empty"     : no Firestore document -> keep legacy local data.
//   - source "error"     : Firestore/config failure -> keep legacy local data.
//   The fetch itself is wrapped so a network/parse failure also degrades to the
//   legacy data; the page never breaks.
//
// Non-destructive: we MERGE rather than replace, so the snapshot history used
// by other views (performance / MDD) is preserved. The latest Firestore
// snapshot wins for its own date.
// =============================================================

import { useEffect, useState } from "react";
import type { PortfolioSnapshot } from "./portfolio-types";
import {
  getSnapshots,
  mergePortfolioSnapshots,
  replaceSnapshots,
} from "./portfolio-store";

const ENDPOINT = "/api/portfolio/latest-snapshot";

export type FirestoreSnapshotSyncStatus =
  | "idle"
  | "loading"
  | "applied" // a Firestore snapshot was merged into the store
  | "empty" // no Firestore snapshot yet -> legacy data kept
  | "fallback"; // Firestore/fetch error -> legacy data kept

export interface FirestoreSnapshotSyncState {
  status: FirestoreSnapshotSyncStatus;
  snapshotDate: string | null;
}

type LatestSnapshotResponse =
  | { source: "firestore"; snapshotDate: string; snapshot: PortfolioSnapshot }
  | { source: "empty"; snapshot: null }
  | { source: "error"; snapshot: null; code?: string };

// Only attempt the live read once per loaded module instance (page session),
// mirroring the existing cloud-sync's single-attempt guard.
let attempted = false;

/**
 * On first mount, read the latest Firestore snapshot through the API route and
 * merge it into the portfolio store. Safe to call from a client page; on any
 * failure it leaves the existing (legacy) store data untouched.
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
          if (!cancelled) setState({ status: "fallback", snapshotDate: null });
          attempted = false; // allow a later retry (e.g. remount)
          return;
        }

        const body = (await res.json()) as LatestSnapshotResponse;
        if (cancelled) return;

        if (body.source === "firestore" && body.snapshot) {
          // Merge: keep existing history, let the Firestore snapshot win for its date.
          const merged = mergePortfolioSnapshots(getSnapshots(), [body.snapshot]);
          replaceSnapshots(merged);
          setState({ status: "applied", snapshotDate: body.snapshotDate });
          return;
        }

        if (body.source === "empty") {
          setState({ status: "empty", snapshotDate: null });
          return;
        }

        // source === "error": keep legacy data.
        setState({ status: "fallback", snapshotDate: null });
      } catch {
        // Network / JSON failure -> keep legacy data, allow a later retry.
        if (!cancelled) setState({ status: "fallback", snapshotDate: null });
        attempted = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
