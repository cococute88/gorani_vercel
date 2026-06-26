// =============================================================
// 역산 성과 분석 카드용 위험/위험조정수익률 지표 계산.
//
// 입력: 선택 기간(2년/1년/6개월)의 "일별" 평가액 시계열(equity curve).
//       SnapshotBacktestSection 은 차트는 월말 축약(result.points)을 쓰지만,
//       위험지표는 buildBacktestDailyCurves 가 만든 "일별 거래일 전체" 곡선을 넘긴다.
//       → 차트용(월별) 축약 데이터를 지표 계산에 재사용하지 않는다(요구사항 4·5).
//       → MDD 가 기간 내 최대 낙폭(월중/장중 포함)을 정확히 반영한다.
//
// 산출:
//   - MDD     : 구간 내 최대 낙폭(peak → trough), 음수 % (예: -35.4)
//   - Sharpe  : (평균 수익률 / 표준편차) × √(연간 표본수), 무위험수익률 0 가정(연율화)
//   - Sortino : (평균 수익률 / 하방 표준편차) × √(연간 표본수) (연율화)
//   - Calmar  : 연평균 수익률(CAGR) / |MDD|
//
// 원칙:
//   - 각 시리즈에서 독립 계산한다(다른 카드 값 재사용 금지).
//   - 새 데이터를 만들지 않는다. 유효(양수·유한)한 값만 사용한다.
//   - 표본이 부족하거나 분모가 0이면 해당 지표는 null 로 둔다(가짜 값 금지).
// =============================================================

export type BacktestRiskMetrics = {
  // 음수 백분율(예: -35.4). 계산 불가 시 null.
  mddPct: number | null;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
};

// 일별 시계열의 연율화 계수(미국 시장 연간 거래일 ≈ 252).
export const TRADING_DAYS_PER_YEAR = 252;

export const EMPTY_RISK_METRICS: BacktestRiskMetrics = {
  mddPct: null,
  sharpe: null,
  sortino: null,
  calmar: null,
};

export function computeBacktestRiskMetrics(
  series: Array<number | null | undefined>,
  periodsPerYear: number = TRADING_DAYS_PER_YEAR,
): BacktestRiskMetrics {
  // 유효(양수·유한)한 값만, 순서를 유지한 채 모은다.
  const values = (series ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  if (values.length < 2) return { ...EMPTY_RISK_METRICS };

  // MDD: 누적 최고점 대비 최대 낙폭.
  let peak = values[0];
  let maxDrawdown = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    const drawdown = value / peak - 1;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  const mddPct = maxDrawdown * 100;

  // 기간(월별) 수익률.
  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    returns.push(values[i] / values[i - 1] - 1);
  }
  const n = returns.length;
  const mean = returns.reduce((sum, r) => sum + r, 0) / n;

  // Sharpe: 전체 변동성 기준.
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(periodsPerYear) : null;

  // Sortino: 하방(음수 수익률) 변동성 기준.
  const downsideVariance = returns.reduce((sum, r) => sum + (r < 0 ? r * r : 0), 0) / n;
  const downsideDev = Math.sqrt(downsideVariance);
  const sortino = downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(periodsPerYear) : null;

  // Calmar: 연평균 수익률(CAGR) / |MDD|.
  const totalReturn = values[values.length - 1] / values[0];
  const years = n / periodsPerYear;
  const cagr = totalReturn > 0 && years > 0 ? Math.pow(totalReturn, 1 / years) - 1 : null;
  const calmar = cagr != null && maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : null;

  return { mddPct, sharpe, sortino, calmar };
}
