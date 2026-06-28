// =============================================================
// TradingView Compare 스타일 "표시 기준점(0%) 재설정" — 표시 레이어 전용.
//
// 목적
//   성과 비교 메인 차트에서 사용자가 Zoom / Pan / Navigator / 기간 변경으로
//   "현재 보이는 첫 날짜"를 바꾸면, 모든 시리즈를 그 날짜를 기준(0%)으로
//   다시 계산해 보여준다. TradingView Compare 와 동일한 UX.
//
// 설계 원칙(중요)
//   - 원본 데이터(raw points)와 TR/Rolling/중복 제거 계산식은 절대 변경하지 않는다.
//     이 모듈은 이미 계산된 CompareSeries(누적 수익률 %)만 입력받아 "표시값"만
//     선형 재기준화한다.
//   - 누적수익률(%)과 기준일=1 인덱스의 관계:  index = 1 + value/100.
//     기준일을 D 로 옮길 때 한 점의 새 값은
//       newValue = ( (1 + value/100) / (1 + value_D/100) - 1 ) * 100
//     즉 원본 레벨 없이 이미 보유한 % 값만으로 재계산이 가능하다(추가 API 불필요).
//   - 모든 시리즈(A·B·중복 제거 A·B)는 "동일한 기준 날짜"를 공유한다.
// =============================================================

import type { CompareSeries, IndexPoint } from "@/lib/stock-compare/types";

// 누적수익률(%) → 기준일=1 인덱스 비율.
function toRatio(valuePct: number): number {
  return 1 + valuePct / 100;
}

// anchorDate 시점의 시리즈 값(%):
//   1) anchorDate 이하의 가장 최근 점(as-of / forward-fill)
//   2) anchorDate 이전 점이 없으면 anchorDate 이후 첫 점
// points 는 날짜 오름차순 정렬을 전제한다.
export function valueAsOf(points: IndexPoint[], anchorDate: string): number | null {
  if (points.length === 0) return null;
  let asOf: number | null = null;
  for (const p of points) {
    if (p.date <= anchorDate) {
      if (Number.isFinite(p.value)) asOf = p.value;
    } else {
      break;
    }
  }
  if (asOf != null) return asOf;
  const firstFinite = points.find((p) => Number.isFinite(p.value));
  return firstFinite ? firstFinite.value : null;
}

// 모든 시리즈가 공유할 기준 날짜를 정한다.
//   fromDate(보이는 영역의 첫 날짜) 이상인 "실제 데이터 날짜" 중 가장 이른 것.
//   어떤 시리즈에도 해당 날짜가 없으면 fromDate 를 그대로 사용한다.
export function resolveAnchorDate(series: CompareSeries[], fromDate: string): string | null {
  if (!fromDate) return null;
  let best: string | null = null;
  for (const s of series) {
    for (const p of s.points) {
      if (p.date >= fromDate) {
        if (best == null || p.date < best) best = p.date;
        break;
      }
    }
  }
  return best ?? fromDate;
}

// 표시용 시리즈를 만든다: anchorDate 를 0% 기준으로 모든 시리즈를 재계산.
//   - anchorDate 가 null/빈값이면 원본 시리즈(기간 기준)를 그대로 반환한다.
//   - 원본 series.points 객체는 변형하지 않고 새 배열을 만든다(불변).
//   - 각 시리즈는 anchorDate 시점 자기 값(as-of)을 기준으로 0% 가 되게 한다.
export function rebaseCompareSeries(
  series: CompareSeries[],
  anchorDate: string | null,
): CompareSeries[] {
  if (!anchorDate) return series;
  return series.map((s) => {
    const baseValue = valueAsOf(s.points, anchorDate);
    if (baseValue == null) return s;
    const baseRatio = toRatio(baseValue);
    if (!(baseRatio > 0)) return s;
    const points: IndexPoint[] = s.points.map((p) => {
      if (!Number.isFinite(p.value)) return p;
      const rebased = (toRatio(p.value) / baseRatio - 1) * 100;
      return { date: p.date, value: Number(rebased.toFixed(4)) };
    });
    return { ...s, points };
  });
}
