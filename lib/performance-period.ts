// PERFORMANCE-PERIOD-SELECT: 배당 페이지 성과분석 그래프(위탁/절세/전체합산)의
// "표시 구간"을 2년/1년/6개월로 선택하기 위한 공유 상수·헬퍼.
//
// [중요] 이 모듈은 그래프의 "표시 구간"만 바꾼다. 데이터 계산(역산/수익률/포인트 생성)은
//        기존과 동일하게 24개월 기준으로 만든 뒤, 화면에 보여줄 마지막 N개월만 잘라낸다.
//        따라서 KPI/카드 값·계산 로직에는 어떤 영향도 주지 않는다.

export type PerformancePeriodOption = { months: number; label: string };

// 역산 성과 분석(SnapshotBacktestSection)과 동일한 기간 옵션을 사용한다.
export const PERFORMANCE_PERIOD_OPTIONS: PerformancePeriodOption[] = [
  { months: 24, label: "2년" },
  { months: 12, label: "1년" },
  { months: 6, label: "6개월" },
];

// 기본 선택값. 기존 동작(전체 24개월 표시)과 동일하게 유지한다.
export const DEFAULT_PERFORMANCE_MONTHS = 24;

// "YYYY-MM-DD" 또는 "YYYY-MM" 형태 날짜에서 월 키("YYYY-MM")를 뽑는다.
function monthKey(date: string): string {
  return date.slice(0, 7);
}

// 월별 성과 포인트 배열을 "최근 N개월" 창으로 잘라낸다(표시 전용).
// - 마지막 달을 포함해 총 `months` 개월을 남긴다.
// - 모든 그래프가 동일한 latest month 로 끝나므로, 같은 months 값이면 세 그래프의
//   표시 구간이 항상 동일하게 맞춰진다.
// - months 가 전체 길이보다 크거나 유효하지 않으면 원본을 그대로 반환한다.
export function clampPerformancePointsToMonths<T extends { date: string }>(
  points: readonly T[],
  months: number,
): T[] {
  if (!Number.isFinite(months) || months <= 0 || points.length === 0) {
    return [...points];
  }
  const lastKey = monthKey(points[points.length - 1].date);
  const [year, month] = lastKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return [...points];
  }
  // 시작 달 = 마지막 달 - (months - 1) → 마지막 달 포함 정확히 months 개월.
  const cutoff = new Date(Date.UTC(year, month - 1 - (months - 1), 1));
  const cutoffKey = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, "0")}`;
  return points.filter((point) => monthKey(point.date) >= cutoffKey);
}
