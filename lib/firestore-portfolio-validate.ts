// =============================================================
// Firestore Portfolio Contract — developer-only validation.
//
// Phase F, Blocker 3: lets a developer validate a REAL contract document
// before any production switch. It:
//   - validates `document_version` (1.0.0 / 1.1.0)
//   - validates required fields are present and well typed
//   - validates the eight authoritative totals are internally consistent
//   - reports every mismatch
//
// STRICTLY read/transform only:
//   - NO writes, NO uploads, NO store mutation.
//   - The live reader is gated behind an explicit developer opt-in.
//
// The contract is authoritative: total divergence is reported as an issue
// (producer-side bug signal) but the contract values are never "corrected".
// =============================================================

import { collection, getDocs, limit, query } from "firebase/firestore";
import { firestoreDb } from "./firebase/client";
import {
  FIRESTORE_PORTFOLIO_CONTRACT_VERSIONS,
  validateDocumentVersion,
  type FirestorePortfolioContractDocument,
} from "./firestore-portfolio-contract";
import { PORTFOLIO_CONTRACT_COLLECTION } from "./firestore-portfolio-adapter";

export type ContractValidationSeverity = "error" | "warning";

export interface ContractValidationIssue {
  severity: ContractValidationSeverity;
  code: string;
  message: string;
}

export interface ContractValidationReport {
  ok: boolean; // true when there are no `error`-severity issues
  documentId?: string;
  documentVersion: string | null;
  issues: ContractValidationIssue[];
  checkedFields: number;
}

// Tolerance for monetary comparisons (KRW). Producer rounding can differ by a
// few won; that is acceptable. Larger gaps indicate a real divergence.
const KRW_TOLERANCE = 1;
// Tolerance for percentage comparisons (percentage points).
const PCT_TOLERANCE = 0.05;

const REQUIRED_TOTAL_FIELDS = [
  "total_assets_krw",
  "total_investments_krw",
  "investment_principal_krw",
  "return_amount_krw",
  "return_pct",
  "total_cash_krw",
  "total_debt_krw",
  "net_worth_krw",
] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function approxEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Validate a single raw contract document. Pure: no I/O, no mutation.
 */
