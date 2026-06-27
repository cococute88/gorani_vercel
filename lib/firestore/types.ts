// =============================================================
// Firestore `portfolio_snapshots` document types (server read side).
//
// These types describe — VERBATIM — the documents that the upstream
// `bs-report-auto` pipeline writes to the top-level Firestore collection
// `portfolio_snapshots`. The Firestore document ID is the snapshot date
// (YYYY-MM-DD).
//
// Scope / ownership:
//   - bs-report-auto OWNS the data and the numbers. This module only READS.
//   - These types mirror the persisted (snake_case) JSON shape exactly so the
//     server read layer stays type-safe without using `any`.
//
// IMPORTANT: this directory (`lib/firestore`) is the server-only Firebase Admin
// data layer. It is intentionally separate from the existing client-SDK code
// in `lib/firebase` and `lib/firestore-portfolio-*` (Phase C contract reader).
// =============================================================

/** Top-level collection that bs-report-auto writes portfolio snapshots into. */
export const PORTFOLIO_SNAPSHOTS_COLLECTION = "portfolio_snapshots" as const;

/** YYYY-MM-DD date string. Used as the Firestore document ID. */
export type SnapshotDate = string;

/**
 * The eight canonical, pre-computed monetary totals. These are OWNED by
 * bs-report-auto and consumed verbatim. The server layer never recomputes them.
 */
export interface PortfolioSnapshotTotals {
  total_assets_krw: number;
  total_investments_krw: number;
  investment_principal_krw: number;
  return_amount_krw: number;
  return_pct: number;
  total_cash_krw: number;
  total_debt_krw: number;
  net_worth_krw: number;
}

/** A single investment holding row in a snapshot document. */
export interface PortfolioSnapshotHolding {
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
  symbol_group?: string;
  account_group?: string;
  purpose_group?: string;
  status_group?: string;
}

/** A single cash / finance-asset (or debt) row in a snapshot document. */
export interface PortfolioSnapshotCashAsset {
  id?: string;
  group_name?: string;
  product_name?: string;
  clean_name?: string;
  amount_krw?: number;
  inferred_tag?: string;
  category?: string;
  is_debt?: boolean;
  symbol_group?: string;
  account_group?: string;
  purpose_group?: string;
  status_group?: string;
}

/** Optional producer metadata attached to a snapshot document. */
export interface PortfolioSnapshotMetadata {
  parser_version?: string;
  excluded_small_count?: number;
  excluded_below_minimum_count?: number;
  excluded_holding_value_krw?: number;
  [key: string]: unknown;
}

/**
 * A single `portfolio_snapshots/{YYYY-MM-DD}` document, exactly as persisted by
 * bs-report-auto (snake_case field names).
 */
export interface PortfolioSnapshotDocument {
  /** Contract version stamped by the producer (e.g. "1.0.0" / "1.1.0"). */
  document_version?: string;
  /** YYYY-MM-DD "as of" date of the snapshot. Should equal the document ID. */
  snapshot_date?: SnapshotDate;
  source_file_name?: string;
  generated_at?: string;
  totals?: PortfolioSnapshotTotals;
  holdings?: PortfolioSnapshotHolding[];
  cash_assets?: PortfolioSnapshotCashAsset[];
  metadata?: PortfolioSnapshotMetadata;
}

/**
 * A snapshot document paired with its Firestore document ID (the date).
 * This is the value returned by the server read layer.
 */
export interface PortfolioSnapshotRecord {
  /** Firestore document ID, i.e. the snapshot date (YYYY-MM-DD). */
  id: SnapshotDate;
  /** The raw document data, typed to the persisted contract shape. */
  data: PortfolioSnapshotDocument;
}
