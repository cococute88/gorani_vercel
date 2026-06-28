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
//   - unauthenticated              : Google REJECTED the credential (gRPC 16 /
//                                    invalid_grant). The key is valid in shape
//                                    but not accepted (rotated/deleted/wrong
//                                    project). DISTINCT from permission-denied.
//   - permission-denied            : Firestore accepted the identity but IAM /
//                                    security rules denied the read (gRPC 7)
//   - not-found                    : gRPC 5 NOT_FOUND (database / collection /
//                                    resource path does not exist)
//   - failed-precondition          : gRPC 9 FAILED_PRECONDITION (e.g. a missing
//                                    composite index the query requires)
//   - invalid-argument             : gRPC 3 INVALID_ARGUMENT (malformed query)
//   - unavailable                  : gRPC 14 UNAVAILABLE (transient backend)
//   - deadline-exceeded            : gRPC 4 DEADLINE_EXCEEDED (timeout)
//   - firestore-query-failed       : the query/get call itself failed and the
//                                    gRPC status did not match any code above
//   - collection-empty             : the portfolio_snapshots collection is empty
//   - collection-not-found         : alias kept for backwards compatibility
//   - document-not-found           : a specific snapshot date does not exist
//   - unknown                      : last resort; should be rare in practice
//
// IMPORTANT (requirement 4 & 5): when we map a low-level error we ALWAYS attach
// the original Firestore/gRPC error as `cause` and NEVER collapse a recognised
// gRPC status into "unknown". `describeError` walks the cause chain and pulls
// the verbatim name / message / code / gRPC status / details / metadata / stack
// so the API route can surface the ORIGINAL error untouched.
// =============================================================

export type FirestoreErrorCode =
  | "config-missing"
  | "service-account-json-invalid"
  | "invalid-service-account"
  | "admin-init-failed"
  | "unauthenticated"
  | "permission-denied"
  | "not-found"
  | "failed-precondition"
  | "invalid-argument"
  | "unavailable"
  | "deadline-exceeded"
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
 * Canonical gRPC status code -> name table. Firestore (and every google-gax
 * client) reports failures with a numeric `code` that follows this enum, so we
 * use it both to give the number a human-readable name in diagnostics and to
 * map the status onto a distinct `FirestoreErrorCode`.
 */
const GRPC_STATUS_NAME: Record<number, string> = {
  0: "OK",
  1: "CANCELLED",
  2: "UNKNOWN",
  3: "INVALID_ARGUMENT",
  4: "DEADLINE_EXCEEDED",
  5: "NOT_FOUND",
  6: "ALREADY_EXISTS",
  7: "PERMISSION_DENIED",
  8: "RESOURCE_EXHAUSTED",
  9: "FAILED_PRECONDITION",
  10: "ABORTED",
  11: "OUT_OF_RANGE",
  12: "UNIMPLEMENTED",
  13: "INTERNAL",
  14: "UNAVAILABLE",
  15: "DATA_LOSS",
  16: "UNAUTHENTICATED",
};

/** Map a numeric gRPC status to its required distinct FirestoreErrorCode. */
const GRPC_CODE_TO_FIRESTORE_CODE: Record<number, FirestoreErrorCode> = {
  3: "invalid-argument",
  4: "deadline-exceeded",
  5: "not-found",
  7: "permission-denied",
  9: "failed-precondition",
  14: "unavailable",
  16: "unauthenticated",
};

/**
 * A structured, log/serialize-safe view of any thrown value. `stack` is only
 * meant to be surfaced in development (the caller decides). `private_key` and
 * other credentials are never part of an Error, so this is safe to log.
 */
export interface ErrorDiagnostics {
  errorName: string;
  message: string;
  /** Application-level code (e.g. Firestore "permission-denied") or gRPC number. */
  code?: string | number;
  /** Raw gRPC status code when present (e.g. 7 = PERMISSION_DENIED). */
  grpcCode?: number;
  /** Human-readable gRPC status name resolved from `grpcCode`. */
  grpcStatusName?: string;
  /** The gRPC `details` string the backend attached to the failure. */
  details?: string;
  /** Flattened gRPC trailing metadata (header name -> value), when present. */
  metadata?: Record<string, unknown>;
  stack?: string;
}

