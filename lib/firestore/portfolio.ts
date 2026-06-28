// =============================================================
// Server-side portfolio snapshot read layer.
//
// Public API (server only):
//   - getLatestPortfolioSnapshot(): newest snapshot in `portfolio_snapshots`.
//   - getPortfolioSnapshot(snapshotDate): a specific snapshot by date.
//
// Because the Firestore document ID IS the snapshot date (YYYY-MM-DD), and that
// format sorts lexicographically in chronological order, "latest" is found by
// ordering on the document ID descending and taking the first result.
//
// READ ONLY. No writes, no monetary recomputation. The producer
// (bs-report-auto) owns the data; this layer only fetches and types it.
//
// Error handling (each case is handled distinctly — see ./errors):
//   - missing service account env  -> throws FirestoreReadError("config-missing")
//   - malformed service account    -> throws FirestoreReadError("service-account-json-invalid")
//   - permission / IAM / rules     -> throws FirestoreReadError("permission-denied")
//   - empty collection             -> returns null (logged as "collection-not-found")
//   - missing document             -> returns null (logged as "document-not-found")
// =============================================================

import "server-only";

import { FieldPath, type Firestore } from "firebase-admin/firestore";

import { getAdminFirestore, getAdminAccountDiagnostics, verifyAdminCredential } from "./firebase-admin";
import { FirestoreReadError, classifyAdminError, devLog } from "./errors";
import {
  PORTFOLIO_SNAPSHOTS_COLLECTION,
  type PortfolioSnapshotDocument,
  type PortfolioSnapshotRecord,
  type SnapshotDate,
} from "./types";

/** Strict YYYY-MM-DD validation for the snapshot date / document ID. */
const SNAPSHOT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidSnapshotDate(value: string): value is SnapshotDate {
  return SNAPSHOT_DATE_PATTERN.test(value);
}

function toRecord(id: string, data: PortfolioSnapshotDocument): PortfolioSnapshotRecord {
  return { id, data };
}

function snapshotsCollection(db: Firestore) {
  return db.collection(PORTFOLIO_SNAPSHOTS_COLLECTION);
}

/**
 * Best-effort resolution of the database id the Admin Firestore handle targets,
 * for diagnostics only. The id is not part of the stable public type, so we
 * probe a few known internal shapes and fall back to the configured env / the
 * Firestore default "(default)" database. Never throws.
 */
function resolveDatabaseId(db: Firestore): string {
  const probe = db as unknown as {
    databaseId?: { database?: string } | string;
    _databaseId?: { database?: string };
  };
  const fromGetter =
    typeof probe.databaseId === "string"
      ? probe.databaseId
      : probe.databaseId?.database ?? probe._databaseId?.database;
  return fromGetter || process.env.FIRESTORE_DATABASE_ID || "(default)";
}

/**
 * Return the most recent portfolio snapshot, or `null` when the collection has
 * no documents yet. Throws a typed FirestoreReadError for configuration or
 * permission failures.
 */
export async function getLatestPortfolioSnapshot(): Promise<PortfolioSnapshotRecord | null> {
  // getAdminFirestore() throws FirestoreReadError for config/JSON/init problems.
  const db = getAdminFirestore();

  // Requirement 2: log the FULL access + query context BEFORE touching
  // Firestore — projectId, databaseId, collection, orderBy and limit.
  const account = getAdminAccountDiagnostics();
  const databaseId = resolveDatabaseId(db);
  const orderBy = "__name__ (documentId) desc";
  const limit = 1;
  devLog("portfolio", "Querying latest snapshot", {
    projectId: account?.projectId,
    clientEmail: account?.clientEmail,
    databaseId,
    collection: PORTFOLIO_SNAPSHOTS_COLLECTION,
    orderBy,
    limit,
  });

  try {
    // Preflight the credential so a rejected key (gRPC 16 / invalid_grant) is
    // reported as "unauthenticated" with the real reason, instead of surfacing
    // as an opaque UNAUTHENTICATED deep inside query.get(). Cached: at most one
    // network round-trip per runtime.
    await verifyAdminCredential();

    const query = snapshotsCollection(db)
      // Document ID == YYYY-MM-DD, so ordering by ID desc yields newest first.
      .orderBy(FieldPath.documentId(), "desc")
      .limit(limit);
    const result = await query.get();

    // Requirement 3: log the raw query-result shape immediately after get().
    devLog("portfolio", "Query returned", {
      collection: PORTFOLIO_SNAPSHOTS_COLLECTION,
      empty: result.empty,
      size: result.size,
      docsLength: result.docs.length,
    });

    if (result.empty) {
      // Distinct from an error: the collection simply has no documents yet.
      devLog("portfolio", "Collection is empty", {
        collection: PORTFOLIO_SNAPSHOTS_COLLECTION,
        empty: true,
        code: "collection-empty",
      });
      return null;
    }

    const doc = result.docs[0];
    const data = doc.data() as PortfolioSnapshotDocument;
    // Requirement 5: log post-query facts (no monetary payload is logged).
    devLog("portfolio", "Loaded latest snapshot", {
      exists: doc.exists,
      id: doc.id,
      fieldCount: Object.keys(data ?? {}).length,
      documentVersion: data?.document_version,
    });
    return toRecord(doc.id, data);
  } catch (error) {
    // Wrap query failures as "firestore-query-failed" (never "unknown"); the
    // original error is logged inside classifyAdminError.
    const classified = classifyAdminError(error, "firestore-query-failed");
    devLog("portfolio", "getLatestPortfolioSnapshot failed", { code: classified.code });
    throw classified;
  }
}

/**
 * Return the snapshot stored under `snapshotDate` (YYYY-MM-DD), or `null` when
 * no such document exists. Throws a typed FirestoreReadError for an invalid date
 * argument, or for configuration / permission failures.
 */
export async function getPortfolioSnapshot(
  snapshotDate: string,
): Promise<PortfolioSnapshotRecord | null> {
  if (typeof snapshotDate !== "string" || !isValidSnapshotDate(snapshotDate)) {
    // Surface bad input distinctly from "not found".
    throw new FirestoreReadError(
      "document-not-found",
      `Invalid snapshot date "${String(snapshotDate)}". Expected YYYY-MM-DD.`,
    );
  }

  const db = getAdminFirestore();

  const account = getAdminAccountDiagnostics();
  devLog("portfolio", "Querying snapshot by id", {
    projectId: account?.projectId,
    clientEmail: account?.clientEmail,
    collection: PORTFOLIO_SNAPSHOTS_COLLECTION,
    queryMethod: `doc("${snapshotDate}").get()`,
  });

  try {
    await verifyAdminCredential();

    const doc = await snapshotsCollection(db).doc(snapshotDate).get();

    if (!doc.exists) {
      devLog("portfolio", "Snapshot not found", { id: snapshotDate, code: "document-not-found" });
      return null;
    }

    const data = doc.data() as PortfolioSnapshotDocument;
    devLog("portfolio", "Loaded snapshot", {
      exists: doc.exists,
      id: doc.id,
      fieldCount: Object.keys(data ?? {}).length,
      documentVersion: data?.document_version,
    });
    return toRecord(doc.id, data);
  } catch (error) {
    const classified = classifyAdminError(error, "firestore-query-failed");
    devLog("portfolio", "getPortfolioSnapshot failed", { code: classified.code });
    throw classified;
  }
}
