// =============================================================
// Typed errors + dev-only logging for the server Firestore read layer.
//
// Every failure mode required by the spec is represented by a distinct
// `FirestoreErrorCode` so callers (and future API routes) can branch on the
// exact cause instead of string-matching messages:
//   - config-missing             : service account env var absent
//   - service-account-json-invalid : env var present but not valid JSON / fields
//   - permission-denied          : Firestore rejected the read (IAM / rules)
//   - collection-not-found       : the portfolio_snapshots collection is empty
//   - document-not-found         : a specific snapshot date does not exist
//   - unknown                    : anything else, wrapped for safety
// =============================================================

export type FirestoreErrorCode =
  | "config-missing"
  | "service-account-json-invalid"
  | "permission-denied"
  | "collection-not-found"
  | "document-not-found"
  | "unknown";

export class FirestoreReadError extends Error {
  readonly code: FirestoreErrorCode;
  /** The original error, when this wraps a lower-level failure. */
  readonly cause?: unknown;

  constructor(code: FirestoreErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "FirestoreReadError";
    this.code = code;
    this.cause = cause;
    // Restore prototype chain (TS target downlevel safety).
    Object.setPrototypeOf(this, FirestoreReadError.prototype);
  }
}

export function isFirestoreReadError(value: unknown): value is FirestoreReadError {
  return value instanceof FirestoreReadError;
}

/**
 * Map a low-level error thrown by the Firebase Admin SDK to a typed
 * FirestoreReadError. Notably detects permission/IAM failures so the caller can
 * distinguish them from "no data".
 */
export function classifyAdminError(error: unknown): FirestoreReadError {
  if (isFirestoreReadError(error)) return error;

  // Firestore/gRPC permission errors surface either as code 7 (PERMISSION_DENIED)
  // or as a message mentioning permission. Detect both without leaking details.
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  const isPermission =
    code === 7 ||
    code === "permission-denied" ||
    /permission|PERMISSION_DENIED|insufficient|unauthenticated|UNAUTHENTICATED/i.test(message);

  if (isPermission) {
    return new FirestoreReadError(
      "permission-denied",
      "Firestore denied the read. Check the service account IAM role and security rules.",
      error,
    );
  }

  return new FirestoreReadError("unknown", "Unexpected Firestore read failure.", error);
}

/**
 * Dev-only structured logger. In production this is a no-op so no snapshot data
 * or credentials can leak into logs. The message is intentionally generic and
 * never includes the service account or document payloads.
 */
export function devLog(scope: string, message: string, detail?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  if (detail && Object.keys(detail).length > 0) {
    // eslint-disable-next-line no-console
    console.info(`[firestore:${scope}] ${message}`, detail);
  } else {
    // eslint-disable-next-line no-console
    console.info(`[firestore:${scope}] ${message}`);
  }
}
