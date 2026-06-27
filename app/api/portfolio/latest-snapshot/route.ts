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
  classifyAdminError,
  describeError,
  logOriginalError,
} from "@/lib/firestore";
import { mapPortfolioSnapshotRecordToViewModel } from "@/lib/firestore/snapshot-viewmodel";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";

// Always read live; never statically cache the latest snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const isDev = process.env.NODE_ENV !== "production";

type LatestSnapshotResponse =
  | { source: "firestore"; snapshotDate: string; snapshot: PortfolioSnapshot }
  | { source: "empty"; snapshot: null }
  | {
      source: "error";
      snapshot: null;
      code: string;
      // Diagnostics are only populated in development (requirement 1). In
      // production the response stays minimal so no internals leak.
      message?: string;
      errorName?: string;
      stack?: string;
    };

/**
 * Dev-only log of the resolved snapshot before responding (requirements 6 & 8):
 * document id, snapshot date and document_version. Silent in production so no
 * snapshot data or timing leaks into production logs.
 */
function logResolvedSnapshotInDev(
  documentId: string,
  snapshotDate: string,
  documentVersion: string | undefined,
): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.info("[portfolio:latest-snapshot] using Firestore snapshot", {
    documentId,
    snapshotDate,
    documentVersion,
  });
}

export async function GET(): Promise<NextResponse<LatestSnapshotResponse>> {
  try {
    const record = await getLatestPortfolioSnapshot();

    if (!record) {
      // No snapshot persisted yet -> let the client fall back to legacy data.
      // This is "empty", NEVER "error" (requirement 6).
      return NextResponse.json({ source: "empty", snapshot: null });
    }

    const snapshot = mapPortfolioSnapshotRecordToViewModel(record);
    logResolvedSnapshotInDev(
      record.id,
      snapshot.snapshotDate,
      record.data.document_version,
    );

    return NextResponse.json({
      source: "firestore",
      snapshotDate: snapshot.snapshotDate,
      snapshot,
    });
  } catch (error) {
    // Config-missing / permission-denied / admin-init-failed / query failures
    // all degrade gracefully: the page must never break (requirement 5). But we
    // must NOT collapse everything into "unknown" — classify and, in dev,
    // surface the real cause.
    logOriginalError("latest-snapshot", error);
    const classified = classifyAdminError(error, "firestore-query-failed");
    const info = describeError(error);

    if (isDev) {
      // eslint-disable-next-line no-console
      console.info("[portfolio:latest-snapshot] falling back to legacy data", {
        code: classified.code,
        errorName: info.errorName,
        message: info.message,
        grpcCode: info.grpcCode,
      });
      return NextResponse.json({
        source: "error",
        snapshot: null,
        code: classified.code,
        message: info.message,
        errorName: info.errorName,
        // stack is dev-only (requirement 1).
        stack: info.stack,
      });
    }

    // Production: keep the response minimal, no internals.
    return NextResponse.json({ source: "error", snapshot: null, code: classified.code });
  }
}
