import type { FinanceAsset, Holding } from "./portfolio-types";

export type PortfolioTagKey = "symbol" | "account" | "purpose" | "status";

export interface PortfolioTags {
  symbolGroup?: string;
  accountGroup?: string;
  purposeGroup?: string;
  statusGroup?: string;
  legacyTags: string[];
  cleanName: string;
  isSmallExcluded: boolean;
}

const TAG_MARKERS: Record<string, PortfolioTagKey> = {
  "①": "symbol",
  "1": "symbol",
  "②": "account",
  "2": "account",
  "③": "purpose",
  "3": "purpose",
  "④": "status",
  "4": "status",
};

const ORDERED_TAG_PATTERN = /([①②③④])\s*([^#①②③④\s][^#①②③④]*)/g;
const HASH_ORDERED_TAG_PATTERN = /#\s*([①②③④]|[1-4])\s*([^#①②③④\s][^#①②③④]*)/g;
const HASH_TAG_PATTERN = /#([^#\s]+)/g;

function compact(value: string | undefined): string | undefined {
  const next = (value ?? "")
    .replace(/[\][),.;:]+$/g, "")
    .replace(/^[\[\](),.;:]+/g, "")
    .trim();
  return next || undefined;
}

function normalizeGroup(value: string | undefined): string | undefined {
  return compact(value)?.replace(/^[:：-]+/, "").trim() || undefined;
}

function assignTag(tags: PortfolioTags, key: PortfolioTagKey, value: string | undefined) {
  const clean = normalizeGroup(value);
  if (!clean) return;
  if (key === "symbol") tags.symbolGroup = clean;
  if (key === "account") tags.accountGroup = clean;
  if (key === "purpose") tags.purposeGroup = clean;
  if (key === "status") tags.statusGroup = clean;
}

export function parsePortfolioTags(productName: string): PortfolioTags {
  const source = productName || "";
  const parsed: PortfolioTags = {
    cleanName: source.trim(),
    legacyTags: [],
    isSmallExcluded: false,
  };

  for (const match of Array.from(source.matchAll(ORDERED_TAG_PATTERN))) {
    assignTag(parsed, TAG_MARKERS[match[1]], match[2]);
  }

  for (const match of Array.from(source.matchAll(HASH_ORDERED_TAG_PATTERN))) {
    assignTag(parsed, TAG_MARKERS[match[1]], match[2]);
  }

  for (const match of Array.from(source.matchAll(HASH_TAG_PATTERN))) {
    const raw = compact(match[1]);
    if (!raw) continue;
    if (raw === "소액") parsed.isSmallExcluded = true;
    if (/^[①②③④1-4]/.test(raw)) continue;
    parsed.legacyTags.push(raw);
  }

  parsed.cleanName = source
    .replace(HASH_ORDERED_TAG_PATTERN, " ")
    .replace(ORDERED_TAG_PATTERN, " ")
    .replace(HASH_TAG_PATTERN, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return parsed;
}

export function decorateHoldingWithTags(holding: Holding): Holding {
  const tags = parsePortfolioTags(holding.productName);
  return {
    ...holding,
    cleanName: tags.cleanName || holding.productName,
    symbolGroup: tags.symbolGroup ?? holding.ticker ?? holding.cleanName ?? holding.productName,
    accountGroup: tags.accountGroup ?? holding.accountGroup ?? holding.accountName ?? holding.broker ?? "기타",
    purposeGroup: tags.purposeGroup ?? holding.purposeGroup ?? holding.tag ?? "미분류",
    statusGroup: tags.statusGroup ?? holding.statusGroup ?? holding.assetType ?? "기타",
    parsedTags: tags,
    tag: holding.tag ?? tags.legacyTags[0],
  };
}

export function decorateFinanceAssetWithTags(asset: FinanceAsset): FinanceAsset {
  const tags = parsePortfolioTags(asset.productName);
  return {
    ...asset,
    cleanName: tags.cleanName || asset.productName,
    symbolGroup: tags.symbolGroup ?? asset.symbolGroup,
    accountGroup: tags.accountGroup ?? asset.accountGroup ?? (asset as FinanceAsset & { accountName?: string }).accountName ?? asset.groupName ?? "기타",
    purposeGroup: tags.purposeGroup ?? asset.purposeGroup ?? asset.inferredTag ?? "미분류",
    statusGroup: tags.statusGroup ?? asset.statusGroup ?? asset.category ?? "기타",
    parsedTags: tags,
    inferredTag: asset.inferredTag ?? tags.legacyTags[0],
  };
}

export function shouldExcludePortfolioItem(productName: string, amountKRW: number): boolean {
  const tags = parsePortfolioTags(productName);
  return tags.isSmallExcluded || Math.abs(amountKRW) < 10000;
}
