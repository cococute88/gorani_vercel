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

import { FirestoreReadError, devLog } from "./errors";

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