export function validateContractDocument(
  raw: unknown,
  options: { documentId?: string } = {},
): ContractValidationReport {
  const issues: ContractValidationIssue[] = [];
  let checkedFields = 0;

  const error = (code: string, message: string) =>
    issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) =>
    issues.push({ severity: "warning", code, message });

  if (!raw || typeof raw !== "object") {
    error("document_not_object", "Contract document is not an object.");
    return { ok: false, documentId: options.documentId, documentVersion: null, issues, checkedFields };
  }

  const doc = raw as Partial<FirestorePortfolioContractDocument> & Record<string, unknown>;

  // --- document_version ---
  checkedFields += 1;
  const versionCheck = validateDocumentVersion(doc.document_version);
  const documentVersion = versionCheck.version;
  if (!versionCheck.ok) {
    error(
      "document_version_invalid",
      versionCheck.reason === "missing"
        ? "`document_version` is missing."
        : `Unsupported document_version "${String(doc.document_version)}". Supported: ${FIRESTORE_PORTFOLIO_CONTRACT_VERSIONS.join(", ")}.`,
    );
  }

  // --- snapshot_date ---
  checkedFields += 1;
  if (typeof doc.snapshot_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(doc.snapshot_date)) {
    error("snapshot_date_invalid", "`snapshot_date` must be a YYYY-MM-DD string.");
  }

  // --- totals object + each required field ---
  const totals = doc.totals as Record<string, unknown> | undefined;
  if (!totals || typeof totals !== "object") {
    error("totals_missing", "`totals` object is missing.");
    return { ok: false, documentId: options.documentId, documentVersion, issues, checkedFields };
  }

  for (const field of REQUIRED_TOTAL_FIELDS) {
    checkedFields += 1;
    if (!isFiniteNumber(totals[field])) {
      error("total_field_invalid", `totals.${field} must be a finite number.`);
    }
  }

  // If any required total is invalid, skip consistency checks (they'd be noise).
  const allTotalsNumeric = REQUIRED_TOTAL_FIELDS.every((f) => isFiniteNumber(totals[f]));
  if (allTotalsNumeric) {
    const totalAssets = totals.total_assets_krw as number;
    const totalInvestments = totals.total_investments_krw as number;
    const principal = totals.investment_principal_krw as number;
    const returnAmount = totals.return_amount_krw as number;
    const returnPct = totals.return_pct as number;
    const totalCash = totals.total_cash_krw as number;
    const totalDebt = totals.total_debt_krw as number;
    const netWorth = totals.net_worth_krw as number;

    // return_amount_krw ≈ total_investments_krw - investment_principal_krw
    checkedFields += 1;
    if (!approxEqual(returnAmount, totalInvestments - principal, KRW_TOLERANCE)) {
      warn(
        "return_amount_divergence",
        `return_amount_krw (${returnAmount}) != total_investments_krw - investment_principal_krw (${totalInvestments - principal}).`,
      );
    }

    // return_pct ≈ return_amount_krw / investment_principal_krw * 100
    checkedFields += 1;
    if (principal > 0) {
      const expectedPct = (returnAmount / principal) * 100;
      if (!approxEqual(returnPct, expectedPct, PCT_TOLERANCE)) {
        warn(
          "return_pct_divergence",
          `return_pct (${returnPct}) != return_amount_krw / investment_principal_krw * 100 (${expectedPct.toFixed(4)}).`,
        );
      }
    }

    // total_cash_krw ≈ total_assets_krw - total_investments_krw
    checkedFields += 1;
    if (!approxEqual(totalCash, totalAssets - totalInvestments, KRW_TOLERANCE)) {
      warn(
        "total_cash_divergence",
        `total_cash_krw (${totalCash}) != total_assets_krw - total_investments_krw (${totalAssets - totalInvestments}).`,
      );
    }

    // net_worth_krw ≈ total_assets_krw - total_debt_krw
    checkedFields += 1;
    if (!approxEqual(netWorth, totalAssets - totalDebt, KRW_TOLERANCE)) {
      warn(
        "net_worth_divergence",
        `net_worth_krw (${netWorth}) != total_assets_krw - total_debt_krw (${totalAssets - totalDebt}).`,
      );
    }
  }

  // --- detail rows (shape only; optional) ---
  if (doc.holdings !== undefined && !Array.isArray(doc.holdings)) {
    error("holdings_not_array", "`holdings` must be an array when present.");
  }
  if (doc.cash_assets !== undefined && !Array.isArray(doc.cash_assets)) {
    error("cash_assets_not_array", "`cash_assets` must be an array when present.");
  }

  const ok = issues.every((issue) => issue.severity !== "error");
  return { ok, documentId: options.documentId, documentVersion, issues, checkedFields };
}

/**
 * DEVELOPER-ONLY live validation. Reads ONE real contract document from
 * Firestore (read only) and validates it. Requires an explicit opt-in so it can
 * never run as part of normal app flow.
 *
 * Returns null when the developer opt-in is absent or no document is found.
 */
export async function validateLivePortfolioContract(
  uid: string,
  options: { devOptIn: true; documentId?: string },
): Promise<ContractValidationReport | null> {
  if (!options || options.devOptIn !== true) {
    // Hard guard: refuse to run without the explicit developer opt-in.
    return null;
  }
  if (!firestoreDb) {
    throw new Error("Firebase is not configured");
  }
  const snap = await getDocs(
    query(collection(firestoreDb, "users", uid, PORTFOLIO_CONTRACT_COLLECTION), limit(1)),
  );
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return validateContractDocument(docSnap.data(), { documentId: docSnap.id });
}
