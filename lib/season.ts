// 계절 자동 판별 유틸리티.
// 현재 날짜(월)를 기준으로 봄/여름/가을/겨울 중 하나를 반환한다.
// 코드 수정 없이 매년/매월 자동으로 올바른 계절이 선택되도록 순수 함수로 구현한다.

export type Season = "spring" | "summer" | "fall" | "winter";

// 월(1~12) -> 계절 매핑
//  - 봄: 3~5월
//  - 여름: 6~8월
//  - 가을: 9~11월
//  - 겨울: 12~2월
export function getSeasonForMonth(month: number): Season {
  // month 는 1 기반(1=January ... 12=December)으로 받는다.
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter"; // 12, 1, 2
}

// 주어진(또는 현재) 날짜 기준 계절을 반환한다.
export function getCurrentSeason(date: Date = new Date()): Season {
  // getMonth() 는 0 기반이므로 +1 하여 1 기반 월로 변환한다.
  return getSeasonForMonth(date.getMonth() + 1);
}