/**
 * Best-effort extraction of gRPC trailing metadata into a plain, JSON-safe
 * object. The metadata carrier differs across google-gax versions, so we probe
 * `toJSON()`, `getMap()` and the `internalRepr` Map in turn. Returns undefined
 * when nothing usable is present. Never throws.
 */
function extractMetadata(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const carrier = meta as {
    toJSON?: () => unknown;
    getMap?: () => unknown;
    internalRepr?: unknown;
  };

  try {
    if (typeof carrier.toJSON === "function") {
      const json = carrier.toJSON();
      if (json && typeof json === "object" && Object.keys(json).length > 0) {
        return json as Record<string, unknown>;
      }
    }
  } catch {
    /* fall through to next strategy */
  }

  try {
    if (typeof carrier.getMap === "function") {
      const map = carrier.getMap();
      if (map && typeof map === "object" && Object.keys(map).length > 0) {
        return map as Record<string, unknown>;
      }
    }
  } catch {
    /* fall through to next strategy */
  }

  try {
    if (carrier.internalRepr instanceof Map) {
      const obj = Object.fromEntries(carrier.internalRepr as Map<string, unknown>);
      if (Object.keys(obj).length > 0) return obj;
    }
  } catch {
    /* give up — metadata is optional */
  }

  return undefined;
}

/**
 * Extract a structured, safe-to-log diagnostic view from any thrown value.
 * Walks the `cause` chain so a wrapped FirestoreReadError still reveals the
 * underlying Admin SDK / gRPC error name, message, code, gRPC status, details,
 * metadata and stack — i.e. the ORIGINAL error, untouched (requirement 4).
 */
export function describeError(error: unknown): ErrorDiagnostics {
  // Prefer the original cause when this is a wrapper, so we report the real
  // low-level failure (gRPC code, etc.) rather than the generic wrapper text.
  const root =
    isFirestoreReadError(error) && error.cause !== undefined ? error.cause : error;

  const withFields = root as
    | {
        name?: unknown;
        message?: unknown;
        code?: unknown;
        details?: unknown;
        metadata?: unknown;
        stack?: unknown;
      }
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
  const grpcStatusName =
    grpcCode !== undefined ? GRPC_STATUS_NAME[grpcCode] : undefined;

  const details =
    typeof withFields?.details === "string" ? withFields.details : undefined;
  const metadata = extractMetadata(withFields?.metadata);

  const stack = root instanceof Error ? root.stack : undefined;

  return { errorName, message, code, grpcCode, grpcStatusName, details, metadata, stack };
}

/**
 * Dev-only dump of the ORIGINAL error before it is wrapped/normalized. This is
 * the single place the spec requires: name / message / stack / code (+ gRPC
 * status name) / details / metadata are all printed so the true cause is never
 * swallowed into "unknown".
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
    grpcStatusName: info.grpcStatusName,
    details: info.details,
    metadata: info.metadata,
    stack: info.stack,
  });
}

/**
 * Map a low-level error thrown by the Firebase Admin SDK to a typed
 * FirestoreReadError. Recognised gRPC statuses are each mapped to their OWN
 * distinct code (requirement 5) — they are NEVER collapsed into "unknown":
 *   - gRPC 16 UNAUTHENTICATED / invalid_grant -> "unauthenticated" (bad key)
 *   - gRPC  7 PERMISSION_DENIED               -> "permission-denied" (IAM/rules)
 *   - gRPC  5 NOT_FOUND                       -> "not-found"
 *   - gRPC  9 FAILED_PRECONDITION             -> "failed-precondition" (index)
 *   - gRPC  3 INVALID_ARGUMENT                -> "invalid-argument"
 *   - gRPC 14 UNAVAILABLE                     -> "unavailable"
 *   - gRPC  4 DEADLINE_EXCEEDED               -> "deadline-exceeded"
 * Anything unrecognised is classified with the provided `fallbackCode`
 * (defaults to "firestore-query-failed"), and the original error is preserved
 * as `cause` and logged.
 */
