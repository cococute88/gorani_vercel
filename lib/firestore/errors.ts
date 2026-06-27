// =============================================================
// Typed errors + dev-only logging for the server Firestore read layer.
//
// Every failure mode required by the spec is represented by a distinct
// `FirestoreErrorCode` so callers (and future API routes) can branch on the
// exact cause instead of string-matching messages:
//   - config-missing               : service account env var absent
//   - service-account-json-invalid : env var present but not valid JSON / base64
//   - invalid-service-account      : JSON parsed but missing required fields
//   - admin-init-failed            : Firebase Admin SDK failed to initialize
//   - permission-denied            : Firestore rejected the read (IAM / rules)
//   - firestore-query-failed       : the query/get call itself failed
//   - collection-empty             : the portfolio_snapshots collection is empty
//   - collection-not-found         : alias kept for backwards compatibility
//   - document-not-found           : a specific snapshot date does not exist
//   - unknown                      : last resort; should be rare in practice
//
// IMPORTANT: "unknown" must be avoided. When wrapping a low-level error we now
// always attach the original error (`cause`) so the API route can surface the
// real name/message/stack/gRPC-code in development.
// =============================================================

export type FirestoreErrorCode =
  | "config-missing"
  | "service-account-json-invalid"
  | "invalid-service-account"
  | "admin-init-failed"
  | "permission-denied"
  | "firestore-query-failed"
  | "collection-empty"
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
 * A structured, log/serialize-safe view of any thrown value. `stack` is only
 * meant to be surfaced in development (the caller decides). `private_key` and
 * other credentials are never part of an Error, so this is safe to log.
 */
export interface ErrorDiagnostics {
  errorName: string;
  message: string;
  /** Application-level code (e.g. Firestore "permission-denied"). */
  code?: string | number;
  /** Raw gRPC status code when present (e.g. 7 = PERMISSION_DENIED). */
  grpcCode?: number;
  stack?: string;
}

/**
 * Extract a structured, safe-to-log diagnostic view from any thrown value.
 * Walks the `cause` chain so a wrapped FirestoreReadError still reveals the
 * underlying Admin SDK / gRPC error name, message, code and stack.
 */
export function describeError(error: unknown): ErrorDiagnostics {
  // Prefer the original cause when this is a wrapper, so we report the real
  // low-level failure (gRPC code, etc.) rather than the generic wrapper text.
  const root =
    isFirestoreReadError(error) && error.cause !== undefined ? error.cause : error;

  const withFields = root as
    | { name?: unknown; message?: unknown; code?: unknown; stack?: unknown }
    | null;

  const errorName =
    typeof withFields?.name === "string" && withFields.name
      ? withFields.name
      : root instanceof Error
        ? root.constructor.name
        : typeof root;

  const message =
    root instanceof Error
      ? root.message
      : typeof withFields?.message === "string"
        ? withFields.message
        : String(root);

  const rawCode = withFields?.code;
  const code =
    typeof rawCode === "string" || typeof rawCode === "number" ? rawCode : undefined;
  const grpcCode = typeof rawCode === "number" ? rawCode : undefined;

  const stack = root instanceof Error ? root.stack : undefined;

  return { errorName, message, code, grpcCode, stack };
}

/**
 * Dev-only dump of the ORIGINAL error before it is wrapped/normalized. This is
 * the single place the spec requires: name / message / stack / code (+ gRPC
 * code) are all printed so the true cause is never swallowed into "unknown".
 */
export function logOriginalError(scope: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const info = describeError(error);
  // eslint-disable-next-line no-console
  console.error(`[firestore:${scope}] original error before wrapping`, {
    errorName: info.errorName,
    message: info.message,
    code: info.code,
    grpcCode: info.grpcCode,
    stack: info.stack,
  });
}

/**
 * Map a low-level error thrown by the Firebase Admin SDK to a typed
 * FirestoreReadError. Notably detects permission/IAM failures so the caller can
 * distinguish them from "no data". Anything else is classified with the
 * provided `fallbackCode` (defaults to "firestore-query-failed") instead of the
 * opaque "unknown", and the original error is preserved as `cause` and logged.
 */
export function classifyAdminError(
  error: unknown,
  fallbackCode: FirestoreErrorCode = "firestore-query-failed",
): FirestoreReadError {
  if (isFirestoreReadError(error)) return error;

  // Always surface the raw error in dev before wrapping it.
  logOriginalError("classify", error);

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

  return new FirestoreReadError(
    fallbackCode,
    `Firestore read failed: ${message}`,
    error,
  );
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
