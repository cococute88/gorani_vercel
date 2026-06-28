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

/**
 * Like {@link firstArray} but probes several source objects in priority order
 * (e.g. the nested `snapshot` container first, then the document root). Returns
 * the first non-empty array found, or `[]` when nothing matches.
 */
function firstArrayFrom(
  sources: Array<RawRecord | undefined>,
  keys: string[],
): RawRecord[] {
  for (const source of sources) {
    if (!source) continue;
    const found = firstArray(source, keys);
    if (found.length > 0) return found;
  }
  return [];
}

// ---- single-row mappers -----------------------------------------------------

function mapHolding(raw: RawRecord, index: number): Holding {
  const s = [raw];
  return {
    id: firstString(s, ["id", "holding_id", "holdingId"]) ?? `fs-holding-${index}`,
    broker:
      firstString(s, [
        "broker",
        "institution",
        "institution_name",
        "institutionName",
        // bs-report-auto `investment_status` rows expose the institution via
        // `account_type` (e.g. 증권사/연금계좌 등); map it as the broker.
        "account_type",
        "accountType",
      ]) ?? "",
    accountName: firstString(s, ["account_name", "accountName"]),
    assetType:
      firstString(s, [
        "asset_type",
        "assetType",
        "type",
        // `investment_status` rows describe the product class via `asset_group`.
        "asset_group",
        "assetGroup",
      ]) ?? "",
    productName: firstString(s, ["product_name", "productName", "name"]) ?? "",
    cleanName: firstString(s, ["clean_name", "cleanName"]),
    ticker: firstString(s, ["ticker", "symbol"]),
    tag: firstString(s, ["tag"]),
    principalKRW: firstNumber(s, ["principal_krw", "principalKRW", "principal"]),
    // `investment_status` rows store the evaluated value under `amount_krw`.
    valueKRW: firstNumber(s, [
      "value_krw",
      "valueKRW",
      "value",
      "evaluation_krw",
      "eval_krw",
      "amount_krw",
      "amountKRW",
    ]),
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
  resolvedTotalsSource: "current_snapshot" | "nested-totals" | "document-root" | "none";
  holdingsKey: string | null;
  holdingsCount: number;
  holdingsSampleKeys: string[];
  cashKey: string | null;
  cashCount: number;
  cashSampleKeys: string[];
}

// The current bs-report-auto document nests the live snapshot under a top-level
// `snapshot` object. The eight canonical totals live in
// `snapshot.current_snapshot`, holdings in `snapshot.investment_status`, and
// finance assets in `snapshot.financial_status`. We probe these FIRST, then
// keep the older flat/`totals` aliases as backward-compatible fallbacks so a
// legacy document still maps (and so the 0/[] fallback is only ever hit when a
// value is genuinely absent).
const SNAPSHOT_CONTAINER_KEYS = ["snapshot", "snapshotData", "snapshot_data"];
const CURRENT_SNAPSHOT_KEYS = ["current_snapshot", "currentSnapshot"];
const HOLDINGS_KEYS = [
  "investment_status",
  "investmentStatus",
  "holdings",
  "investments",
  "positions",
  "holding_rows",
  "holdingRows",
  "stocks",
];
const CASH_KEYS = [
  "financial_status",
  "financialStatus",
  "cash_assets",
  "cashAssets",
  "finance_assets",
  "financeAssets",
  "assets",
  "cash",
  "cash_rows",
];
const TOTAL_ASSETS_KEYS = ["total_assets_krw", "totalAssetsKRW", "total_asset_krw", "totalAssetKRW"];

/** Resolve the nested `snapshot` container (if present) from a raw document. */
function resolveSnapshotContainer(data: RawRecord): RawRecord | undefined {
  for (const key of SNAPSHOT_CONTAINER_KEYS) {
    const candidate = asRecord(data[key]);
    if (candidate) return candidate;
  }
  return undefined;
}

/** Resolve `snapshot.current_snapshot` (the primary totals source). */
function resolveCurrentSnapshot(container: RawRecord | undefined): RawRecord | undefined {
  if (!container) return undefined;
  for (const key of CURRENT_SNAPSHOT_KEYS) {
    const candidate = asRecord(container[key]);
    if (candidate) return candidate;
  }
  return undefined;
}

/**
 * Inspect a raw document and report WHERE each logical field resolves from.
 * Used by the API route to expose the real document structure for debugging
 * the "connected but empty" symptom.
 */
export function describeSnapshotDocumentShape(data: RawRecord): SnapshotDocumentShape {
  const container = resolveSnapshotContainer(data);
  const currentSnapshot = resolveCurrentSnapshot(container);
  const totals = asRecord(data.totals);

  // Probe arrays in priority order: nested `snapshot` container first (the new
  // layout), then the document root (legacy flat layout).
  const arraySources: Array<RawRecord | undefined> = [container, data];
  const holdingsKey =
    arraySources.reduce<string | null>((acc, src) => {
      if (acc || !src) return acc;
      return HOLDINGS_KEYS.find((k) => Array.isArray(src[k])) ?? null;
    }, null) ?? null;
  const cashKey =
    arraySources.reduce<string | null>((acc, src) => {
      if (acc || !src) return acc;
      return CASH_KEYS.find((k) => Array.isArray(src[k])) ?? null;
    }, null) ?? null;

  const holdings = firstArrayFrom(arraySources, HOLDINGS_KEYS);
  const cash = firstArrayFrom(arraySources, CASH_KEYS);

  const currentHasValue =
    currentSnapshot !== undefined &&
    TOTAL_ASSETS_KEYS.some((k) => toFiniteNumber(currentSnapshot[k]) !== undefined);
  const totalsHasValue =
    totals !== undefined && TOTAL_ASSETS_KEYS.some((k) => toFiniteNumber(totals[k]) !== undefined);
  const rootHasValue = TOTAL_ASSETS_KEYS.some((k) => toFiniteNumber(data[k]) !== undefined);

  return {
    topLevelKeys: Object.keys(data),
    totalsKeys: currentSnapshot
      ? Object.keys(currentSnapshot)
      : totals
        ? Object.keys(totals)
        : null,
    resolvedTotalsSource: currentHasValue
      ? "current_snapshot"
      : totalsHasValue
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

  // Resolve the new nested layout. The live snapshot lives under a top-level
  // `snapshot` object: totals in `current_snapshot`, holdings in
  // `investment_status`, finance assets in `financial_status`.
  const snapshotContainer = resolveSnapshotContainer(data);
  const currentSnapshot = resolveCurrentSnapshot(snapshotContainer);
  const metadata = asRecord(data.metadata) ?? asRecord(snapshotContainer?.metadata);

  const snapshotDate =
    firstString(
      [currentSnapshot, snapshotContainer, metadata, data],
      ["snapshot_date", "snapshotDate", "date", "as_of", "asOf"],
    ) ?? id;

  // Holdings / finance assets: probe the nested `snapshot` container first
  // (investment_status / financial_status), then fall back to legacy root-level
  // array names so older documents still map.
  const arraySources: Array<RawRecord | undefined> = [snapshotContainer, data];
  const holdings = firstArrayFrom(arraySources, HOLDINGS_KEYS).map(mapHolding);
  const financeAssets = firstArrayFrom(arraySources, CASH_KEYS).map(mapCashAsset);

  // Totals: `snapshot.current_snapshot` is the PRIMARY source. We still probe
  // the legacy nested `totals` object and the document root afterwards so a
  // legacy document continues to map; the 0 fallback is only reached when a
  // value is genuinely absent from every source.
  const totals = asRecord(data.totals);
  const totalsSources: Array<RawRecord | undefined> = [
    currentSnapshot,
    totals,
    snapshotContainer,
    data,
  ];

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
  // (a `current_snapshot` / nested `totals` object OR any resolvable canonical
  // total). This keeps the "consume verbatim, never recompute" guarantee while
  // letting the legacy reconcile path handle a (rare) totals-less document.
  const hasTotals =
    currentSnapshot !== undefined ||
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

  const metadataSources: Array<RawRecord | undefined> = [metadata, snapshotContainer, data];

  return {
    id,
    snapshotDate,
    sourceFileName:
      firstString(
        [currentSnapshot, snapshotContainer, metadata, data],
        ["source_file_name", "sourceFileName"],
      ) ?? "firestore-snapshot",
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
      firstString(
        [currentSnapshot, snapshotContainer, metadata, data],
        ["generated_at", "generatedAt", "created_at", "createdAt"],
      ) ?? new Date(0).toISOString(),
    authoritativeTotals,
    metadata: {
      parserVersion:
        firstString(metadataSources, ["parser_version", "parserVersion"]) ??
        `firestore-snapshot-${documentVersion}`,
      excludedSmallCount: firstNumber(metadataSources, ["excluded_small_count", "excludedSmallCount"]),
      excludedBelowMinimumCount: firstNumber(
        metadataSources,
        ["excluded_below_minimum_count", "excludedBelowMinimumCount"],
      ),
      excludedHoldingValueKRW: firstNumber(
        metadataSources,
        ["excluded_holding_value_krw", "excludedHoldingValueKRW"],
      ),
      liveViewVersion: `firestore-snapshot-${documentVersion}`,
    },
  };
}
