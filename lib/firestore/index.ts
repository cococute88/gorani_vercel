// =============================================================
// Server-only Firestore portfolio read layer — public surface.
//
// Import from "@/lib/firestore" in server code (route handlers, server
// components, server actions). Do NOT import from a client component.
// =============================================================

export {
  getLatestPortfolioSnapshot,
  getPortfolioSnapshot,
} from "./portfolio";

export {
  getAdminFirestore,
  isAdminFirestoreConfigured,
  getAdminAccountDiagnostics,
  type AdminAccountDiagnostics,
} from "./firebase-admin";

export {
  FirestoreReadError,
  isFirestoreReadError,
  classifyAdminError,
  describeError,
  logOriginalError,
  type FirestoreErrorCode,
  type ErrorDiagnostics,
} from "./errors";

export {
  PORTFOLIO_SNAPSHOTS_COLLECTION,
  type PortfolioSnapshotDocument,
  type PortfolioSnapshotRecord,
  type PortfolioSnapshotTotals,
  type PortfolioSnapshotHolding,
  type PortfolioSnapshotCashAsset,
  type PortfolioSnapshotMetadata,
  type SnapshotDate,
} from "./types";
