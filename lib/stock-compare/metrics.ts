// =============================================================
// 위험/위험조정수익률 지표 + Rolling 1Y Total Return.
//
// - 위험지표는 기존 lib/backtest-risk-metrics.ts(computeBacktestRiskMetrics)를
//   재사용한다(일별 곡선 → MDD/Sharpe/Sortino/Calmar, 252 거래일 연율화).
// - TR/CAGR 은 기간 시작·종료 인덱스와 실제 경과일로 계산한다.
// - Rolling 1Y TR 은 "월말" 종가만 사용하며, 각 월말 t 에서
//   index(t)/index(t−1년) − 1 로 산출한다.
// =============================================================

import { computeBacktestRiskMetrics } from "@/lib/backtest-risk-metrics";
import type { CompareSeries, RollingPoint, SeriesMetrics } from "@/lib/stock-compare/types";

const EMPTY_METRICS: SeriesMetrics = {
  trPct: null,
  cagrPct: null,
  mddPct: null,
  sharpe: null,
  sortino: null,
  calmar: null,
};

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

// 누적 수익률(%) 시계열을 기준일=1 인덱스 곡선으로 환산.
function toIndexCurve(series: CompareSeries): Array<{ date: string; index: number }> {
  return series.points
    .filter((p) => Number.isFinite(p.value))
    .map((p) => ({ date: p.date, index: 1 + p.value / 100 }));
}

export function computeSeriesMetrics(series: CompareSeries): SeriesMetrics {
  const curve = toIndexCurve(series);
  if (curve.length < 2) return { ...EMPTY_METRICS };

  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!(first.index > 0)) return { ...EMPTY_METRICS };

  const totalReturn = last.index / first.index;
  const trPct = round((totalReturn - 1) * 100);

  // 실제 경과 연수 기준 CAGR.
  const days = Math.max(
    1,
    (new Date(`${last.date}T00:00:00Z`).getTime() - new Date(`${first.date}T00:00:00Z`).getTime()) / 86_400_000,
  );
  const years = days / 365.25;
  const cagrPct = totalReturn > 0 && years > 0 ? round((Math.pow(totalReturn, 1 / years) - 1) * 100) : null;

  const risk = computeBacktestRiskMetrics(curve.map((p) => p.index));

  return {
    trPct,
    cagrPct,
    mddPct: risk.mddPct != null ? round(risk.mddPct) : null,
    sharpe: risk.sharpe != null ? round(risk.sharpe) : null,
    sortino: risk.sortino != null ? round(risk.sortino) : null,
    calmar: risk.calmar != null ? round(risk.calmar) : null,
  };
}

// 월말(각 달의 마지막 거래일) 포인트만 추출.
function monthEndCurve(series: CompareSeries): Array<{ date: string; index: number }> {
  const curve = toIndexCurve(series);
  const byMonth = new Map<string, { date: string; index: number }>();
  for (const p of curve) {
    const ym = p.date.slice(0, 7); // YYYY-MM
    byMonth.set(ym, p); // 같은 달이면 더 늦은 날짜로 덮어쓰기(정렬 입력 전제).
  }
  return Array.from(byMonth.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// 월말 인덱스에서 12개월 전 인덱스를 찾아 1Y TR(%) 계산.
function rollingForCurve(curve: Array<{ date: string; index: number }>): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < curve.length; i += 1) {
    const cur = curve[i];
    const targetMs = new Date(`${cur.date}T00:00:00Z`).getTime() - 365 * 86_400_000;
    // 1년 전(이하) 가장 가까운 월말 인덱스를 역방향 탐색.
    let base: { date: string; index: number } | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (new Date(`${curve[j].date}T00:00:00Z`).getTime() <= targetMs) {
        base = curve[j];
        break;
      }
    }
    // 정확히 1년이 안 되면(초기 구간) 가장 이른 점이라도 ~11개월 이상이면 사용 안 함.
    if (base && base.index > 0) {
      out.set(cur.date, round((cur.index / base.index - 1) * 100));
    }
  }
  return out;
}

// 4개 시리즈의 Rolling 1Y TR 을 월말 날짜축에 정렬한 포인트 배열.
export function computeRollingPoints(seriesList: CompareSeries[]): RollingPoint[] {
  const byKey: Record<string, Map<string, number>> = {};
  const dateSet = new Set<string>();
  for (const s of seriesList) {
    const rolling = rollingForCurve(monthEndCurve(s));
    byKey[s.key] = rolling;
    rolling.forEach((_v, date) => dateSet.add(date));
  }
  const dates = Array.from(dateSet).sort();
  return dates.map((date) => ({
    date,
    a: byKey.a?.get(date) ?? null,
    b: byKey.b?.get(date) ?? null,
    aEx: byKey.aEx?.get(date) ?? null,
    bEx: byKey.bEx?.get(date) ?? null,
  }));
}
