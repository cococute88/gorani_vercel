import type { Holding } from "./portfolio-types";

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").trim();
}

function isBlankOrDash(value: string | undefined): boolean {
  const normalized = compact(value);
  return normalized === "" || normalized === "-" || normalized === "—";
}

/**
 * 뱅크샐러드 투자현황 하단의 "총 43개" 같은 집계/요약행은 실제 보유종목이 아니므로
 * 파싱, 저장, 집계 어느 단계에서도 holdings 로 취급하지 않는다.
 */
export function isAggregateRowName(value: string | undefined): boolean {
  const normalized = compact(value).toLowerCase();
  if (!normalized) return false;
  if (/^총\d+개$/.test(normalized)) return true;
  if (/^total\d*items?$/.test(normalized)) return true;
  return ["합계", "총계", "총합", "grandtotal", "total"].includes(normalized);
}

export function isAggregateHoldingRow(holding: Pick<Holding, "productName" | "cleanName" | "ticker" | "broker" | "assetType" | "needsReview">): boolean {
  const name = holding.cleanName || holding.productName;
  if (isAggregateRowName(name)) return true;

  const normalizedName = compact(name).toLowerCase();
  const hasNoTicker = isBlankOrDash(holding.ticker);

  // 실제 종목의 "확인 필요" 상태는 유지하되, 티커가 없고 계좌/종류까지 요약행 모양인 행은 방어적으로 제외한다.
  return (
    hasNoTicker &&
    (/총\d+개/.test(normalizedName) || /^(합계|총계|총합|grandtotal|total)$/.test(normalizedName)) &&
    (isBlankOrDash(holding.broker) || compact(holding.assetType) === "기타" || holding.needsReview === true)
  );
}

export function filterAggregateHoldings<T extends Holding>(holdings: T[]): T[] {
  return holdings.filter((holding) => !isAggregateHoldingRow(holding));
}
