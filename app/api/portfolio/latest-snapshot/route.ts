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
import {
  mapPortfolioSnapshotRecordToViewModel,
  describeSnapshotDocumentShape,
  type SnapshotDocumentShape,
} from "@/lib/firestore/snapshot-viewmodel";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";

// Always read live; never statically cache the latest snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const isDev = process.env.NODE_ENV !== "production";

/**
 * Whether to surface the full Firestore/gRPC diagnostics in the JSON response.
 *
 * IMPORTANT: this is evaluated PER REQUEST (not memoized at module load) so the
 * deployed runtime always reflects the current `FIRESTORE_DEBUG` value on
 * Vercel — a module-level const is captured at cold start and was the reason
 * the flag appeared to have no effect in production.
 *
 * Gating rules (requirements 2 & 3):
 *   - `FIRESTORE_DEBUG=1` / `FIRESTORE_DEBUG=true`  -> ALWAYS return diagnostics,
 *     regardless of NODE_ENV (this is the production capture switch).
 *   - otherwise, when running in development we still return diagnostics for
 *     local DX.
 *   - only when the flag is false AND we are in production do we keep the
 *     minimal response with no internals.
 */
function isDebugDiagnosticsEnabled(): boolean {
  const flag = process.env.FIRESTORE_DEBUG;
  if (flag === "1" || flag === "true") return true;
  return isDev;
}

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

/**
 * Debug payload that exposes WHERE each field resolved from in the raw producer
 * document, plus (only when explicitly requested via `?raw=1`) the full raw
 * document. This is what makes the "connected but empty" symptom diagnosable: a
 * 1:1 comparison between the persisted document and what the mapper reads.
 */
type SnapshotDebugPayload = {
  documentId: string;
  shape: SnapshotDocumentShape;
  /** The full raw Firestore document. Only present when `?raw=1` is passed. */
  rawDocument?: unknown;
};

type LatestSnapshotResponse =
  | {
      source: "firestore";
      snapshotDate: string;
      snapshot: PortfolioSnapshot;
      debug?: SnapshotDebugPayload;
    }
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

export async function GET(request: Request): Promise<NextResponse<LatestSnapshotResponse>> {
  try {
    const record = await getLatestPortfolioSnapshot();

    if (!record) {
      // No snapshot persisted yet -> let the client fall back to legacy data.
      // This is "empty", NEVER "error" (requirement 6).
      return NextResponse.json({ source: "empty", snapshot: null });
    }

    // ALWAYS log the real document structure (top-level keys, totals keys,
    // array keys + counts) to the runtime log via console.error so it is
    // visible on Vercel too. This is field NAMES / counts only — no balances —
    // so it is safe to emit even in production. This directly answers "what does
    // the persisted document actually look like?" for the empty-mapping bug.
    const shape = describeSnapshotDocumentShape(record.data as Record<string, unknown>);
    // eslint-disable-next-line no-console
    console.error("[portfolio:latest-snapshot] raw document shape", {
      documentId: record.id,
      ...shape,
    });

    const snapshot = mapPortfolioSnapshotRecordToViewModel(record);
    logResolvedSnapshotInDev(
      record.id,
      snapshot.snapshotDate,
      record.data.document_version,
    );

    // Surface the document shape (and, when `?raw=1`, the full raw document) in
    // the JSON response when diagnostics are enabled. Lets a developer compare
    // the persisted document against the mapped view model from the browser.
    const wantRaw = new URL(request.url).searchParams.get("raw") === "1";
    const debug: SnapshotDebugPayload | undefined = isDebugDiagnosticsEnabled()
      ? {
          documentId: record.id,
          shape,
          ...(wantRaw ? { rawDocument: record.data } : {}),
        }
      : undefined;

    return NextResponse.json({
      source: "firestore",
      snapshotDate: snapshot.snapshotDate,
      snapshot,
      ...(debug ? { debug } : {}),
    });
  } catch (error) {
    // Config-missing / permission-denied / admin-init-failed / query failures
    // all degrade gracefully: the page must never break (requirement 5). But we
    // must NOT collapse everything into "unknown" — classify and surface the
    // real cause whenever diagnostics are enabled.
    // Always emit the ORIGINAL error to the runtime logs via console.error so
    // it is visible on Vercel too (logOriginalError is a no-op in production).
    logOriginalError("latest-snapshot", error);
    const classified = classifyAdminError(error, "firestore-query-failed");
    // describeError walks the `cause` chain, so `info` carries the ORIGINAL
    // Firestore/gRPC error fields verbatim — never the wrapper's text
    // (requirement 5: the original Error.message is preserved, not overwritten).
    const info = describeError(error);

    // eslint-disable-next-line no-console
    console.error("[portfolio:latest-snapshot] Firestore read failed", {
      code: classified.code,
      message: info.message,
      errorName: info.errorName,
      rawCode: info.code,
      grpcCode: info.grpcCode,
      grpcStatusName: info.grpcStatusName,
      details: info.details,
      metadata: info.metadata,
      stack: info.stack,
    });

    if (isDebugDiagnosticsEnabled()) {
      // Requirement 1: surface EVERY field of describeError() verbatim in the
      // JSON response so the real cause is never hidden behind a generic code.
      const diagnostics: ErrorDiagnosticsPayload = {
        message: info.message,
        errorName: info.errorName,
        rawCode: info.code,
        grpcCode: info.grpcCode,
        grpcStatusName: info.grpcStatusName,
        details: info.details,
        metadata: info.metadata,
        stack: info.stack,
      };
      return NextResponse.json({
        source: "error",
        snapshot: null,
        // The typed classification (never "unknown" for a recognised gRPC
        // status) plus the ORIGINAL error content, untouched (requirement 1).
        code: classified.code,
        diagnostics,
      });
    }

    // Requirement 3: only when FIRESTORE_DEBUG is false (in production) do we
    // keep the minimal response with no internals leaked.
    return NextResponse.json({ source: "error", snapshot: null, code: classified.code });
  }
}
