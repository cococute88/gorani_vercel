import type {
  ExpenseDemandSource,
  RetirementSafetyResult,
  SafetyFailureReason,
  SafetyGrade,
  SafetyMetrics,
  SafetyResult,
  SafetyStatus,
  SimulatorProjection,
} from "./asset-simulator-types";

const EPSILON = 1e-9;
const MEANINGFUL_SHORTFALL_RATIO = 0.01;
const NEUTRAL_SCORE = 70;
// hard failure 시 점수와 등급이 모순되지 않도록 표시 점수의 상한(F 구간).
const HARD_FAILURE_SCORE_CEILING = 34;

export type RetirementSafetyOptions = {
  // 목표 월생활비(현재 가치 기준, 만원). 유효하면 통합 생활비 수요 기준으로 사용한다.
  targetMonthlyExpenseReal?: number | null;
};

type AccountKind = keyof RetirementSafetyResult;

type AccountSignals = {
  assets: number[];
  livingExpensesCovered: boolean | null;
  shortfallYears: number;
  consecutiveShortfallYears: number;
  incomeCoverageScore: number;
  coreCashFlowStopped: boolean;
  principalSold: boolean | null;
  dividendsContinued: boolean | null;
  cashFlowWeakening: boolean;
  expenseDemandSource: ExpenseDemandSource;
  targetMonthlyExpenseReal: number | null;
  monthlyIncomeCoverageRatio: number | null;
};

