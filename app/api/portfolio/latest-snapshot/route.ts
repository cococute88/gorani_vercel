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

// Requirement 1 & 6: full diagnostics are surfaced in the JSON response in
// development. Because this bug only reproduces on Vercel (NODE_ENV=production),
// we ALSO honour an explicit opt-in flag so the operator can capture the real
// Firestore/gRPC exception in the deployed runtime, then turn it back off.
// Set `FIRESTORE_DEBUG=1` (or `true`) in the Vercel project env to enable.
const debugDiagnosticsEnabled =
  isDev ||
  process.env.FIRESTORE_DEBUG === "1" ||
  process.env.FIRESTORE_DEBUG === "true";

type ErrorDiagnosticsPayload = {
  /** error.message of the ORIGINAL Firestore/gRPC error. */
  message?: string;
  /** error.name / constructor name of the original error. */
  errorName?: string;
  /** Application or string code (e.g. "permission-denied"). */
  rawCode?: string | number;
  /** Numeric gRPC status code (e.g. 7). */
  grpcCode?: number;
  /** Human-readable gRPC status name (e.g. "PERMISSION_DENIED"). */
  grpcStatusName?: string;
  /** gRPC `details` string attached by the backend. */
  details?: string;
  /** Flattened gRPC trailing metadata. */
  metadata?: Record<string, unknown>;
  /** Full stack of the original error. */
  stack?: string;
};

type LatestSnapshotResponse =
  | { source: "firestore"; snapshotDate: string; snapshot: PortfolioSnapshot }
  | { source: "empty"; snapshot: null }
  | {
      source: "error";
      snapshot: null;
      code: string;
      // Diagnostics are only populated when debug is enabled (requirement 1).
      // In normal production the response stays minimal so no internals leak.
      diagnostics?: ErrorDiagnosticsPayload;
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
    // must NOT collapse everything into "unknown" — classify and surface the
    // real cause whenever diagnostics are enabled.
    logOriginalError("latest-snapshot", error);
    const classified = classifyAdminError(error, "firestore-query-failed");
    const info = describeError(error);

    if (debugDiagnosticsEnabled) {
      const diagnostics: ErrorDiagnosticsPayload = {
        message: info.message,
        errorName: info.errorName,
        rawCode: info.code,
        grpcCode: info.grpcCode,
        grpcStatusName: info.grpcStatusName,
        details: info.details,
        metadata: info.metadata,
        // stack is only included when diagnostics are explicitly enabled.
        stack: info.stack,
      };
      // eslint-disable-next-line no-console
      console.info("[portfolio:latest-snapshot] falling back to legacy data", {
        code: classified.code,
        ...diagnostics,
      });
      return NextResponse.json({
        source: "error",
        snapshot: null,
        // The typed classification (never "unknown" for a recognised gRPC
        // status) plus the ORIGINAL error content, untouched (requirement 4).
        code: classified.code,
        diagnostics,
      });
    }

    // Production (debug disabled): keep the response minimal, no internals.
    return NextResponse.json({ source: "error", snapshot: null, code: classified.code });
  }
}
