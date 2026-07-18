import { canonicalizeAccountGroupLabel } from "./account-status-group";
import { applyKnownQuoteTickerToHolding } from "./holding-ticker-normalizer";
import { parsePortfolioTags } from "./portfolio-tags";
import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";
import { guessTicker } from "./ticker-mapper";

const EMPTY_LIKE = new Set(["", "-", "기타", "미분류", "미확인", "UNKNOWN", "N/A"]);
const GENERIC_BROKER_LIKE = new Set(["", "주식", "펀드", "ETF", "투자", "투자성 자산", "기타"]);
const STRONG_ACCOUNT_GROUPS = new Set(["위탁", "연금", "ISA", "달러", "원"]);

export interface SnapshotMetadataDiagnostics {
  holdingCount: number;
  missingTickerBefore: number;
  missingTickerAfter: number;
  recoveredTickerCount: number;
  recoveredAccountGroupCount: number;
  unresolvedHoldingIds: string[];
}

function clean(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function normalizedTicker(value: string | undefined | null): string | undefined {
  const ticker = clean(value).replace(/\s+/g, "").toUpperCase();
  if (!ticker || EMPTY_LIKE.has(ticker)) return undefined;
  if (/^\d{6}(?:\.(?:KS|KQ))?$/.test(ticker)) return ticker;
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker) ? ticker : undefined;
}

function recoveredTickerFromName(productName: string, cleanName?: string): ReturnType<typeof guessTicker> {
  // ① 종목 그룹은 미국 상장 ticker가 아니라 국내 ETF의 노출 프록시(SPY/QQQ)일 수 있다.
  // 따라서 태그가 제거된 실제 상품명만 사용하고 원문 전체로 재시도하지 않는다.
  return guessTicker(cleanName || parsePortfolioTags(productName).cleanName || productName);
}

function recoverHoldingTicker(holding: Holding): Holding {
  const explicit = normalizedTicker(holding.ticker);
  if (explicit) {
    const normalized = applyKnownQuoteTickerToHolding({
      ...holding,
      ticker: explicit,
      tickerSource: holding.tickerSource ?? "explicit",
    });
    return {
      ...normalized,
      tickerSource: normalized.ticker !== explicit ? "korean-registry" : normalized.tickerSource,
    };
  }

  // KRX 이름 레지스트리는 미국 상품명 추정보다 먼저 적용한다. 이 순서가 있어야
  // 한국 ETF에 미국 노출 태그(①SPY/①QQQ)가 있어도 실제 .KS/.KQ ticker를 유지한다.
  const registryNormalized = applyKnownQuoteTickerToHolding(holding);
  if (normalizedTicker(registryNormalized.ticker)) {
    return { ...registryNormalized, tickerSource: "korean-registry" };
  }

  const guess = recoveredTickerFromName(holding.productName, holding.cleanName);
  if (!guess.ticker) return { ...holding, needsReview: true, tickerConfidence: "none" };
  const normalized = applyKnownQuoteTickerToHolding({
    ...holding,
    ticker: guess.ticker,
    tickerSource: "product-alias",
    tickerConfidence: guess.confidence,
    needsReview: false,
  });
  return {
    ...normalized,
    tickerSource: normalized.ticker !== guess.ticker ? "korean-registry" : "product-alias",
  };
}

function restoreReturnPct(holding: Holding): Holding {
  if (typeof holding.returnPct === "number" && Number.isFinite(holding.returnPct)) return holding;
  if (!Number.isFinite(holding.principalKRW) || holding.principalKRW <= 0 || !Number.isFinite(holding.valueKRW)) {
    return holding;
  }
  return {
    ...holding,
    returnPct: ((holding.valueKRW - holding.principalKRW) / holding.principalKRW) * 100,
  };
}

function canonicalStrongAccountGroup(value: string | undefined): string | undefined {
  const canonical = canonicalizeAccountGroupLabel(clean(value));
  if (!canonical || EMPTY_LIKE.has(canonical.toUpperCase())) return undefined;
  if (STRONG_ACCOUNT_GROUPS.has(canonical)) return canonical;
  return undefined;
}

function financeTicker(asset: FinanceAsset): string | undefined {
  return recoveredTickerFromName(asset.productName, asset.cleanName).ticker ?? undefined;
}

function accountConsensusByTicker(holdings: Holding[], financeAssets: FinanceAsset[]): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  const add = (ticker: string | undefined, accountGroup: string | undefined) => {
    const normalized = normalizedTicker(ticker);
    const strong = canonicalStrongAccountGroup(accountGroup);
    if (!normalized || !strong) return;
    const values = candidates.get(normalized) ?? new Set<string>();
    values.add(strong);
    candidates.set(normalized, values);
  };
  holdings.forEach((holding) => add(holding.ticker, holding.accountGroup));
  financeAssets.forEach((asset) => add(financeTicker(asset), asset.accountGroup));

  const consensus = new Map<string, string>();
  for (const [ticker, values] of Array.from(candidates.entries())) {
    if (values.size === 1) consensus.set(ticker, Array.from(values)[0]);
  }
  return consensus;
}

