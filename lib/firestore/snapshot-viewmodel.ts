// =============================================================
// Firestore snapshot -> Portfolio ViewModel conversion layer.
//
// Purpose (Phase: live snapshot wiring):
//   The server read layer (`getLatestPortfolioSnapshot`) returns a
//   `PortfolioSnapshotRecord` whose `data` is the RAW document that
//   bs-report-auto persists to the `portfolio_snapshots` collection. The
//   existing UI / charts / calculations only understand the camelCase
//   `PortfolioSnapshot` view model. This module is the ONLY place that bridges
//   the two.
//
//   Firestore Snapshot  ->  [this module]  ->  Portfolio ViewModel  ->  UI
//
// Resilience (why this file no longer reads a single hard-coded key per field):
//   The producer document was found in Firestore (`source: "firestore"`) yet
//   every value mapped to 0 / []. That symptom means the document IS there but
//   the field NAMES / NESTING the mapper expected did not match the real
//   document. To make the mapping robust to the most common producer-side
//   variations we now resolve every field through `pick*` helpers that accept,
//   for each logical field:
//     - the canonical snake_case key (e.g. `total_assets_krw`)
//     - the camelCase equivalent  (e.g. `totalAssetsKRW`)
//     - the totals living either nested under `totals` OR flat at the document
//       root.
//   The eight canonical totals are still consumed VERBATIM (read, never
//   recomputed); we only widen *where/under-what-name* we look for them.
//
// READ / TRANSFORM ONLY. No monetary value is recomputed here.
// =============================================================

import type {
  PortfolioSnapshotRecord,
} from "./types";
import type {
  FinanceAsset,
  Holding,
  PortfolioAuthoritativeTotals,
  PortfolioSnapshot,
} from "../portfolio-types";

type RawRecord = Record<string, unknown>;

/** Narrow an unknown value to a plain object (not an array). */
function asRecord(value: unknown): RawRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** Coerce a value to a finite number, tolerating numeric strings. */
function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Return the first finite number found by probing `keys` across one or more
 * source objects (e.g. the nested `totals` object first, then the document
 * root). Returns `undefined` when nothing matches.
 */
function firstOptionalNumber(
  sources: Array<RawRecord | undefined>,
  keys: string[],
): number | undefined {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const candidate = toFiniteNumber(source[key]);
      if (candidate !== undefined) return candidate;
    }
  }
  return undefined;
}

/** Like {@link firstOptionalNumber} but defaults to 0 (type-safety guard). */
function firstNumber(sources: Array<RawRecord | undefined>, keys: string[]): number {
  return firstOptionalNumber(sources, keys) ?? 0;
}

/** Return the first non-empty trimmed string found across sources/keys. */
function firstString(
  sources: Array<RawRecord | undefined>,
  keys: string[],
): string | undefined {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed !== "") return trimmed;
      }
    }
  }
  return undefined;
}

/** Return the first boolean === true match. */
function firstBooleanTrue(source: RawRecord, keys: string[]): boolean | undefined {
  for (const key of keys) {
    if (source[key] === true || source[key] === "true") return true;
  }
  return undefined;
}

/** Return the first array found by probing `keys` on `source`. */
function firstArray(source: RawRecord, keys: string[]): RawRecord[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is RawRecord => asRecord(item) !== undefined);
    }
  }
  return [];
}

// ---- single-row mappers -----------------------------------------------------

