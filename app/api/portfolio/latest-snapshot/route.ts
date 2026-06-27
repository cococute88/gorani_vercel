// =============================================================
// GET /api/portfolio/latest-snapshot
//
// Server-only endpoint that exposes the latest `portfolio_snapshots` document
// (read via the PR #130 Firebase Admin read layer) to the client as the
// existing `PortfolioSnapshot` view model.
//
// This is the data-supply boundary: the client never talks to Firestore. It
// fetches this route and feeds the returned view model into the portfolio
// store, so every downstream UI / chart / calculation stays unchanged.
//
// Fallback safety (requirements 4 & 5): this handler NEVER throws to the
// client. It always responds 200 with a discriminated `source`:
//   - "firestore" : a snapshot was found and mapped       -> client uses it
//   - "empty"     : the collection has no snapshot yet     -> client falls back
//   - "error"     : config / permission / unknown failure  -> client falls back
// The client treats "empty" and "error" identically: keep the legacy
// (localStorage/report_input) data already in the store.
// =============================================================

import { NextResponse } from "next/server";

import {
  getLatestPortfolioSnapshot,
  isFirestoreReadError,
} from "@/lib/firestore";
import { mapPortfolioSnapshotRecordToViewModel } from "@/lib/firestore/snapshot-viewmodel";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";

// Always read live; never statically cache the latest snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type LatestSnapshotResponse =
  | { source: "firestore"; snapshotDate: string; snapshot: PortfolioSnapshot }
  | { source: "empty"; snapshot: null }
  | { source: "error"; snapshot: null; code: string };

/**
 * Dev-only log of the resolved snapshot date (requirement 6). Silent in
 * production so no snapshot data or timing leaks into production logs.
 */
function logSnapshotDateInDev(snapshotDate: string): void {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.info(`[portfolio:latest-snapshot] using Firestore snapshot ${snapshotDate}`);
}

export async function GET(): Promise<NextResponse<LatestSnapshotResponse>> {
  try {
    const record = await getLatestPortfolioSnapshot();

    if (!record) {
      // No snapshot persisted yet -> let the client fall back to legacy data.
      return NextResponse.json({ source: "empty", snapshot: null });
    }

    const snapshot = mapPortfolioSnapshotRecordToViewModel(record);
    logSnapshotDateInDev(snapshot.snapshotDate);

    return NextResponse.json({
      source: "firestore",
      snapshotDate: snapshot.snapshotDate,
      snapshot,
    });
  } catch (error) {
    // Config-missing / permission-denied / unknown all degrade gracefully:
    // the page must never break (requirement 5).
    const code = isFirestoreReadError(error) ? error.code : "unknown";
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info(`[portfolio:latest-snapshot] falling back to legacy data (${code})`);
    }
    return NextResponse.json({ source: "error", snapshot: null, code });
  }
}
