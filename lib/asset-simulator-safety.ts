import type {
  RetirementSafetyResult,
  SafetyFailureReason,
  SafetyGrade,
  SafetyMetrics,
  SafetyResult,
  SimulatorProjection,
} from "./asset-simulator-types";

const EPSILON = 1e-9;
const MEANINGFUL_SHORTFALL_RATIO = 0.01;
const NEUTRAL_SCORE = 70;

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
};

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

function livingExpenseSignals(
  source: SimulatorProjection,
  retirementIndex: number,
  account: "taxSaving" | "combined",
): Pick<
  AccountSignals,
  "livingExpensesCovered" | "shortfallYears" | "consecutiveShortfallYears" | "incomeCoverageScore" | "coreCashFlowStopped"
> {
  // 별도 목표 생활비 입력이 아직 없으므로 preview의 실질 인출액을 현재 판단 가능한 생활비 수요로 사용한다.
  // 월 부족액이 해당 연도 필요액의 1% 미만이면 계산 오차 수준으로 보고 부족 연도에서 제외한다.
  const rows = source.totalWithdrawRows
    .slice(retirementIndex + 1)
    .filter((row) => row.isWithdraw && nonNegative(row.realWithdraw) > EPSILON)
    .map((row) => {
      const requiredMonthlyReal = nonNegative(row.realWithdraw) / 12;
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

  if (rows.length === 0) {
    return {
      livingExpensesCovered: null,
      shortfallYears: 0,
      consecutiveShortfallYears: 0,
      incomeCoverageScore: NEUTRAL_SCORE,
      coreCashFlowStopped: false,
    };
  }

  const shortfalls = rows.map((row) => row.meaningfulShortfall);
  const shortfallYears = shortfalls.filter(Boolean).length;
  return {
    livingExpensesCovered: shortfallYears === 0,
    shortfallYears,
    consecutiveShortfallYears: maxConsecutive(shortfalls),
    incomeCoverageScore: clampScore(average(rows.map((row) => row.coverageRatio)) * 100),
    // 일부 연도의 약화와 구분해, 평가 가능한 전체 기간에서 흐름이 0일 때만 완전 중단으로 본다.
    coreCashFlowStopped: rows.every((row) => row.availableMonthlyReal <= EPSILON),
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

function isLongTermShortfall(account: AccountKind, shortfallYears: number, consecutiveShortfallYears: number): boolean {
  return account === "combined" && (shortfallYears >= 3 || consecutiveShortfallYears >= 2);
}

function resolveFailureReason(
  account: AccountKind,
  hasRetirementData: boolean,
  endingRealAssets: number,
  preservation: number,
  signals: AccountSignals,
): SafetyFailureReason {
  if (!hasRetirementData) return "DATA_INSUFFICIENT";
  if (endingRealAssets <= EPSILON || preservation <= 0.3) return "LOW_ASSET";
  if (signals.coreCashFlowStopped) return account === "brokerage" ? "DIVIDEND_STOPPED" : "INCOME_SHORTAGE";
  if (isLongTermShortfall(account, signals.shortfallYears, signals.consecutiveShortfallYears)) return "INCOME_SHORTAGE";
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

function accountMessages(account: AccountKind, metrics: SafetyMetrics, cashFlowWeakening: boolean): Pick<SafetyResult, "positives" | "warnings"> {
  const positives: string[] = [];
  const warnings: string[] = [];

  if (metrics.yearsEvaluated === 0) {
    warnings.push("평가할 은퇴 후 기간이 없어 현재 결과만으로 안전성을 판단하기 어렵습니다.");
    return { positives, warnings };
  }

  preservationMessages(metrics.preservationRatio, positives, warnings);
  if (metrics.sustainedThroughRetirement) positives.push("평가한 은퇴 기간 끝까지 실질 자산 잔고가 유지됩니다.");
  else warnings.push("평가 기간 중 실질 자산 잔고가 소진되는 구간이 있습니다.");

  if (account !== "brokerage") {
    if (metrics.livingExpensesCovered === true) positives.push("평가 기간의 생활비를 안정적으로 충당합니다.");
    else if (metrics.shortfallYears === 1) warnings.push("생활비 충당력이 일부 연도에서 약해집니다.");
    else if (metrics.shortfallYears > 1) warnings.push("여러 연도에서 생활비 충당력을 점검할 필요가 있습니다.");
    else warnings.push("현재 결과만으로 생활비 충당 여부를 판단할 수 없습니다.");
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
  const startingRealAssets = signals.assets[0] ?? 0;
  const endingRealAssets = signals.assets.at(-1) ?? 0;
  const ratio = preservationRatio(startingRealAssets, endingRealAssets);
  const yearsEvaluated = Math.max(0, signals.assets.length - 1);
  const depleted = yearsEvaluated > 0 && signals.assets.slice(1).some((value) => value <= EPSILON);
  const sustainedThroughRetirement = yearsEvaluated > 0 && !depleted;
  const preservationScore = scorePreservationRatio(ratio);
  const depletionScore = depleted ? 0 : yearsEvaluated > 0 ? 100 : NEUTRAL_SCORE;
  const stability = latePeriodStability(signals.assets);
  const reason = resolveFailureReason(
    account,
    retirementIndex >= 0 && signals.assets.length > 0,
    endingRealAssets,
    ratio,
    signals,
  );
  const failed = reason !== "NONE" && reason !== "DATA_INSUFFICIENT";
  const score = yearsEvaluated === 0 ? 0 : Math.round(calculateCompositeScore(
    account,
    preservationScore,
    depletionScore,
    signals.incomeCoverageScore,
    stability.score,
    signals.principalSold,
    signals.shortfallYears,
    signals.consecutiveShortfallYears,
  ) * 10) / 10;
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
    dividendsContinued: signals.dividendsContinued,
    incomeShortfallYears: signals.shortfallYears,
    shortfallYears: signals.shortfallYears,
    consecutiveShortfallYears: signals.consecutiveShortfallYears,
    preservationScore,
    incomeCoverageScore: signals.incomeCoverageScore,
    depletionScore,
    stabilityScore: stability.score,
    latePeriodDecline: stability.latePeriodDecline,
  };

  return {
    grade: safetyGradeFromScore(score, failed),
    score,
    ...accountMessages(account, metrics, signals.cashFlowWeakening),
    metrics,
  };
}

export function calculateRetirementSafety(source: SimulatorProjection): RetirementSafetyResult {
  const retirementIndex = source.timeline.retirementIndex ?? -1;
  const retirementRows = retirementIndex >= 0 ? source.chartRows.slice(retirementIndex) : [];
  const taxLivingExpenses = livingExpenseSignals(source, retirementIndex, "taxSaving");
  const combinedLivingExpenses = livingExpenseSignals(source, retirementIndex, "combined");
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
