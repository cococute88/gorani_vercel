// =============================================================
// Firestore Portfolio Read Adapter — Phase C.
//
// This is the SINGLE entry point for Firestore portfolio data when the
// USE_FIRESTORE_CONTRACT feature flag is ON. It:
//   1. reads the contract document(s) from Firestore (READ ONLY),
//   2. validates `document_version` (1.0.0 / 1.1.0),
//   3. maps each document into the existing PortfolioSnapshot view model
//      via the pure mapper in `firestore-portfolio-contract.ts`.
//
// It performs NO writes and NO monetary recomputation. Downstream runtime
// derivations (MDD, CAGR, charts) continue to run inside gorani_vercel and
// consume the mapped snapshots.
//
// Firestore layout (read only):
//   users/{uid}/portfolioContract/{snapshotDate|docId}
//     -> FirestorePortfolioContractDocument
// =============================================================

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { PortfolioSnapshot } from "./portfolio-types";
import { firestoreDb } from "./firebase/client";
import {
  mapContractToSnapshot,
  type ContractMappingWarning,
  type FirestorePortfolioContractDocument,
  type FirestorePortfolioContractVersion,
} from "./firestore-portfolio-contract";

export const PORTFOLIO_CONTRACT_COLLECTION = "portfolioContract";

export interface AdaptedPortfolioContract {
  snapshots: PortfolioSnapshot[];
  documentVersions: FirestorePortfolioContractVersion[];
  warnings: ContractMappingWarning[];
  source: "firestore-contract";
  /** Documents that failed validation/mapping, with the reason. Skipped, not thrown. */
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * Map an arbitrary set of raw contract documents into PortfolioSnapshots.
 * Exposed separately so it can be unit-tested without a live Firestore.
 *
 * Invalid documents (bad/missing version, missing totals) are skipped with a
 * recorded reason rather than aborting the whole load — the adapter is the only
 * entry point, so it must be resilient to a single bad document.
 */
export function adaptContractDocuments(
  documents: Array<{ id: string; data: FirestorePortfolioContractDocument }>,
): AdaptedPortfolioContract {
  const snapshots: PortfolioSnapshot[] = [];
  const warnings: ContractMappingWarning[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const versions = new Set<FirestorePortfolioContractVersion>();

  for (const { id, data } of documents) {
    try {
      const mapped = mapContractToSnapshot(data, { docId: id });
      snapshots.push(mapped.snapshot);
      versions.add(mapped.documentVersion);
      for (const warning of mapped.warnings) {
        if (!warnings.some((existing) => existing.code === warning.code)) {
          warnings.push(warning);
        }
      }
    } catch (error) {
      skipped.push({ id, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  snapshots.sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));

  return {
    snapshots,
    documentVersions: Array.from(versions),
    warnings,
    source: "firestore-contract",
    skipped,
  };
}

/**
 * Read all portfolio contract documents for a user from Firestore and adapt
 * them into PortfolioSnapshots. READ ONLY.
 */
export async function loadPortfolioContract(uid: string): Promise<AdaptedPortfolioContract> {
  if (!firestoreDb) {
    throw new Error("Firebase is not configured");
  }
  const snap = await getDocs(
    query(
      collection(firestoreDb, "users", uid, PORTFOLIO_CONTRACT_COLLECTION),
      orderBy("snapshot_date", "asc"),
    ),
  );
  const documents = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() as unknown as FirestorePortfolioContractDocument,
  }));
  return adaptContractDocuments(documents);
}