export function classifyAdminError(
  error: unknown,
  fallbackCode: FirestoreErrorCode = "firestore-query-failed",
): FirestoreReadError {
  if (isFirestoreReadError(error)) return error;

  // Always surface the raw error in dev before wrapping it.
  logOriginalError("classify", error);

  const rawCode = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  const numericCode = typeof rawCode === "number" ? rawCode : undefined;

  // 1) Numeric gRPC status takes precedence — it is the authoritative cause.
  if (numericCode !== undefined && GRPC_CODE_TO_FIRESTORE_CODE[numericCode]) {
    const mapped = GRPC_CODE_TO_FIRESTORE_CODE[numericCode];
    const statusName = GRPC_STATUS_NAME[numericCode] ?? String(numericCode);
    return new FirestoreReadError(
      mapped,
      `Firestore RPC failed with gRPC ${numericCode} ${statusName}: ${message}`,
      error,
    );
  }

  // 2) UNAUTHENTICATED (gRPC 16) — Google REJECTED the credential itself. The
  // service account key parsed & signed a JWT but is not accepted by Google's
  // token endpoint (rotated/deleted, or issued for a different project). The
  // Admin SDK reports this during the token preflight as
  // `app/invalid-credential` with an `invalid_grant` body. This is an
  // AUTHENTICATION problem and must NOT be confused with permission-denied (an
  // IAM / security-rules AUTHORIZATION problem) — they remediate differently.
  const isUnauthenticated =
    rawCode === "app/invalid-credential" ||
    rawCode === "unauthenticated" ||
    rawCode === "UNAUTHENTICATED" ||
    /unauthenticated|invalid_grant|invalid authentication credentials|account not found|Could not refresh access token/i.test(
      message,
    );

  if (isUnauthenticated) {
    return new FirestoreReadError(
      "unauthenticated",
      "Google rejected the service account credential (gRPC 16 UNAUTHENTICATED / invalid_grant). " +
        "The key is well-formed but not accepted — it is most likely rotated, deleted, or issued for a " +
        "different project. Replace FIREBASE_SERVICE_ACCOUNT_KEY with a current key for the target project.",
      error,
    );
  }

  // 3) String-coded / message-only variants of the recognised statuses.
  if (rawCode === "permission-denied" || /permission|PERMISSION_DENIED|insufficient/i.test(message)) {
    return new FirestoreReadError(
      "permission-denied",
      "Firestore denied the read. Check the service account IAM role and security rules.",
      error,
    );
  }
  if (rawCode === "not-found" || /NOT_FOUND|does not exist|no such/i.test(message)) {
    return new FirestoreReadError(
      "not-found",
      `Firestore reported NOT_FOUND. Check the database id, collection path and resource: ${message}`,
      error,
    );
  }
  if (rawCode === "failed-precondition" || /FAILED_PRECONDITION|requires an index|index/i.test(message)) {
    return new FirestoreReadError(
      "failed-precondition",
      `Firestore FAILED_PRECONDITION (often a missing composite index): ${message}`,
      error,
    );
  }
  if (rawCode === "invalid-argument" || /INVALID_ARGUMENT/i.test(message)) {
    return new FirestoreReadError(
      "invalid-argument",
      `Firestore INVALID_ARGUMENT (malformed query/path): ${message}`,
      error,
    );
  }
  if (rawCode === "unavailable" || /UNAVAILABLE/i.test(message)) {
    return new FirestoreReadError(
      "unavailable",
      `Firestore UNAVAILABLE (transient backend error, retry later): ${message}`,
      error,
    );
  }
  if (rawCode === "deadline-exceeded" || /DEADLINE_EXCEEDED|deadline/i.test(message)) {
    return new FirestoreReadError(
      "deadline-exceeded",
      `Firestore DEADLINE_EXCEEDED (request timed out): ${message}`,
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
