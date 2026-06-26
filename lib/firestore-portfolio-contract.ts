// =============================================================
// Firestore Portfolio Contract (read side) — Phase C.
//
// This module defines the *finalized* Firestore snapshot contract that is
// produced by the upstream `bs-report-auto` pipeline (DO NOT modify that repo)
// and the pure mapping from that contract into the existing Portfolio Manager
// view model (`PortfolioSnapshot`).
//
// Contract ownership:
//   - bs-report-auto OWNS the numbers. It pre-computes every monetary total.
//   - gorani_vercel only READS and maps. No total is recomputed here.
//
// Scope rules for Phase C (enforced by this module):
//   - Validate `document_version` (only 1.0.0 and 1.1.0 are supported).
//   - Map document -> existing models with simple field mapping only.
//   - The eight canonical totals are consumed verbatim; never recomputed.
//   - No writes. This file is read/transform only.
// =============================================================

import type {
  FinanceAsset,
  Holding,
  PortfolioSnapshot,
} from "./portfolio-types";

// ---- Supported contract versions -----------------------------------------

export const FIRESTORE_PORTFOLIO_CONTRACT_VERSIONS = ["1.0.0", "1.1.0"] as const;
export type FirestorePortfolioContractVersion =
  (typeof FIRESTORE_PORTFOLIO_CONTRACT_VERSIONS)[number];

// ---- Contract document shape (snake_case, as written by bs-report-auto) ----

/**
 * The eight canonical, pre-computed monetary fields. These are OWNED by
 * bs-report-auto and MUST be consumed verbatim. gorani_vercel never recomputes
 * any of these in the adapter.
 */
export interface FirestorePortfolioTotals {
  total_assets_krw: number;
  total_investments_krw: number;
  investment_principal_krw: number;
  return_amount_krw: number;
  return_pct: number;
  total_cash_krw: number;
  total_debt_krw: number;
  net_worth_krw: number;
}

/** A single holding row in the contract document. */
export interface FirestorePortfolioHolding {
  id?: string;
  broker?: string;
  account_name?: string;
  asset_type?: string;
  product_name?: string;
  clean_name?: string;
  ticker?: string;
  tag?: string;
  principal_krw?: number;
  value_krw?: number;
  return_pct?: number;
  quantity?: number;
  average_price?: number;
  currency?: string;
  current_price?: number;
  category?: string;
  // 1.1.0 enriched tag groups (absent in 1.0.0).
  symbol_group?: string;
  account_group?: string;
  purpose_group?: string;
  status_group?: string;
}

/** A single cash / finance-asset (or debt) row in the contract document. */
export interface FirestorePortfolioCashAsset {
  id?: string;
  group_name?: string;
  product_name?: string;
  clean_name?: string;
  amount_krw?: number;
  inferred_tag?: string;
  category?: string;
  is_debt?: boolean;
  // 1.1.0 enriched tag groups (absent in 1.0.0).
  symbol_group?: string;
  account_group?: string;
  purpose_group?: string;
  status_group?: string;
}

export interface FirestorePortfolioContractDocument {
  /** REQUIRED. Must be one of FIRESTORE_PORTFOLIO_CONTRACT_VERSIONS. */
  document_version: string;
  /** YYYY-MM-DD. The "as of" date of the snapshot. */
  snapshot_date: string;
  source_file_name?: string;
  generated_at?: string;
  totals: FirestorePortfolioTotals;
  holdings?: FirestorePortfolioHolding[];
  cash_assets?: FirestorePortfolioCashAsset[];
  metadata?: {
    parser_version?: string;
    excluded_small_count?: number;
    excluded_below_minimum_count?: number;
    excluded_holding_value_krw?: number;
    [key: string]: unknown;
  };
}

// ---- Version validation ----------------------------------------------------

export interface DocumentVersionValidation {
  ok: boolean;
  version: string | null;
  supported: FirestorePortfolioContractVersion | null;
  reason?: "missing" | "unsupported";
}

