// =============================================================
// Firestore snapshot -> Portfolio ViewModel conversion layer.
//
// Purpose (Phase: live snapshot wiring):
//   The server read layer (`getLatestPortfolioSnapshot`) returns a
//   `PortfolioSnapshotRecord` whose `data` is the RAW, snake_case document that
//   bs-report-auto persists to the `portfolio_snapshots` collection. The
//   existing UI / charts / calculations only understand the camelCase
//   `PortfolioSnapshot` view model. This module is the ONLY place that bridges
//   the two.
//
//   Firestore Snapshot  ->  [this module]  ->  Portfolio ViewModel  ->  UI
//
//   The UI never imports anything Firestore-specific; it keeps consuming the
//   same `PortfolioSnapshot` shape it already does.
//
// Rules (mirrors the Phase C/D contract adapter):
//   - READ / TRANSFORM ONLY. No monetary value is recomputed here.
//   - The eight canonical totals are mapped VERBATIM (snake_case -> camelCase)
//     and also stamped onto `authoritativeTotals` so the runtime reconciler
//     (`reconcilePortfolioTotals`) consumes them as-is instead of recomputing.
//   - Unlike the strict contract adapter, this mapper tolerates a missing
//     `document_version` (the server read contract marks it optional). When a
//     version is absent we still map the document; downstream behaviour is
//     identical because only the totals/holdings/cash rows drive the UI.
//
// This file deals only with plain data types, so it is safe to import from a
// server route handler (it pulls in no server-only credentials).
// =============================================================

import type {
  PortfolioSnapshotCashAsset,
  PortfolioSnapshotDocument,
  PortfolioSnapshotHolding,
  PortfolioSnapshotRecord,
} from "./types";
import type {
  FinanceAsset,
  Holding,
  PortfolioAuthoritativeTotals,
  PortfolioSnapshot,
} from "../portfolio-types";

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

function mapHolding(raw: PortfolioSnapshotHolding, index: number): Holding {
  // Field renaming only (snake_case -> camelCase). No value is derived here.
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

function mapCashAsset(raw: PortfolioSnapshotCashAsset, index: number): FinanceAsset {
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
 * Whether a snapshot document carries the canonical pre-computed totals. When
 * present they are authoritative and the runtime must not recompute them.
 */
function hasTotals(document: PortfolioSnapshotDocument): boolean {
  return Boolean(document.totals && typeof document.totals === "object");
}

/**
 * Convert a server `PortfolioSnapshotRecord` (raw Firestore document + id) into
 * the existing `PortfolioSnapshot` view model consumed by the page.
 *
 * The Firestore document ID is the snapshot date (YYYY-MM-DD); we prefer the
 * document's own `snapshot_date` field but fall back to the id when absent.
 */
export function mapPortfolioSnapshotRecordToViewModel(
  record: PortfolioSnapshotRecord,
): PortfolioSnapshot {
  const { id, data } = record;
  const snapshotDate = optionalString(data.snapshot_date) ?? id;

  const holdings = (data.holdings ?? []).map(mapHolding);
  const financeAssets = (data.cash_assets ?? []).map(mapCashAsset);

  const totals = data.totals;
  // Map the eight canonical totals VERBATIM (snake_case -> camelCase). Default
  // to 0 only as a type-safety guard; in practice the producer always writes them.
  const totalAssetsKRW = num(totals?.total_assets_krw);
  const totalInvestmentsKRW = num(totals?.total_investments_krw);
  const investmentPrincipalKRW = num(totals?.investment_principal_krw);
  const returnAmountKRW = num(totals?.return_amount_krw);
  const returnPct = num(totals?.return_pct);
  const totalCashKRW = num(totals?.total_cash_krw);
  const totalDebtKRW = num(totals?.total_debt_krw);
  const netWorthKRW = num(totals?.net_worth_krw);

  // Only stamp authoritative totals when the document actually provides them.
  // This keeps the "consume verbatim, never recompute" guarantee while letting
  // the legacy reconcile path handle a (rare) totals-less document.
  const authoritativeTotals: PortfolioAuthoritativeTotals | undefined = hasTotals(data)
    ? {
        totalAssetsKRW,
        totalInvestmentsKRW,
        investmentPrincipalKRW,
        returnAmountKRW,
        returnPct,
        totalCashKRW,
        totalDebtKRW,
        netWorthKRW,
        source: "firestore-contract",
        documentVersion: optionalString(data.document_version) ?? "unknown",
      }
    : undefined;

  return {
    id,
    snapshotDate,
    sourceFileName: optionalString(data.source_file_name) ?? "firestore-snapshot",
    // canonical totals, verbatim
    totalAssetKRW: totalAssetsKRW,
    totalDebtKRW,
    netAssetKRW: netWorthKRW,
    investmentPrincipalKRW,
    investmentValueKRW: totalInvestmentsKRW,
    returnAmountKRW,
    returnPct,
    holdings,
    financeAssets,
    createdAt: optionalString(data.generated_at) ?? new Date(0).toISOString(),
    authoritativeTotals,
    metadata: {
      parserVersion:
        optionalString(data.metadata?.parser_version) ??
        `firestore-snapshot-${optionalString(data.document_version) ?? "unknown"}`,
      excludedSmallCount: num(data.metadata?.excluded_small_count),
      excludedBelowMinimumCount: num(data.metadata?.excluded_below_minimum_count),
      excludedHoldingValueKRW: num(data.metadata?.excluded_holding_value_krw),
      liveViewVersion: `firestore-snapshot-${optionalString(data.document_version) ?? "unknown"}`,
    },
  };
}
