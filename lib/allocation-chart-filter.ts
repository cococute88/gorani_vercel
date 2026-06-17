// 비중(파이/도넛) 차트에서 표시·계산할 최소 평가금액.
// 1,000,000원 미만 항목은 차트 조각, 범례, 퍼센트 계산에서 완전히 제외한다.
export const MIN_ALLOCATION_CHART_AMOUNT_KRW = 1_000_000;

export function isAllocationChartAmountVisible(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_ALLOCATION_CHART_AMOUNT_KRW;
}