function mapHolding(raw: RawRecord, index: number): Holding {
  const s = [raw];
  return {
    id: firstString(s, ["id", "holding_id", "holdingId"]) ?? `fs-holding-${index}`,
    broker: firstString(s, ["broker", "institution", "institution_name", "institutionName"]) ?? "",
    accountName: firstString(s, ["account_name", "accountName"]),
    assetType: firstString(s, ["asset_type", "assetType", "type"]) ?? "",
    productName: firstString(s, ["product_name", "productName", "name"]) ?? "",
    cleanName: firstString(s, ["clean_name", "cleanName"]),
    ticker: firstString(s, ["ticker", "symbol"]),
    tag: firstString(s, ["tag"]),
    principalKRW: firstNumber(s, ["principal_krw", "principalKRW", "principal"]),
    valueKRW: firstNumber(s, ["value_krw", "valueKRW", "value", "evaluation_krw", "eval_krw"]),
    returnPct: firstOptionalNumber(s, ["return_pct", "returnPct", "return_rate", "returnRate"]),
    quantity: firstOptionalNumber(s, ["quantity", "qty", "shares"]),
    averagePrice: firstOptionalNumber(s, ["average_price", "averagePrice", "avg_price", "avgPrice"]),
    currency: firstString(s, ["currency"]),
    currentPrice: firstOptionalNumber(s, ["current_price", "currentPrice", "price"]),
    category: firstString(s, ["category"]),
    symbolGroup: firstString(s, ["symbol_group", "symbolGroup"]),
    accountGroup: firstString(s, ["account_group", "accountGroup"]),
    purposeGroup: firstString(s, ["purpose_group", "purposeGroup"]),
    statusGroup: firstString(s, ["status_group", "statusGroup"]),
  };
}

function mapCashAsset(raw: RawRecord, index: number): FinanceAsset {
  const s = [raw];
  return {
    id: firstString(s, ["id", "asset_id", "assetId"]) ?? `fs-cash-${index}`,
    groupName: firstString(s, ["group_name", "groupName", "group"]) ?? "",
    productName: firstString(s, ["product_name", "productName", "name"]) ?? "",
    cleanName: firstString(s, ["clean_name", "cleanName"]),
    amountKRW: firstNumber(s, ["amount_krw", "amountKRW", "amount", "value_krw", "valueKRW"]),
    inferredTag: firstString(s, ["inferred_tag", "inferredTag"]),
    category: firstString(s, ["category"]) as FinanceAsset["category"],
    isDebt: firstBooleanTrue(raw, ["is_debt", "isDebt"]),
    symbolGroup: firstString(s, ["symbol_group", "symbolGroup"]),
    accountGroup: firstString(s, ["account_group", "accountGroup"]),
    purposeGroup: firstString(s, ["purpose_group", "purposeGroup"]),
    statusGroup: firstString(s, ["status_group", "statusGroup"]),
  };
}

/**
 * Structural summary of a raw document, for diagnostics. No monetary VALUES are
 * included — only field NAMES, types and counts — so it is safe to log / surface
 * without leaking the balances themselves.
 */
export interface SnapshotDocumentShape {
  topLevelKeys: string[];
  totalsKeys: string[] | null;
  resolvedTotalsSource: "nested-totals" | "document-root" | "none";
  holdingsKey: string | null;
  holdingsCount: number;
  holdingsSampleKeys: string[];
  cashKey: string | null;
  cashCount: number;
  cashSampleKeys: string[];
}

const HOLDINGS_KEYS = ["holdings", "investments", "positions", "holding_rows", "holdingRows", "stocks"];
const CASH_KEYS = [
  "cash_assets",
  "cashAssets",
  "finance_assets",
  "financeAssets",
  "assets",
  "cash",
  "cash_rows",
];
const TOTAL_ASSETS_KEYS = ["total_assets_krw", "totalAssetsKRW", "total_asset_krw", "totalAssetKRW"];

/**
 * Inspect a raw document and report WHERE each logical field resolves from.
 * Used by the API route to expose the real document structure for debugging
 * the "connected but empty" symptom.
 */
