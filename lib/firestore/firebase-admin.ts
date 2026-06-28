// =============================================================
// Firebase Admin (server-only) singleton initialization.
//
// This module initializes the Firebase Admin SDK exactly once per server
// runtime and exposes a single `getAdminFirestore()` accessor. The Admin SDK is
// used so all Firestore access happens on the SERVER with a service account —
// the client SDK is never used here.
//
// Credentials: a service account JSON, provided via the
// `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable. The value may be either:
//   - the raw JSON string, or
//   - a base64-encoded JSON string (convenient for single-line env vars).
//
// SERVER ONLY: this file must never be imported into a client component.
// =============================================================

import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { FirestoreReadError, classifyAdminError, describeError, devLog } from "./errors";

/** Env var holding the service account JSON (raw or base64-encoded). */
const SERVICE_ACCOUNT_ENV = "FIREBASE_SERVICE_ACCOUNT_KEY";
/** Named Admin app so we never collide with any other Admin initialization. */
const ADMIN_APP_NAME = "gorani-portfolio-admin";

interface RawServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

/**
 * Read and parse the service account JSON from the environment.
 * Throws a typed FirestoreReadError so callers can distinguish a missing
 * configuration from malformed JSON.
 */
function loadServiceAccount(): ServiceAccount {
  const raw = process.env[SERVICE_ACCOUNT_ENV];
  if (!raw || raw.trim() === "") {
    throw new FirestoreReadError(
      "config-missing",
      `Missing ${SERVICE_ACCOUNT_ENV}. Set it to the service account JSON (raw or base64).`,
    );
  }

  // Accept either raw JSON or base64-encoded JSON.
  let jsonText = raw.trim();
  if (!jsonText.startsWith("{")) {
    try {
      jsonText = Buffer.from(jsonText, "base64").toString("utf8");
    } catch (error) {
      throw new FirestoreReadError(
        "service-account-json-invalid",
        `${SERVICE_ACCOUNT_ENV} is not valid base64-encoded JSON.`,
        error,
      );
    }
  }

  let parsed: RawServiceAccount;
  try {
    parsed = JSON.parse(jsonText) as RawServiceAccount;
  } catch (error) {
    throw new FirestoreReadError(
      "service-account-json-invalid",
      `${SERVICE_ACCOUNT_ENV} does not contain valid JSON.`,
      error,
    );
  }

  const projectId = parsed.project_id;
  const clientEmail = parsed.client_email;
  // Env-stored private keys typically have escaped newlines; restore them.
  const privateKey = parsed.private_key?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // JSON parsed fine but is not a usable service account.
    throw new FirestoreReadError(
      "invalid-service-account",
      `${SERVICE_ACCOUNT_ENV} is missing required fields (project_id, client_email, private_key).`,
    );
  }

  return { projectId, clientEmail, privateKey };
}

/**
 * The non-sensitive identity of the service account the Admin SDK was
 * initialized with. NEVER contains `private_key`. Exposed for diagnostics so a
 * caller (e.g. the API route / read layer) can log which account was used.
 */
export interface AdminAccountDiagnostics {
  projectId: string;
  clientEmail: string;
}

let adminAccountDiagnostics: AdminAccountDiagnostics | null = null;

/**
 * Return the non-sensitive identity (projectId, client_email) of the service
 * account the Admin SDK initialized with, or `null` if it has not been
 * initialized yet. Safe to log — contains no credentials.
 */
export function getAdminAccountDiagnostics(): AdminAccountDiagnostics | null {
  return adminAccountDiagnostics;
}

/**
 * Return the singleton Admin app, initializing it on first use. Reuses an
 * already-initialized app (e.g. across Next.js hot reloads / serverless reuse)
 * so it is never initialized twice.
 */
function getAdminApp(): App {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  const serviceAccount = loadServiceAccount();

  // Record the non-sensitive identity for diagnostics. NEVER store private_key.
  adminAccountDiagnostics = {
    projectId: serviceAccount.projectId ?? "",
    clientEmail: serviceAccount.clientEmail ?? "",
  };
  // Requirement 4: confirm which service account is in use (no private_key).
  devLog("admin", "Resolved service account", {
    projectId: adminAccountDiagnostics.projectId,
    clientEmail: adminAccountDiagnostics.clientEmail,
  });

  let app: App;
  try {
    app = initializeApp(
      {
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      },
      ADMIN_APP_NAME,
    );
  } catch (error) {
    // initializeApp / cert can throw on a malformed credential.
    throw new FirestoreReadError(
      "admin-init-failed",
      "Firebase Admin SDK failed to initialize with the provided service account.",
      error,
    );
  }

  devLog("admin", "Initialized Firebase Admin app", {
    projectId: serviceAccount.projectId,
    initialized: true,
  });
  return app;
}