function normalizeProductIdentity(holding: Holding): string {
  return normalizeItemIdentity(holding.productName, holding.cleanName);
}

function normalizeItemIdentity(productName: string, cleanName?: string): string {
  return (cleanName || parsePortfolioTags(productName).cleanName || productName)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^0-9A-Z가-힣]/g, "");
}

function uniqueValue(values: Array<string | undefined>, normalize: (value: string) => string = (value) => value): string | undefined {
  const usable = values.map(clean).filter((value) => value && !EMPTY_LIKE.has(value.toUpperCase()));
  const byNormalized = new Map<string, string>();
  usable.forEach((value) => byNormalized.set(normalize(value), value));
  return byNormalized.size === 1 ? Array.from(byNormalized.values())[0] : undefined;
}

function isGenericBroker(value: string | undefined): boolean {
  return GENERIC_BROKER_LIKE.has(clean(value).toUpperCase());
}

function isIncompleteClassification(value: string | undefined): boolean {
  const normalized = clean(value).toUpperCase();
  return EMPTY_LIKE.has(normalized) || normalized === "주식" || normalized === "투자성 자산";
}

/**
 * 최신 스냅샷 자체에서 복구 가능한 안전한 메타데이터만 보강한다.
 * 금액, 원금, 레코드 수와 ID는 절대 변경하지 않는다.
 */
export function normalizePortfolioSnapshotMetadata(snapshot: PortfolioSnapshot): {
  snapshot: PortfolioSnapshot;
  diagnostics: SnapshotMetadataDiagnostics;
} {
  const missingTickerBefore = snapshot.holdings.filter((holding) => !normalizedTicker(holding.ticker)).length;
  const tickerRecovered = snapshot.holdings.map(recoverHoldingTicker).map(restoreReturnPct);
  const consensus = accountConsensusByTicker(tickerRecovered, snapshot.financeAssets ?? []);
  let recoveredAccountGroupCount = 0;

  const holdings = tickerRecovered.map((holding) => {
    if (canonicalStrongAccountGroup(holding.accountGroup)) return holding;
    const accountGroup = consensus.get(normalizedTicker(holding.ticker) ?? "");
    if (!accountGroup) return holding;
    recoveredAccountGroupCount += 1;
    return { ...holding, accountGroup, accountGroupSource: "snapshot-consensus" as const };
  });
  const financeAssets = (snapshot.financeAssets ?? []).map((asset) => {
    if (canonicalStrongAccountGroup(asset.accountGroup)) return asset;
    const accountGroup = consensus.get(normalizedTicker(financeTicker(asset)) ?? "");
    if (!accountGroup) return asset;
    recoveredAccountGroupCount += 1;
    return { ...asset, accountGroup, accountGroupSource: "snapshot-consensus" as const };
  });
  const missingTickerAfter = holdings.filter((holding) => !normalizedTicker(holding.ticker)).length;

  return {
    snapshot: { ...snapshot, holdings, financeAssets },
    diagnostics: {
      holdingCount: holdings.length,
      missingTickerBefore,
      missingTickerAfter,
      recoveredTickerCount: missingTickerBefore - missingTickerAfter,
      recoveredAccountGroupCount,
      unresolvedHoldingIds: holdings.filter((holding) => !normalizedTicker(holding.ticker)).map((holding) => holding.id),
    },
  };
}

/**
 * 신규 동기화의 빈/불완전 필드가 기존 정상 메타데이터를 지우지 않게 한다.
 * 동일 상품명이 여러 실제 계좌에 존재해 후보가 충돌하면 해당 필드는 보존하지 않는다.
 * 우선순위: 기존 수동값 > 신규 명시값 > 기존의 유일한 정상값 > 신뢰 가능한 상품 별칭 > 미해결.
 */