export function describeSnapshotDocumentShape(data: RawRecord): SnapshotDocumentShape {
  const totals = asRecord(data.totals);
  const holdingsKey = HOLDINGS_KEYS.find((k) => Array.isArray(data[k])) ?? null;
  const cashKey = CASH_KEYS.find((k) => Array.isArray(data[k])) ?? null;
  const holdings = holdingsKey ? (data[holdingsKey] as unknown[]) : [];
  const cash = cashKey ? (data[cashKey] as unknown[]) : [];

  const totalsHasValue =
    totals !== undefined && TOTAL_ASSETS_KEYS.some((k) => toFiniteNumber(totals[k]) !== undefined);
  const rootHasValue = TOTAL_ASSETS_KEYS.some((k) => toFiniteNumber(data[k]) !== undefined);

  return {
    topLevelKeys: Object.keys(data),
    totalsKeys: totals ? Object.keys(totals) : null,
    resolvedTotalsSource: totalsHasValue
      ? "nested-totals"
      : rootHasValue
        ? "document-root"
        : "none",
    holdingsKey,
    holdingsCount: holdings.length,
    holdingsSampleKeys: asRecord(holdings[0]) ? Object.keys(holdings[0] as RawRecord) : [],
    cashKey,
    cashCount: cash.length,
    cashSampleKeys: asRecord(cash[0]) ? Object.keys(cash[0] as RawRecord) : [],
  };
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
  const { id } = record;
  // The persisted document may carry fields the strict type does not list
  // (camelCase variants, flat totals, alternate array names). Treat it as a
  // raw bag here so the resilient pickers can probe every known alias.
  const data = (record.data ?? {}) as RawRecord;

  const snapshotDate = firstString([data], ["snapshot_date", "snapshotDate", "date"]) ?? id;

  const holdings = firstArray(data, HOLDINGS_KEYS).map(mapHolding);
  const financeAssets = firstArray(data, CASH_KEYS).map(mapCashAsset);

  // Totals may be nested under `totals` OR flat at the document root, and may
  // use snake_case or camelCase. Probe nested first, then root, for each field.
  const totals = asRecord(data.totals);
  const totalsSources: Array<RawRecord | undefined> = [totals, data];

  const totalAssetsKRW = firstNumber(totalsSources, TOTAL_ASSETS_KEYS);
  const totalInvestmentsKRW = firstNumber(totalsSources, [
    "total_investments_krw",
    "totalInvestmentsKRW",
    "investment_value_krw",
    "investmentValueKRW",
  ]);
  const investmentPrincipalKRW = firstNumber(totalsSources, [
    "investment_principal_krw",
    "investmentPrincipalKRW",
    "principal_krw",
  ]);
  const returnAmountKRW = firstNumber(totalsSources, [
    "return_amount_krw",
    "returnAmountKRW",
    "profit_krw",
  ]);
  const returnPct = firstNumber(totalsSources, ["return_pct", "returnPct", "return_rate"]);
  const totalCashKRW = firstNumber(totalsSources, ["total_cash_krw", "totalCashKRW", "cash_krw"]);
  const totalDebtKRW = firstNumber(totalsSources, ["total_debt_krw", "totalDebtKRW", "debt_krw"]);
  const netWorthKRW = firstNumber(totalsSources, [
    "net_worth_krw",
    "netWorthKRW",
    "net_asset_krw",
    "netAssetKRW",
  ]);

  const documentVersion =
    firstString([data], ["document_version", "documentVersion"]) ?? "unknown";

  // Stamp authoritative totals whenever the document actually carried totals
  // (nested object OR any resolvable canonical total). This keeps the
  // "consume verbatim, never recompute" guarantee while letting the legacy
  // reconcile path handle a (rare) totals-less document.
  const hasTotals =
    totals !== undefined ||
    totalAssetsKRW !== 0 ||
    totalInvestmentsKRW !== 0 ||
    netWorthKRW !== 0;

  const authoritativeTotals: PortfolioAuthoritativeTotals | undefined = hasTotals
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
        documentVersion,
      }
    : undefined;

  const metadata = asRecord(data.metadata);

  return {
    id,
    snapshotDate,
    sourceFileName:
      firstString([data], ["source_file_name", "sourceFileName"]) ?? "firestore-snapshot",
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
    createdAt:
      firstString([data], ["generated_at", "generatedAt", "created_at", "createdAt"]) ??
      new Date(0).toISOString(),
    authoritativeTotals,
    metadata: {
      parserVersion:
        firstString([metadata], ["parser_version", "parserVersion"]) ??
        `firestore-snapshot-${documentVersion}`,
      excludedSmallCount: firstNumber([metadata], ["excluded_small_count", "excludedSmallCount"]),
      excludedBelowMinimumCount: firstNumber(
        [metadata],
        ["excluded_below_minimum_count", "excludedBelowMinimumCount"],
      ),
      excludedHoldingValueKRW: firstNumber(
        [metadata],
        ["excluded_holding_value_krw", "excludedHoldingValueKRW"],
      ),
      liveViewVersion: `firestore-snapshot-${documentVersion}`,
    },
  };
}