let firestoreSingleton: Firestore | null = null;

/**
 * Server-only accessor for the Admin Firestore instance. Safe to call many
 * times; the underlying app and Firestore handle are created once.
 */
export function getAdminFirestore(): Firestore {
  if (firestoreSingleton) return firestoreSingleton;
  // getApp will return the named app if present; getAdminApp guarantees it.
  const app = getApps().some((a) => a.name === ADMIN_APP_NAME)
    ? getApp(ADMIN_APP_NAME)
    : getAdminApp();
  try {
    firestoreSingleton = getFirestore(app);
  } catch (error) {
    // A FirestoreReadError from getAdminApp() flows through unchanged; only a
    // raw getFirestore() failure is wrapped as an init failure here.
    if (error instanceof FirestoreReadError) throw error;
    throw new FirestoreReadError(
      "admin-init-failed",
      "Failed to obtain the Admin Firestore instance.",
      error,
    );
  }
  return firestoreSingleton;
}

/**
 * Lightweight check used by callers/health checks to know whether the server
 * Firestore credentials are present, without throwing.
 */
export function isAdminFirestoreConfigured(): boolean {
  const raw = process.env[SERVICE_ACCOUNT_ENV];
  return Boolean(raw && raw.trim() !== "");
}

// ---------------------------------------------------------------------------
// Credential preflight.
//
// WHY THIS EXISTS: when the service account JSON is well-formed and the private
// key can sign a JWT, `initializeApp()` and `getFirestore()` BOTH succeed even
// if Google ultimately rejects the credential. The failure only surfaces deep
// inside the first Firestore RPC as an opaque `16 UNAUTHENTICATED` gRPC error.
//
// Forcing an OAuth2 access-token fetch up front converts that into the precise,
// actionable cause — e.g. `invalid_grant (Invalid grant: account not found)`,
// reported by the Admin SDK as `app/invalid-credential` — so logs point at the
// credential (rotated/deleted/wrong project) instead of misleading the operator
// toward IAM roles or security rules.
//
// The token itself is NEVER logged. The result is cached as a promise so the
// network round-trip happens at most once per server runtime (a valid key is
// verified once; subsequent reads reuse the SDK's own token cache).
// ---------------------------------------------------------------------------

let credentialPreflight: Promise<void> | null = null;

/**
 * Force the Admin SDK to obtain an access token once, surfacing credential
 * rejection (gRPC 16 / invalid_grant) as a typed FirestoreReadError("unauthenticated")
 * with the real underlying reason. Resolves silently when the credential is
 * accepted. Cached: only the first call performs network I/O.
 */
export async function verifyAdminCredential(): Promise<void> {
  if (credentialPreflight) return credentialPreflight;

  credentialPreflight = (async () => {
    const app = getApps().some((a) => a.name === ADMIN_APP_NAME)
      ? getApp(ADMIN_APP_NAME)
      : getAdminApp();
    try {
      // getAccessToken() performs the JWT->OAuth2 exchange against Google. A
      // bad/rotated/wrong-project key fails here with `app/invalid-credential`.
      await app.options.credential!.getAccessToken();
      // Requirement: confirm Google ACCEPTED the credential. No token logged.
      devLog("admin", "Service account credential accepted by Google", {
        projectId: adminAccountDiagnostics?.projectId,
        clientEmail: adminAccountDiagnostics?.clientEmail,
        tokenAcquired: true,
      });
    } catch (error) {
      // Reset so a later attempt (e.g. after the env var is fixed) can retry.
      credentialPreflight = null;
      const info = describeError(error);
      devLog("admin", "Service account credential REJECTED by Google", {
        projectId: adminAccountDiagnostics?.projectId,
        clientEmail: adminAccountDiagnostics?.clientEmail,
        tokenAcquired: false,
        errorName: info.errorName,
        code: info.code,
        // message is safe: the Admin SDK reports invalid_grant text, no secrets.
        message: info.message,
      });
      // classifyAdminError maps gRPC 16 / invalid_grant / app/invalid-credential
      // to the typed "unauthenticated" code with an actionable message.
      throw classifyAdminError(error, "unauthenticated");
    }
  })();

  return credentialPreflight;
}