export function mergePortfolioSnapshotMetadata(
  incoming: PortfolioSnapshot,
  existingSnapshots: PortfolioSnapshot[],
): PortfolioSnapshot {
  const normalizedIncoming = normalizePortfolioSnapshotMetadata(incoming).snapshot;
  const existingHoldings = existingSnapshots
    .flatMap((snapshot) => normalizePortfolioSnapshotMetadata(snapshot).snapshot.holdings)
    .filter((holding) => normalizeProductIdentity(holding));
  const byProduct = new Map<string, Holding[]>();
  existingHoldings.forEach((holding) => {
    const key = normalizeProductIdentity(holding);
    byProduct.set(key, [...(byProduct.get(key) ?? []), holding]);
  });

  const holdings = normalizedIncoming.holdings.map((holding) => {
    const candidates = byProduct.get(normalizeProductIdentity(holding)) ?? [];
    if (candidates.length === 0) return holding;
    const existingManualTicker = uniqueValue(
      candidates
        .filter((candidate) => candidate.tickerSource === "manual")
        .map((candidate) => normalizedTicker(candidate.ticker)),
      (value) => value.toUpperCase(),
    );
    const existingTicker = existingManualTicker ?? uniqueValue(
      candidates.map((candidate) => normalizedTicker(candidate.ticker)),
      (value) => value.toUpperCase(),
    );
    const existingAccountGroup = uniqueValue(candidates.map((candidate) => canonicalStrongAccountGroup(candidate.accountGroup)));
    const existingBroker = uniqueValue(candidates.map((candidate) => isGenericBroker(candidate.broker) ? undefined : candidate.broker));
    const existingAccountName = uniqueValue(candidates.map((candidate) => candidate.accountName));
    const existingCurrency = uniqueValue(candidates.map((candidate) => candidate.currency), (value) => value.toUpperCase());
    const existingPurpose = uniqueValue(candidates.map((candidate) => candidate.purposeGroup));
    const existingStatus = uniqueValue(candidates.map((candidate) => isIncompleteClassification(candidate.statusGroup) ? undefined : candidate.statusGroup));
    const existingSymbolGroup = uniqueValue(candidates.map((candidate) => candidate.symbolGroup));

    const incomingTicker = normalizedTicker(holding.ticker);
    const shouldKeepExistingTicker = Boolean(existingTicker) && (
      Boolean(existingManualTicker) ||
      !incomingTicker ||
      (holding.tickerSource !== "explicit" && incomingTicker !== existingTicker)
    );
    const accountGroup = canonicalStrongAccountGroup(holding.accountGroup) ?? existingAccountGroup;

    return {
      ...holding,
      ticker: shouldKeepExistingTicker ? existingTicker : incomingTicker ?? holding.ticker,
      tickerSource: shouldKeepExistingTicker
        ? existingManualTicker ? "manual" as const : "existing" as const
        : holding.tickerSource,
      tickerConfidence: shouldKeepExistingTicker ? "high" as const : holding.tickerConfidence,
      needsReview: shouldKeepExistingTicker ? false : holding.needsReview,
      accountGroup: accountGroup ?? holding.accountGroup,
      accountGroupSource: !canonicalStrongAccountGroup(holding.accountGroup) && existingAccountGroup
        ? "existing" as const
        : holding.accountGroupSource,
      broker: isGenericBroker(holding.broker) && existingBroker ? existingBroker : holding.broker,
      accountName: clean(holding.accountName) || existingAccountName,
      currency: clean(holding.currency) || existingCurrency,
      symbolGroup: clean(holding.symbolGroup) || existingSymbolGroup,
      purposeGroup: clean(holding.purposeGroup) && holding.purposeGroup !== "미분류"
        ? holding.purposeGroup
        : existingPurpose ?? holding.purposeGroup,
      statusGroup: isIncompleteClassification(holding.statusGroup) && existingStatus
        ? existingStatus
        : holding.statusGroup,
    };
  });

  const existingFinanceByProduct = new Map<string, FinanceAsset[]>();
  existingSnapshots
    .flatMap((snapshot) => normalizePortfolioSnapshotMetadata(snapshot).snapshot.financeAssets)
    .forEach((asset) => {
      const key = normalizeItemIdentity(asset.productName, asset.cleanName);
      if (key) existingFinanceByProduct.set(key, [...(existingFinanceByProduct.get(key) ?? []), asset]);
    });
  const financeAssets = normalizedIncoming.financeAssets.map((asset) => {
    const candidates = existingFinanceByProduct.get(normalizeItemIdentity(asset.productName, asset.cleanName)) ?? [];
    if (candidates.length === 0) return asset;
    const existingAccountGroup = uniqueValue(candidates.map((candidate) => canonicalStrongAccountGroup(candidate.accountGroup)));
    const existingPurpose = uniqueValue(candidates.map((candidate) => candidate.purposeGroup));
    const existingStatus = uniqueValue(candidates.map((candidate) => isIncompleteClassification(candidate.statusGroup) ? undefined : candidate.statusGroup));
    return {
      ...asset,
      accountGroup: canonicalStrongAccountGroup(asset.accountGroup) ?? existingAccountGroup ?? asset.accountGroup,
      accountGroupSource: !canonicalStrongAccountGroup(asset.accountGroup) && existingAccountGroup
        ? "existing" as const
        : asset.accountGroupSource,
      purposeGroup: clean(asset.purposeGroup) && asset.purposeGroup !== "미분류"
        ? asset.purposeGroup
        : existingPurpose ?? asset.purposeGroup,
      statusGroup: isIncompleteClassification(asset.statusGroup) && existingStatus
        ? existingStatus
        : asset.statusGroup,
    };
  });

  return normalizePortfolioSnapshotMetadata({ ...normalizedIncoming, holdings, financeAssets }).snapshot;
}
