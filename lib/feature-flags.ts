// =============================================================
// Feature flags.
//
// Flags are read from environment variables. Because the Portfolio Manager
// runs in the browser, any flag that gates client behavior must be prefixed
// with NEXT_PUBLIC_ so Next.js inlines it into the client bundle.
// =============================================================

/**
 * USE_FIRESTORE_CONTRACT
 *
 * OFF (default): the Portfolio Manager uses its existing data path
 *   (localStorage store + the legacy raw Firestore snapshot sync). Behavior is
 *   unchanged.
 *
 * ON: the Portfolio Manager sources portfolio data ONLY through the Firestore
 *   read adapter (`lib/firestore-portfolio-adapter.ts`). The legacy raw
 *   snapshot read/write path is bypassed.
 *
 * Set via env:  NEXT_PUBLIC_USE_FIRESTORE_CONTRACT=true
 */
export const USE_FIRESTORE_CONTRACT: boolean =
  (process.env.NEXT_PUBLIC_USE_FIRESTORE_CONTRACT ?? "").trim().toLowerCase() === "true";

export function isFirestoreContractEnabled(): boolean {
  return USE_FIRESTORE_CONTRACT;
}
