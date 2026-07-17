import type { YearPlanRow } from "./asset-simulator-types";

// 투자 계획의 계산·저장·CSV는 전체 기간을 유지한다. 이 helper는 화면에 표시할
// 시작연도부터의 연속된 최초 20개 행만 선택한다.
export const MAX_VISIBLE_YEAR_PLAN_ROWS = 20;

export function getVisibleYearPlanRows(plans: YearPlanRow[]): YearPlanRow[] {
  return plans.slice(0, MAX_VISIBLE_YEAR_PLAN_ROWS);
}