// 유효한 목표 월생활비만 통과시킨다. NaN/Infinity/0 이하(음수 포함)는 무효로 본다.
function resolveTargetMonthlyExpense(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

type StabilitySignals = {
  score: number;
  latePeriodDecline: boolean;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function nonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function interpolate(value: number, from: number, to: number, minScore: number, maxScore: number): number {
  if (to <= from) return minScore;
  const progress = (value - from) / (to - from);
  return minScore + progress * (maxScore - minScore);
}

export function scorePreservationRatio(preservationRatio: number): number {
  const ratio = nonNegative(preservationRatio);
  if (ratio <= 0.3) return 0;
  if (ratio < 0.5) return interpolate(ratio, 0.3, 0.5, 10, 55);
  if (ratio < 0.8) return interpolate(ratio, 0.5, 0.8, 55, 82);
  if (ratio < 1) return interpolate(ratio, 0.8, 1, 82, 95);
  return 100;
}

export function safetyGradeFromScore(score: number, hardFailure = false): SafetyGrade {
  if (hardFailure) return "F";
  const normalized = clampScore(score);
  if (normalized >= 90) return "S";
  if (normalized >= 80) return "A";
  if (normalized >= 65) return "B";
  if (normalized >= 50) return "C";
  if (normalized >= 35) return "D";
  return "F";
}

function preservationRatio(startingRealAssets: number, endingRealAssets: number): number {
  if (startingRealAssets <= EPSILON) return 0;
  return nonNegative(endingRealAssets) / startingRealAssets;
}

function maxConsecutive(values: boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const value of values) {
    current = value ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

type LivingExpenseSignals = Pick<
  AccountSignals,
  | "livingExpensesCovered"
  | "shortfallYears"
  | "consecutiveShortfallYears"
  | "incomeCoverageScore"
  | "coreCashFlowStopped"
  | "expenseDemandSource"
  | "targetMonthlyExpenseReal"
  | "monthlyIncomeCoverageRatio"
>;

function livingExpenseSignals(
  source: SimulatorProjection,
  account: "taxSaving" | "combined",
  targetMonthlyExpenseReal: number | null,
): LivingExpenseSignals {
  // 목표 월생활비 입력이 있으면 통합(combined) 평가는 명시적 수요를 기준으로 한다.
  //   월 현금흐름 = taxSavingMonthlyReal (+ taxableMonthlyDividendReal, combined)
  //   월 수요 = targetMonthlyExpenseReal (연도 무관 고정)
  // 목표가 없으면 기존처럼 preview 의 realWithdraw 를 임시 수요 proxy 로 사용한다.
  // proxy 는 월 현금흐름과 다른 legacy 모델에서 나오므로 부족 횟수/비율은 score/warnings 참고용으로만 쓰인다.
  // 단, 평가 가능한 전체 기간의 월 현금흐름 자체가 0인 경우는 핵심 현금흐름 중단 신호로 유지한다.
  // 또한 실제 인출 시작 전 대기 구간은 비교 모델 차이로 생기는 가짜 부족이므로 평가에서 제외한다.
  const useTarget = account === "combined" && targetMonthlyExpenseReal !== null;
  const demandSource: ExpenseDemandSource = useTarget ? "target" : "legacy_proxy";
  const resolvedTarget = useTarget ? targetMonthlyExpenseReal : null;

  const emptyResult: LivingExpenseSignals = {
    livingExpensesCovered: null,
    shortfallYears: 0,
    consecutiveShortfallYears: 0,
    incomeCoverageScore: NEUTRAL_SCORE,
    coreCashFlowStopped: false,
    expenseDemandSource: demandSource,
    targetMonthlyExpenseReal: resolvedTarget,
    monthlyIncomeCoverageRatio: null,
  };

  const withdrawalStartIndex = source.timeline.withdrawalStartIndex;
  if (withdrawalStartIndex === null) return emptyResult;

  // 월 부족액이 해당 연도 수요의 1% 미만이면 계산 오차 수준으로 보고 부족 연도에서 제외한다.
  // (= 월 현금흐름이 수요의 99% 미만일 때만 부족으로 본다.)
  const rows = source.totalWithdrawRows
    .slice(withdrawalStartIndex)
    // proxy 는 realWithdraw 가 0 인 연도를 제외했지만, 목표 수요는 연도와 무관하게 고정이므로
    // 인출 구간의 모든 연도를 평가에 포함한다.
    .filter((row) => (useTarget ? Boolean(row.isWithdraw) : row.isWithdraw && nonNegative(row.realWithdraw) > EPSILON))
    .map((row) => {
      const requiredMonthlyReal = useTarget ? resolvedTarget! : nonNegative(row.realWithdraw) / 12;
      const availableMonthlyReal = account === "taxSaving"
        ? nonNegative(row.taxSavingMonthlyReal)
        : nonNegative(row.taxSavingMonthlyReal) + nonNegative(row.taxableMonthlyDividendReal);
      const shortage = Math.max(0, requiredMonthlyReal - availableMonthlyReal);
      return {
        availableMonthlyReal,
        coverageRatio: requiredMonthlyReal > EPSILON ? Math.min(1, availableMonthlyReal / requiredMonthlyReal) : 1,
        meaningfulShortfall: shortage + EPSILON >= requiredMonthlyReal * MEANINGFUL_SHORTFALL_RATIO,
      };
    });

  if (rows.length === 0) return emptyResult;

  const shortfalls = rows.map((row) => row.meaningfulShortfall);
  const shortfallYears = shortfalls.filter(Boolean).length;
  const averageCoverage = average(rows.map((row) => row.coverageRatio));
  return {
    livingExpensesCovered: shortfallYears === 0,
    shortfallYears,
    consecutiveShortfallYears: maxConsecutive(shortfalls),
    incomeCoverageScore: clampScore(averageCoverage * 100),
    // 일부 연도의 약화와 구분해, 평가 가능한 전체 기간에서 흐름이 0일 때만 완전 중단으로 본다.
    coreCashFlowStopped: rows.every((row) => row.availableMonthlyReal <= EPSILON),
    expenseDemandSource: demandSource,
    targetMonthlyExpenseReal: resolvedTarget,
    monthlyIncomeCoverageRatio: averageCoverage,
  };
}

function brokerageDividendSignals(
  source: SimulatorProjection,
  retirementIndex: number,
): Pick<AccountSignals, "dividendsContinued" | "incomeCoverageScore" | "coreCashFlowStopped" | "cashFlowWeakening"> {
  const dividends = source.dividendRows
    .slice(retirementIndex + 1)
    .map((row) => nonNegative(row.afterTaxAnnualDividendReal));
  if (dividends.length === 0) {
    return {
      dividendsContinued: null,
      incomeCoverageScore: NEUTRAL_SCORE,
      coreCashFlowStopped: false,
      cashFlowWeakening: false,
    };
  }

  const positiveYears = dividends.filter((value) => value > EPSILON).length;
  const splitIndex = Math.max(1, Math.floor(dividends.length / 2));
  const earlyAverage = average(dividends.slice(0, splitIndex));
  const lateAverage = average(dividends.slice(splitIndex));
  const strengthRatio = earlyAverage > EPSILON ? Math.min(1, lateAverage / earlyAverage) : positiveYears > 0 ? 1 : 0;
  const continuityRatio = positiveYears / dividends.length;

  return {
    dividendsContinued: positiveYears === dividends.length,
    incomeCoverageScore: clampScore(continuityRatio * 70 + strengthRatio * 30),
    coreCashFlowStopped: positiveYears === 0,
    cashFlowWeakening: earlyAverage > EPSILON && lateAverage + EPSILON < earlyAverage * 0.9,
  };
}

function latePeriodStability(assets: number[]): StabilitySignals {
  if (assets.length < 5) return { score: NEUTRAL_SCORE, latePeriodDecline: false };

  const lateWindowSize = Math.max(3, Math.ceil(assets.length * 0.25));
  const lateAssets = assets.slice(-lateWindowSize);
  const decliningSteps = lateAssets.slice(1).filter((value, index) => value + EPSILON < lateAssets[index] * 0.99).length;
  const transitionCount = lateAssets.length - 1;
  const continuousDecline = transitionCount >= 2 && decliningSteps === transitionCount;
  const previousAssets = assets.slice(Math.max(0, assets.length - 6), -1);
  const previousAverage = average(previousAssets);
  const endingAssets = assets.at(-1) ?? 0;
  const belowRecentAverage = previousAverage > EPSILON && endingAssets + EPSILON < previousAverage * 0.9;

  let score = 100 - (decliningSteps / transitionCount) * 30;
  if (continuousDecline) score -= 15;
  if (belowRecentAverage) score -= 20;
  if (previousAverage > EPSILON && endingAssets < previousAverage * 0.75) score -= 20;

  return {
    score: clampScore(score),
    latePeriodDecline: continuousDecline || belowRecentAverage,
  };
}

function shortfallDurationScore(shortfallYears: number, consecutiveShortfallYears: number): number {
  if (shortfallYears === 0) return 100;
  if (shortfallYears === 1) return 70;
  if (consecutiveShortfallYears >= 2 || shortfallYears >= 3) return 0;
  return 45;
}

function resolveFailureReason(
  account: AccountKind,
  status: SafetyStatus,
  endingRealAssets: number,
  preservation: number,
  signals: AccountSignals,
): SafetyFailureReason {
  if (status !== "evaluated") return "DATA_INSUFFICIENT";
  if (endingRealAssets <= EPSILON || preservation <= 0.3) return "LOW_ASSET";
  if (signals.coreCashFlowStopped) return account === "brokerage" ? "DIVIDEND_STOPPED" : "INCOME_SHORTAGE";
  // 목표 월생활비 입력이 있는 통합 평가에서만 장기 생활비 부족을 hard failure로 승격한다.
  // (2년 연속 또는 총 3년 이상 부족)
  if (
    account === "combined"
    && signals.expenseDemandSource === "target"
    && (signals.consecutiveShortfallYears >= 2 || signals.shortfallYears >= 3)
  ) {
    return "INCOME_SHORTAGE";
  }
  // 목표 입력이 없는 proxy 부족은 hard failure로 승격하지 않는다(score/warning에만 반영).
  return "NONE";
}

function calculateCompositeScore(
  account: AccountKind,
  preservationScore: number,
  depletionScore: number,
  incomeCoverageScore: number,
  stabilityScore: number,
  principalSold: boolean | null,
  shortfallYears: number,
  consecutiveShortfallYears: number,
): number {
  if (account === "taxSaving") {
    return clampScore(
      preservationScore * 0.45
      + depletionScore * 0.25
      + incomeCoverageScore * 0.2
      + stabilityScore * 0.1,
    );
  }
  if (account === "brokerage") {
    const principalProtectionScore = principalSold === false ? 100 : 0;
    return clampScore(
      preservationScore * 0.45
      + principalProtectionScore * 0.2
      + incomeCoverageScore * 0.25
      + stabilityScore * 0.1,
    );
  }
  return clampScore(
    preservationScore * 0.4
    + incomeCoverageScore * 0.35
    + shortfallDurationScore(shortfallYears, consecutiveShortfallYears) * 0.15
    + stabilityScore * 0.1,
  );
}

function preservationMessages(preservation: number, positives: string[], warnings: string[]): void {
  if (preservation >= 1) positives.push("실질 자산이 은퇴 시작 시점보다 안정적으로 유지됩니다.");
  else if (preservation >= 0.8) positives.push("은퇴 기간 동안 실질 자산이 안정적으로 보존됩니다.");
  else if (preservation >= 0.5) positives.push("은퇴 기간 동안 자산이 일부 감소하지만 허용 범위 안에 있습니다.");
  else if (preservation > 0.3) warnings.push("실질 자산 보존 수준이 권장 범위보다 낮아 점검이 필요합니다.");
  else warnings.push("장기 계획의 실질 자산 보존 수준을 다시 점검할 필요가 있습니다.");
}

function accountMessages(
  account: AccountKind,
  status: SafetyStatus,
  metrics: SafetyMetrics,
  cashFlowWeakening: boolean,
): Pick<SafetyResult, "positives" | "warnings"> {
  const positives: string[] = [];
  const warnings: string[] = [];

  if (status === "not_applicable") {
    warnings.push("평가할 수 있는 위탁계좌 데이터가 아직 없습니다.");
    return { positives, warnings };
  }
  if (status === "data_insufficient") {
    warnings.push("평가할 수 있는 데이터가 충분하지 않습니다.");
    return { positives, warnings };
  }

  preservationMessages(metrics.preservationRatio, positives, warnings);
  if (metrics.sustainedThroughRetirement) positives.push("평가한 은퇴 기간 끝까지 실질 자산 잔고가 유지됩니다.");
  else warnings.push("평가 기간 중 실질 자산 잔고가 소진되는 구간이 있습니다.");

  if (account !== "brokerage") {
    if (metrics.expenseDemandSource === "target") {
      // 목표 월생활비 기준 평가: 명시적 수요 대비 월 현금흐름 충당 여부를 안내한다.
      if (metrics.livingExpensesCovered === true) positives.push("목표 월생활비를 월 현금흐름이 안정적으로 충당합니다.");
      else if (metrics.shortfallYears === 1) warnings.push("일부 연도에서 목표 월생활비 대비 월 현금흐름이 부족합니다.");
      else if (metrics.shortfallYears > 1) warnings.push("여러 연도에서 목표 월생활비를 충당하지 못해 계획 조정을 검토할 필요가 있습니다.");
      else warnings.push("목표 월생활비 대비 충당 여부를 판단할 데이터가 아직 부족합니다.");
    } else {
      // 목표 입력 전 임시(proxy) 기준 평가.
      if (metrics.livingExpensesCovered === true) positives.push("현재 임시 기준에서 현금흐름이 안정적으로 이어집니다.");
      else if (metrics.shortfallYears === 1) warnings.push("일부 연도에서 현금흐름이 약해질 수 있습니다.");
      else if (metrics.shortfallYears > 1) warnings.push("현재 임시 기준에서 여러 연도의 현금흐름을 점검할 필요가 있습니다.");
      else warnings.push("목표 생활비 입력 전에는 현금흐름 충당 여부를 판단하기 어렵습니다.");
      if (metrics.shortfallYears > 0) warnings.push("현재 생활비 부족 평가는 임시 기준이며, 목표 생활비 입력 후 더 정확해집니다.");
    }
  } else {
    if (metrics.principalSold === false) positives.push("위탁계좌 원금을 매도하지 않고 유지합니다.");
    else warnings.push("위탁계좌 원금 사용 여부를 점검할 필요가 있습니다.");

    if (metrics.dividendsContinued === true && !cashFlowWeakening) positives.push("위탁계좌 배당 현금흐름은 안정적으로 유지됩니다.");
    else if (metrics.dividendsContinued === null) warnings.push("평가할 은퇴 후 배당 기간이 없습니다.");
    else if (cashFlowWeakening) warnings.push("은퇴 후반부 배당 현금흐름이 다소 약해집니다.");
    else warnings.push("일부 연도에서 배당 현금흐름이 이어지는지 점검할 필요가 있습니다.");
  }

  if (metrics.latePeriodDecline) warnings.push("후반부 자산 감소 속도를 점검할 필요가 있습니다.");
  return { positives, warnings };
}

function evaluateAccount(account: AccountKind, retirementIndex: number, signals: AccountSignals): SafetyResult {
  // assets[0]은 withdrawalStartIndex(안전성 탭에서는 시작년도)의 실질 잔고다.
  // 따라서 preservationRatio = 최종 실질자산 / 인출 시작 시점 실질자산이다.
  const startingRealAssets = signals.assets[0] ?? 0;
  const endingRealAssets = signals.assets.at(-1) ?? 0;
  const ratio = preservationRatio(startingRealAssets, endingRealAssets);
  const yearsEvaluated = Math.max(0, signals.assets.length - 1);
  const hasRetirementData = retirementIndex >= 0 && yearsEvaluated > 0;
  const status: SafetyStatus = !hasRetirementData
    ? "data_insufficient"
    : account === "brokerage" && startingRealAssets <= EPSILON
      ? "not_applicable"
      : "evaluated";
  const depleted = status === "evaluated" && signals.assets.slice(1).some((value) => value <= EPSILON);
  const sustainedThroughRetirement = status === "evaluated" && !depleted;
  const preservationScore = scorePreservationRatio(ratio);
  const depletionScore = status === "evaluated" ? (depleted ? 0 : 100) : NEUTRAL_SCORE;
  const stability = status === "evaluated" ? latePeriodStability(signals.assets) : { score: NEUTRAL_SCORE, latePeriodDecline: false };
  const incomeCoverageScore = status === "evaluated" ? signals.incomeCoverageScore : NEUTRAL_SCORE;
  const reason = resolveFailureReason(
    account,
    status,
    endingRealAssets,
    ratio,
    signals,
  );
  const failed = status === "evaluated" && reason !== "NONE";
  const compositeScore = status !== "evaluated" ? 0 : calculateCompositeScore(
    account,
    preservationScore,
    depletionScore,
    incomeCoverageScore,
    stability.score,
    signals.principalSold,
    signals.shortfallYears,
    signals.consecutiveShortfallYears,
  );
  // hard failure는 점수와 등급이 모순되지 않도록 표시 점수를 F 구간으로 제한한다.
  const boundedScore = failed ? Math.min(compositeScore, HARD_FAILURE_SCORE_CEILING) : compositeScore;
  const score = Math.round(boundedScore * 10) / 10;
  const metrics: SafetyMetrics = {
    startingRealAssets,
    endingRealAssets,
    preservationRatio: ratio,
    yearsEvaluated,
    failed,
    failureReason: reason,
    depleted,
    livingExpensesCovered: signals.livingExpensesCovered,
    sustainedThroughRetirement,
    principalSold: signals.principalSold,
    dividendsContinued: status === "not_applicable" ? null : signals.dividendsContinued,
    shortfallYears: signals.shortfallYears,
    consecutiveShortfallYears: signals.consecutiveShortfallYears,
    preservationScore,
    incomeCoverageScore,
    depletionScore,
    stabilityScore: stability.score,
    latePeriodDecline: stability.latePeriodDecline,
    targetMonthlyExpenseReal: signals.targetMonthlyExpenseReal,
    expenseDemandSource: signals.expenseDemandSource,
    monthlyIncomeCoverageRatio: status === "evaluated" ? signals.monthlyIncomeCoverageRatio : null,
  };

  return {
    status,
    grade: status === "evaluated" ? safetyGradeFromScore(score, failed) : null,
    score,
    ...accountMessages(account, status, metrics, signals.cashFlowWeakening),
    metrics,
  };
}

export function calculateRetirementSafety(
  source: SimulatorProjection,
  options: RetirementSafetyOptions = {},
): RetirementSafetyResult {
  const retirementIndex = source.timeline.retirementIndex ?? -1;
  const retirementRows = retirementIndex >= 0 ? source.chartRows.slice(retirementIndex) : [];
  const targetMonthlyExpenseReal = resolveTargetMonthlyExpense(options.targetMonthlyExpenseReal);
  // 목표는 통합 생활비 수요에만 적용한다. 절세계좌 단독 평가는 기존 proxy 기준을 유지한다.
  const taxLivingExpenses = livingExpenseSignals(source, "taxSaving", targetMonthlyExpenseReal);
  const combinedLivingExpenses = livingExpenseSignals(source, "combined", targetMonthlyExpenseReal);
  const brokerageDividends = brokerageDividendSignals(source, retirementIndex);

  return {
    taxSaving: evaluateAccount("taxSaving", retirementIndex, {
      assets: retirementRows.map((row) => nonNegative(row.realTaxSavingBalance)),
      ...taxLivingExpenses,
      principalSold: null,
      dividendsContinued: null,
      cashFlowWeakening: false,
    }),
    brokerage: evaluateAccount("brokerage", retirementIndex, {
      assets: retirementRows.map((row) => nonNegative(row.taxableDividendBalanceReal)),
      livingExpensesCovered: null,
      shortfallYears: 0,
      consecutiveShortfallYears: 0,
      principalSold: false,
      expenseDemandSource: "legacy_proxy",
      targetMonthlyExpenseReal: null,
      monthlyIncomeCoverageRatio: null,
      ...brokerageDividends,
    }),
    combined: evaluateAccount("combined", retirementIndex, {
      assets: retirementRows.map((row) => nonNegative(row.combinedRealBalance)),
      ...combinedLivingExpenses,
      principalSold: null,
      dividendsContinued: null,
      cashFlowWeakening: false,
    }),
  };
}