export function validateDocumentVersion(
  rawVersion: unknown,
): DocumentVersionValidation {
  if (typeof rawVersion !== "string" || rawVersion.trim() === "") {
    return { ok: false, version: null, supported: null, reason: "missing" };
  }
  const version = rawVersion.trim();
  const supported = FIRESTORE_PORTFOLIO_CONTRACT_VERSIONS.find((v) => v === version);
  if (!supported) {
    return { ok: false, version, supported: null, reason: "unsupported" };
  }
  return { ok: true, version, supported };
}

// ---- Pure mapping: contract document -> PortfolioSnapshot ------------------

export interface ContractMappingWarning {
  code: string;
  message: string;
}

export interface MappedPortfolioContract {
  /** The existing Portfolio Manager view model, mapped 1:1 from the contract. */
  snapshot: PortfolioSnapshot;
  /**
   * The eight canonical totals, preserved verbatim from the contract for
   * consumers that want the contract numbers without any downstream
   * re-derivation. This proves the adapter never recomputes them.
   */
  contractTotals: {
    totalAssetsKRW: number;
    totalInvestmentsKRW: number;
    investmentPrincipalKRW: number;
    returnAmountKRW: number;
    returnPct: number;
    totalCashKRW: number;
    totalDebtKRW: number;
    netWorthKRW: number;
  };
  documentVersion: FirestorePortfolioContractVersion;
  warnings: ContractMappingWarning[];
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapHolding(
  raw: FirestorePortfolioHolding,
  index: number,
): Holding {
  // Field mapping only. No monetary value is derived here.
  return {
    id: optionalString(raw.id) ?? `fs-holding-${index}`,
    broker: optionalString(raw.broker) ?? "",
    accountName: optionalString(raw.account_name),
    assetType: optionalString(raw.asset_type) ?? "",
    productName: optionalString(raw.product_name) ?? "",
    cleanName: optionalString(raw.clean_name),
    ticker: optionalString(raw.ticker),
    tag: optionalString(raw.tag),
    principalKRW: num(raw.principal_krw),
    valueKRW: num(raw.value_krw),
    returnPct: optionalNumber(raw.return_pct),
    quantity: optionalNumber(raw.quantity),
    averagePrice: optionalNumber(raw.average_price),
    currency: optionalString(raw.currency),
    currentPrice: optionalNumber(raw.current_price),
    category: optionalString(raw.category),
    symbolGroup: optionalString(raw.symbol_group),
    accountGroup: optionalString(raw.account_group),
    purposeGroup: optionalString(raw.purpose_group),
    statusGroup: optionalString(raw.status_group),
  };
}

function mapCashAsset(
  raw: FirestorePortfolioCashAsset,
  index: number,
): FinanceAsset {
  return {
    id: optionalString(raw.id) ?? `fs-cash-${index}`,
    groupName: optionalString(raw.group_name) ?? "",
    productName: optionalString(raw.product_name) ?? "",
    cleanName: optionalString(raw.clean_name),
    amountKRW: num(raw.amount_krw),
    inferredTag: optionalString(raw.inferred_tag),
    category: optionalString(raw.category) as FinanceAsset["category"],
    isDebt: raw.is_debt === true ? true : undefined,
    symbolGroup: optionalString(raw.symbol_group),
    accountGroup: optionalString(raw.account_group),
    purposeGroup: optionalString(raw.purpose_group),
    statusGroup: optionalString(raw.status_group),
  };
}

/**
 * Map a validated contract document into the existing PortfolioSnapshot model.
 *
 * IMPORTANT: every monetary total is taken VERBATIM from `document.totals`.
 * The only transformation is naming (snake_case -> camelCase). No sums, no
 * percentages, no reconciliation happen here. Those remain the responsibility
 * of bs-report-auto (totals) and of the existing gorani_vercel runtime
 * (chart/MDD/CAGR derivations downstream).
 */
export function mapContractToSnapshot(
  document: FirestorePortfolioContractDocument,
  options: { docId?: string } = {},
): MappedPortfolioContract {
  const warnings: ContractMappingWarning[] = [];

  const validation = validateDocumentVersion(document.document_version);
  if (!validation.ok || !validation.supported) {
    throw new Error(
      validation.reason === "missing"
        ? "Firestore portfolio contract document is missing `document_version`."
        : `Unsupported Firestore portfolio contract version: ${String(document.document_version)}. Supported: ${FIRESTORE_PORTFOLIO_CONTRACT_VERSIONS.join(", ")}.`,
    );
  }

  const totals = document.totals;
  if (!totals || typeof totals !== "object") {
    throw new Error("Firestore portfolio contract document is missing `totals`.");
  }

  // Consume the eight canonical totals VERBATIM (snake_case -> camelCase only).
  const contractTotals = {
    totalAssetsKRW: num(totals.total_assets_krw),
    totalInvestmentsKRW: num(totals.total_investments_krw),
    investmentPrincipalKRW: num(totals.investment_principal_krw),
    returnAmountKRW: num(totals.return_amount_krw),
    returnPct: num(totals.return_pct),
    totalCashKRW: num(totals.total_cash_krw),
    totalDebtKRW: num(totals.total_debt_krw),
    netWorthKRW: num(totals.net_worth_krw),
  };

  const holdings = (document.holdings ?? []).map(mapHolding);
  const financeAssets = (document.cash_assets ?? []).map(mapCashAsset);

  if (validation.supported === "1.0.0") {
    // 1.0.0 does not carry enriched per-row tag groups; downstream classifiers
    // fall back to product/account names. Surface this as info, not an error.
    warnings.push({
      code: "contract_v1_0_0_minimal_tags",
      message:
        "document_version 1.0.0: per-holding tag groups are not provided; account/purpose classification uses name-based fallbacks.",
    });
  }

  const snapshot: PortfolioSnapshot = {
    id: optionalString(options.docId) ?? `fs-${document.snapshot_date}`,
    snapshotDate: document.snapshot_date,
    sourceFileName: optionalString(document.source_file_name) ?? "firestore-contract",
    // ---- canonical totals, mapped verbatim from the contract ----
    totalAssetKRW: contractTotals.totalAssetsKRW,
    totalDebtKRW: contractTotals.totalDebtKRW,
    netAssetKRW: contractTotals.netWorthKRW,
    investmentPrincipalKRW: contractTotals.investmentPrincipalKRW,
    investmentValueKRW: contractTotals.totalInvestmentsKRW,
    returnAmountKRW: contractTotals.returnAmountKRW,
    returnPct: contractTotals.returnPct,
    // ---- detail rows ----
    holdings,
    financeAssets,
    createdAt: optionalString(document.generated_at) ?? new Date(0).toISOString(),
    // Phase D: mark these totals as authoritative so the runtime consumes them
    // verbatim instead of recomputing (see reconcilePortfolioTotals).
    authoritativeTotals: {
      totalAssetsKRW: contractTotals.totalAssetsKRW,
      totalInvestmentsKRW: contractTotals.totalInvestmentsKRW,
      investmentPrincipalKRW: contractTotals.investmentPrincipalKRW,
      returnAmountKRW: contractTotals.returnAmountKRW,
      returnPct: contractTotals.returnPct,
      totalCashKRW: contractTotals.totalCashKRW,
      totalDebtKRW: contractTotals.totalDebtKRW,
      netWorthKRW: contractTotals.netWorthKRW,
      source: "firestore-contract",
      documentVersion: validation.supported,
    },
    metadata: {
      parserVersion:
        optionalString(document.metadata?.parser_version) ?? `firestore-contract-${validation.supported}`,
      excludedSmallCount: num(document.metadata?.excluded_small_count),
      excludedBelowMinimumCount: num(document.metadata?.excluded_below_minimum_count),
      excludedHoldingValueKRW: num(document.metadata?.excluded_holding_value_krw),
      liveViewVersion: `firestore-contract-${validation.supported}`,
    },
  };

  return {
    snapshot,
    contractTotals,
    documentVersion: validation.supported,
    warnings,
  };
}
