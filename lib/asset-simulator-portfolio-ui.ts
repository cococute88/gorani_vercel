import type {
  AssetSimulatorPortfolioConfigV1,
  PortfolioAccountType,
  PortfolioHoldingInput,
  PortfolioHoldingResolution,
  PortfolioMetricKey,
  PortfolioMetricStatus,
  ResolvedPortfolioMetric,
  RetirementSafetyResult,
  SafetyResult,
} from "./asset-simulator-types";
import { safetyGradeFromScore } from "./asset-simulator-safety";
import { formatManwonMoney } from "./format";

// Pure, framework-free display helpers for the portfolio + safety UI. Kept out
// of the React components so the wording/logic can be unit-checked directly.

export type UiTone = "positive" | "neutral" | "caution" | "warning" | "muted";

export const ACCOUNT_LABELS: Record<PortfolioAccountType, string> = {
  taxSaving: "절세계좌 포트폴리오",
  brokerage: "위탁계좌 포트폴리오",
};

export const ACCOUNT_SHORT_LABELS: Record<PortfolioAccountType, string> = {
  taxSaving: "절세계좌",
  brokerage: "위탁계좌",
};

export function accountLabel(accountType: PortfolioAccountType): string {
  return ACCOUNT_LABELS[accountType];
}

// Weights are stored as percentages; round to whole basis points to avoid float
// noise when checking the 100% total (mirrors validatePortfolioConfig).
export function sumWeightBasisPoints(holdings: PortfolioHoldingInput[]): number {
  return holdings.reduce((sum, holding) => {
    return sum + (Number.isFinite(holding.weightPct) ? Math.round(holding.weightPct * 100) : 0);
  }, 0);
}

export function sumWeightPct(holdings: PortfolioHoldingInput[]): number {
  return Number((sumWeightBasisPoints(holdings) / 100).toFixed(2));
}

export function isWeightTotalValid(holdings: PortfolioHoldingInput[]): boolean {
  return sumWeightBasisPoints(holdings) === 10_000;
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

// 계산 원값은 유지하되, 네 자리 이상 보존율은 카드에서 과장되어 보이지 않게 상한 표기한다.
export function formatPreservationRatio(ratio: number | null | undefined): string {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return "—";
  const percentage = ratio * 100;
  return percentage >= 1_000 ? "1,000% 이상" : formatPct(percentage, 0);
}

export function formatYears(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(1)}년`;
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${start ?? "—"} ~ ${end ?? "—"}`;
}

export type MetricStatusDescriptor = {
  label: string;
  tone: UiTone;
};

// Human-friendly, non-alarming status wording for a single resolved metric.
// The "무배당" (no-dividend) case is inferred from a not_applicable status whose
// value resolved to exactly 0 for a dividend metric.
export function describeMetricStatus(
  metric: ResolvedPortfolioMetric,
  options: { isDividendMetric?: boolean } = {},
): MetricStatusDescriptor {
  const status: PortfolioMetricStatus = metric.status;
  switch (status) {
    case "resolved":
      return { label: "계산 완료", tone: "positive" };
    case "manual":
      return { label: "수동 입력", tone: "neutral" };
    case "insufficient_history":
      return { label: "데이터 부족 · 수동 보완", tone: "caution" };
    case "not_applicable":
      if (options.isDividendMetric && metric.valuePct === 0) {
        return { label: "무배당", tone: "neutral" };
      }
      return { label: "해당 없음", tone: "muted" };
    case "failed":
    default:
      return { label: "조회 실패", tone: "warning" };
  }
}

export type SafetyDisplay = {
  gradeLabel: string;
  toneLabel: string;
  tone: UiTone;
  showScore: boolean;
};

// grade === null must never render as "F". Map the not-yet-evaluated states to
// their own soft copy and only show a letter grade when status === "evaluated".
export function describeSafety(result: SafetyResult): SafetyDisplay {
  if (result.status === "not_applicable") {
    return { gradeLabel: "평가 대상 없음", toneLabel: "현재 평가할 데이터가 없습니다", tone: "muted", showScore: false };
  }
  if (result.status === "data_insufficient" || result.grade === null) {
    return {
      gradeLabel: "데이터 부족",
      toneLabel: "데이터를 보완하면 평가할 수 있습니다",
      tone: "muted",
      showScore: false,
    };
  }

  const score = result.score;
  const depleted = result.metrics.depleted;
  const severeShortfall = result.metrics.consecutiveSevereShortfallYears >= 2 || result.metrics.severeShortfallYears >= 3;
  const persistentSevereShortfall = severeShortfall && (result.metrics.monthlyIncomeCoverageRatio ?? 1) < 0.8;
  const descriptor = depleted || result.metrics.failed || score < 50
    ? { gradeLabel: "위험", toneLabel: "고갈위험 높음", tone: "warning" as UiTone }
    : persistentSevereShortfall || score < 65
      ? { gradeLabel: "주의", toneLabel: "부족 구간 점검", tone: "caution" as UiTone }
      : severeShortfall || score < 80
        ? { gradeLabel: "보통", toneLabel: "일부 보수적 점검", tone: "caution" as UiTone }
        : { gradeLabel: "안전", toneLabel: "고갈위험 낮음", tone: "positive" as UiTone };
  return { ...descriptor, showScore: true };
}

function capStressResultForDisplay(base: SafetyResult, stress: SafetyResult): SafetyResult {
  if (base.status !== "evaluated" || stress.status !== "evaluated" || stress.score <= base.score) return stress;

  const score = base.score;
  return {
    ...stress,
    score,
    grade: safetyGradeFromScore(score, stress.metrics.failed),
  };
}

// stress 계산값과 metrics는 수정하지 않고, 같은 계정의 비교 카드에 쓰는 점수/등급만 base 이하로 제한한다.
export function calibrateStressSafetyForDisplay(
  base: RetirementSafetyResult,
  stress: RetirementSafetyResult,
): RetirementSafetyResult {
  return {
    taxSaving: capStressResultForDisplay(base.taxSaving, stress.taxSaving),
    brokerage: capStressResultForDisplay(base.brokerage, stress.brokerage),
    combined: capStressResultForDisplay(base.combined, stress.combined),
  };
}

// 충당률(월 수요 대비 월 현금흐름 평균, 0~1)을 백분율 문자열로 표시한다. 값이 없으면 대시.
export function formatCoverageRatio(ratio: number | null | undefined): string {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return "—";
  return formatPct(ratio * 100, 0);
}

// 안전성 결과를 "강함 / 보통 / 약함 / 평가 불가" 4단계로 요약한다.
// 대시보드 요약 문구와 시나리오 비교 카드가 같은 기준으로 톤을 정하도록 공유한다.
export type SafetyTier = "strong" | "moderate" | "weak" | "none";

export function safetyTier(result: SafetyResult): SafetyTier {
  if (result.status !== "evaluated" || result.grade === null) return "none";
  if (result.metrics.failed) return "weak";
  if (result.grade === "S" || result.grade === "A" || result.grade === "B") return "strong";
  if (result.grade === "C") return "moderate";
  return "weak";
}

// 계좌별 안전성 카드의 "평가 기준"을 명확히 안내한다.
// 목표 월생활비는 통합 평가에만 반영되므로, 절세/위탁 단독 카드는 각자의 기준을 명시한다.
// (계산 로직은 변경하지 않고, 이미 정해진 평가 기준을 문구로만 드러낸다.)
export type SafetyBasis = {
  label: string;
  sub?: string;
};

export function describeSafetyBasis(
  account: "taxSaving" | "brokerage" | "combined",
  targetMonthlyExpenseReal: number | null,
): SafetyBasis {
  if (account === "taxSaving") {
    return {
      label: "평가 기준: 절세계좌 인출 계획 기준",
      sub: "목표 월생활비는 통합 안정성 평가에 반영됩니다.",
    };
  }
  if (account === "brokerage") {
    return {
      label: "평가 기준: 배당 현금흐름과 자산 보존성",
      sub: "목표 월생활비 충당 여부는 통합 안정성에서 함께 봅니다.",
    };
  }
  // combined
  if (targetMonthlyExpenseReal !== null) {
    return { label: `평가 기준: 목표 월생활비 ${formatManwonMoney(targetMonthlyExpenseReal)}` };
  }
  return {
    label: "평가 기준: 임시 인출 기준",
    sub: "목표 월생활비를 입력하면 더 정확해집니다.",
  };
}

// ---------------------------------------------------------------------------
// 계좌 진단 행(SafetyAccountDiagnosis) + 계좌 기준 상세 아코디언 파생 헬퍼.
// 계산 로직을 새로 만들지 않고, 이미 계산된 SafetyResult 의 상태/등급/톤만 해석한다.
// ---------------------------------------------------------------------------

export type SafetyAccountKey = "taxSaving" | "brokerage" | "combined";

// 계좌별 평가 기준 도움말(전체 문구). 진단 행의 ⓘ / 상세에서 한 번만 노출한다.
// 목표 월생활비가 어느 평가에 반영되는지 오해하지 않도록 계좌마다 기준을 명시한다.
export function describeAccountBasisHelp(
  account: SafetyAccountKey,
  targetMonthlyExpenseReal: number | null,
): string {
  if (account === "taxSaving") {
    return "절세계좌 안전성은 연금·ISA 인출 계획 기준입니다. 목표 월생활비 충당 여부는 통합 안전성에서 확인합니다.";
  }
  if (account === "brokerage") {
    return "위탁계좌 안전성은 배당 현금흐름과 자산 보존성을 봅니다. 목표 월생활비 충당 여부는 통합 안전성에서 함께 확인합니다.";
  }
  if (targetMonthlyExpenseReal !== null) {
    return `통합 안전성은 목표 월생활비 ${formatManwonMoney(targetMonthlyExpenseReal)} 충당과 실질 자산 보존을 함께 봅니다.`;
  }
  return "통합 안전성은 임시 인출 기준 평가입니다. 목표 월생활비를 입력하면 목표 기준으로 전환됩니다.";
}

// 진단 행/아코디언 요약에 붙는 짧은 기준 문구.
export function accountBasisShort(
  account: SafetyAccountKey,
  targetMonthlyExpenseReal: number | null,
): string {
  if (account === "taxSaving") return "절세계좌 인출 계획 기준";
  if (account === "brokerage") return "배당 현금흐름·자산 보존성 기준";
  return targetMonthlyExpenseReal !== null ? "목표 월생활비 기준" : "임시 인출 기준";
}

export type AccountDiagnosis = {
  // Good→Bad 변화 요약. 미평가면 회색 보조 문구 하나만 담는다.
  changeText: string;
  // 한줄 근거.
  reason: string;
  tone: UiTone;
  // Good status === "evaluated" 여부. false 면 큰 등급처럼 표시하지 않는다.
  evaluated: boolean;
  basisShort: string;
};

// 계좌 진단 한 행의 변화 요약/근거/톤을 파생한다.
// - Good이 미평가(not_applicable/data_insufficient)면 등급 대신 회색 안내로 강등한다.
// - 평가된 경우 Good/Bad tier 를 비교해 "안정 / Bad 약화 / 점검 필요" 근거를 만든다.
export function describeAccountDiagnosis(
  account: SafetyAccountKey,
  basic: SafetyResult,
  stress: SafetyResult,
  hasTarget: boolean,
  targetMonthlyExpenseReal: number | null,
): AccountDiagnosis {
  const basicDisplay = describeSafety(basic);
  const stressDisplay = describeSafety(stress);
  const basisShort = accountBasisShort(account, targetMonthlyExpenseReal);

  if (basic.status !== "evaluated") {
    const reason =
      basic.status === "not_applicable"
        ? account === "brokerage"
          ? "위탁계좌 잔고 또는 배당 데이터가 있으면 평가됩니다."
          : "평가할 데이터가 준비되면 등급이 표시됩니다."
        : "가정 수정에서 수동 보완한 뒤 결과를 다시 확인할 수 있습니다.";
    return { changeText: basicDisplay.gradeLabel, reason, tone: "muted", evaluated: false, basisShort };
  }

  const changeText =
    stress.status === "evaluated"
      ? `${basicDisplay.gradeLabel} → ${stressDisplay.gradeLabel}`
      : basicDisplay.gradeLabel;

  const basicTier = safetyTier(basic);
  const stressTier = safetyTier(stress);

  let reason: string;
  let tone: UiTone;
  if (basicTier === "weak") {
    tone = "warning";
    reason =
      account === "combined"
        ? hasTarget
          ? "현재 입력 기준으로는 목표 생활비 대비 부족해 조정 검토가 필요합니다."
          : "현재 입력 기준으로는 보수적 조정 검토가 필요합니다."
        : "현재 입력 기준으로도 점검이 필요합니다.";
  } else if (basicTier === "strong" && stressTier === "strong") {
    tone = "positive";
    reason = "Good과 Bad 모두 안정적입니다.";
  } else if (basicTier === "strong") {
    tone = "caution";
    reason =
      account === "taxSaving"
        ? "Bad에서는 자산 보존율이 약해집니다."
        : account === "brokerage"
          ? "Bad에서는 배당 현금흐름이 약해질 수 있습니다."
          : "Bad에서 충당률이 약해져 조정 검토가 필요합니다.";
  } else {
    // basicTier === "moderate"
    tone = "caution";
    reason = "대체로 안정적이나 Bad에서는 일부 항목 점검이 필요합니다.";
  }

  return { changeText, reason, tone, evaluated: true, basisShort };
}

// ---------------------------------------------------------------------------
// Good/Bad 단일 비교표(SafetyScenarioCompareTable) 파생 헬퍼.
// 새 계산 로직을 만들지 않고, 이미 계산된 SafetyResult/metrics 를 표시용으로 가공만 한다.
// ---------------------------------------------------------------------------

// Bad 시나리오 설명은 한 곳에서만 노출한다(중복 배너 방지).
export const STRESS_SCENARIO_NOTE =
  "Bad는 첫 인출연도 -30% 충격과 이후 2년 정체를 적용한 순서위험 시나리오입니다. 4년 차부터는 Normal과 같은 입력 성장률의 85%를 적용하며, 장기성장률 65%가 영구 적용되는 시나리오가 아닙니다. 배당성장률은 50%로 유지하고 배당률은 첫 3년만 20% 삭감합니다.";

const DELTA_EPSILON = 1e-9;

export type ScenarioDeltaDirection = "down" | "up" | "flat";

export type ScenarioCompareRowKey = "grade" | "coverage" | "preservation" | "asset";

export type ScenarioCompareRow = {
  key: ScenarioCompareRowKey;
  label: string;
  // Good/Bad 셀에 표시할 문자열.
  basicText: string;
  stressText: string;
  // 변화 열 본문(방향 기호 제외). 예: "25%p", "2억 4,167만원", "B → D (-28.6점)".
  deltaText: string;
  direction: ScenarioDeltaDirection;
  // 변화 심각도 톤: 악화 caution(amber), 심각 악화 warning(rose), 개선/동일 muted(slate).
  tone: UiTone;
  // delta bar 길이(감소 비율, 0~1). 등급 행은 bar 를 쓰지 않는다(showBar=false).
  magnitude: number;
  showBar: boolean;
};

function directionOf(delta: number): ScenarioDeltaDirection {
  if (delta < -DELTA_EPSILON) return "down";
  if (delta > DELTA_EPSILON) return "up";
  return "flat";
}

// 백분율 포인트(%p) 계열 행(충당률·보존율)의 변화 텍스트.
// 보존율이 1,000% 이상처럼 큰 경우 %p 가 과장되므로 상대 감소율(%)로 대체한다.
function deltaPointText(deltaPP: number, reduction: number, capped: boolean, direction: ScenarioDeltaDirection): string {
  if (direction === "flat") return "동일";
  if (capped) return `약 ${Math.round(Math.max(0, reduction) * 100)}%`;
  return `${Math.abs(Math.round(deltaPP))}%p`;
}

// Good/Bad 비교표의 4개 행(등급·충당률·보존율·최종자산)을 구성한다.
export function buildScenarioComparisonRows(
  basic: SafetyResult,
  stress: SafetyResult,
  basicFinalReal: number,
  stressFinalReal: number,
  hasTarget: boolean,
): ScenarioCompareRow[] {
  const rows: ScenarioCompareRow[] = [];

  // A. 통합 등급 — 텍스트 중심, delta bar 없음.
  const basicG = describeSafety(basic);
  const stressG = describeSafety(stress);
  const bothEvaluated = basic.status === "evaluated" && stress.status === "evaluated";
  const scoreDelta = bothEvaluated ? Math.round((stress.score - basic.score) * 10) / 10 : 0;
  rows.push({
    key: "grade",
    label: "통합 등급",
    basicText: basicG.showScore ? `${basicG.gradeLabel} · ${basic.score}점` : basicG.gradeLabel,
    stressText: stressG.showScore ? `${stressG.gradeLabel} · ${stress.score}점` : stressG.gradeLabel,
    deltaText: bothEvaluated
      ? `${basicG.gradeLabel} → ${stressG.gradeLabel} (${scoreDelta > 0 ? "+" : ""}${scoreDelta.toFixed(1)}점)`
      : `${basicG.gradeLabel} → ${stressG.gradeLabel}`,
    direction: directionOf(scoreDelta),
    tone: scoreDelta < -DELTA_EPSILON ? "caution" : "muted",
    magnitude: 0,
    showBar: false,
  });

  // B. 월생활비 충당률 — 목표 미입력이면 임시 표시(bar 없음).
  const basicCov = basic.metrics.monthlyIncomeCoverageRatio;
  const stressCov = stress.metrics.monthlyIncomeCoverageRatio;
  if (!hasTarget || typeof basicCov !== "number" || typeof stressCov !== "number") {
    rows.push({
      key: "coverage",
      label: "월생활비 충당률",
      basicText: "목표 입력 시 표시",
      stressText: "목표 입력 시 표시",
      deltaText: "목표 입력 시",
      direction: "flat",
      tone: "muted",
      magnitude: 0,
      showBar: false,
    });
  } else {
    // 표시되는 반올림 %(28%/24%)와 변화 %p 가 어긋나지 않도록, 반올림된 백분율의 차이로 계산한다.
    const deltaPP = Math.round(stressCov * 100) - Math.round(basicCov * 100);
    const reduction = basicCov > DELTA_EPSILON ? Math.max(0, (basicCov - stressCov) / basicCov) : 0;
    const direction = directionOf(deltaPP);
    // rose 승격: Bad 충당률이 90% 미만으로 떨어질 때.
    const tone: UiTone = direction === "down" ? (stressCov < 0.9 ? "warning" : "caution") : "muted";
    rows.push({
      key: "coverage",
      label: "월생활비 충당률",
      basicText: formatCoverageRatio(basicCov),
      stressText: formatCoverageRatio(stressCov),
      deltaText: deltaPointText(deltaPP, reduction, false, direction),
      direction,
      tone,
      magnitude: Math.min(1, reduction),
      showBar: true,
    });
  }

  // C. 자산 보존율 — 1,000% 이상은 capped 표시 정책 유지.
  const basicPres = basic.metrics.preservationRatio;
  const stressPres = stress.metrics.preservationRatio;
  {
    const valid = Number.isFinite(basicPres) && Number.isFinite(stressPres);
    // 표시되는 반올림 %와 변화 %p 를 일치시킨다(비-capped 구간).
    const deltaPP = valid ? Math.round(stressPres * 100) - Math.round(basicPres * 100) : 0;
    const reduction = valid && basicPres > DELTA_EPSILON ? Math.max(0, (basicPres - stressPres) / basicPres) : 0;
    const direction = directionOf(deltaPP);
    const capped = valid && (basicPres >= 10 || stressPres >= 10);
    // rose 승격: 상대 감소율 25% 이상.
    const tone: UiTone = direction === "down" ? (reduction >= 0.25 ? "warning" : "caution") : "muted";
    rows.push({
      key: "preservation",
      label: "실가치보존율",
      basicText: formatPreservationRatio(basicPres),
      stressText: formatPreservationRatio(stressPres),
      deltaText: deltaPointText(deltaPP, reduction, capped, direction),
      direction,
      tone,
      magnitude: Math.min(1, reduction),
      showBar: true,
    });
  }

  // D. 최종 실질자산.
  {
    const deltaAbs = stressFinalReal - basicFinalReal;
    const reduction = basicFinalReal > DELTA_EPSILON ? Math.max(0, (basicFinalReal - stressFinalReal) / basicFinalReal) : 0;
    const direction = directionOf(deltaAbs);
    // rose 승격: 상대 감소율 25% 이상.
    const tone: UiTone = direction === "down" ? (reduction >= 0.25 ? "warning" : "caution") : "muted";
    rows.push({
      key: "asset",
      label: "최종 실질자산",
      basicText: formatManwonMoney(basicFinalReal),
      stressText: formatManwonMoney(stressFinalReal),
      deltaText: direction === "flat" ? "동일" : formatManwonMoney(Math.abs(deltaAbs)),
      direction,
      tone,
      magnitude: Math.min(1, reduction),
      showBar: true,
    });
  }

  return rows;
}

export type WorsenedItem = { label: string; deltaText: string; tone: UiTone };
export type WorsenedSummary = { headline: string; items: WorsenedItem[]; hasSevere: boolean };

// 비교표 아래 "Bad에서 약해진 항목" 한 줄 요약을 구성한다.
export function summarizeWorsenedMetrics(rows: ScenarioCompareRow[]): WorsenedSummary {
  const items: WorsenedItem[] = rows
    .filter((row) => row.showBar && row.direction === "down" && (row.tone === "caution" || row.tone === "warning"))
    .map((row) => ({ label: row.label, deltaText: `-${row.deltaText}`, tone: row.tone }));
  return {
    headline: items.length === 0
      ? "Bad에서도 핵심 지표가 크게 약해지지 않았습니다."
      : "Bad에서 약해진 항목",
    items,
    hasSevere: items.some((item) => item.tone === "warning"),
  };
}

// warnings/metrics 를 근거로 "다음 조정 후보" 칩 문구를 2~3개 만든다.
// 새 투자 조언이 아니라 점검 항목을 부드럽게 제안한다("검토/점검/보완/재확인").
export function deriveAdjustmentCandidates(
  basic: SafetyResult,
  stress: SafetyResult,
  hasTarget: boolean,
): string[] {
  const out: string[] = [];
  const push = (label: string) => {
    if (out.length < 3 && !out.includes(label)) out.push(label);
  };

  const warnText = [...basic.warnings, ...stress.warnings].join(" ");
  const basicCov = basic.metrics.monthlyIncomeCoverageRatio;
  const stressCov = stress.metrics.monthlyIncomeCoverageRatio;
  const presRed = Number.isFinite(basic.metrics.preservationRatio) && basic.metrics.preservationRatio > DELTA_EPSILON
    ? (basic.metrics.preservationRatio - stress.metrics.preservationRatio) / basic.metrics.preservationRatio
    : 0;

  if (!hasTarget) push("목표 생활비 입력 후 재점검");
  if (hasTarget && ((typeof stressCov === "number" && stressCov < 0.9) || (typeof basicCov === "number" && basicCov < 1))) {
    push("목표 생활비 조정 검토");
  }
  if (/배당/.test(warnText)) push("배당 현금흐름 보강 점검");
  if (/인출|절세|연금|ISA/.test(warnText)) push("절세계좌 인출 계획 점검");
  if (presRed >= 0.25) push("현금·안전자산 비중 점검");
  push("포트폴리오 가정 재확인");

  return out.slice(0, 3);
}

export type SafetyVerdict = {
  // 한줄 판단. 단정적 표현을 피하고 부드럽게 안내한다.
  headline: string;
  tone: UiTone;
  // 목표 월생활비 미입력 시에만 채워지는 보조 안내.
  subline?: string;
};

export type ScenarioRiskVerdict = {
  label: "안전" | "보통" | "주의" | "위험";
  score: number;
  description: string;
};

// Good/Normal/Bad의 실제 고갈·부족 신호를 함께 해석한다. 기존 S/A/B/F는 원자료로만 남긴다.
export function describeScenarioRisk(
  good: SafetyResult,
  normal: SafetyResult,
  bad: SafetyResult,
): ScenarioRiskVerdict {
  const results = [good, normal, bad];
  const score = Math.round(Math.min(...results.map((result) => result.score)));
  const depleted = (result: SafetyResult) => result.metrics.depleted || result.metrics.endingRealAssets <= 0;
  const shortfalls = (result: SafetyResult) => result.metrics.shortfallYears;
  const severeShortfall = (result: SafetyResult) => result.metrics.consecutiveSevereShortfallYears >= 2
    || result.metrics.severeShortfallYears >= 3;
  const persistentSevereShortfall = (result: SafetyResult) => severeShortfall(result)
    && (result.metrics.monthlyIncomeCoverageRatio ?? 1) < 0.8;

  if (depleted(good) || depleted(normal) || good.metrics.failed || normal.metrics.failed || bad.metrics.failed || persistentSevereShortfall(normal) || persistentSevereShortfall(bad)) {
    return { label: "위험", score, description: "Good·Normal·Bad 중 자산 고갈·낮은 보존율·큰 생활비 부족 신호가 있습니다." };
  }
  if (shortfalls(normal) > 0 || depleted(bad) || bad.metrics.preservationRatio < 0.5) {
    return { label: "주의", score, description: "Normal 또는 Bad에서 생활비 부족·자산 보존 약화가 확인됩니다." };
  }
  if (shortfalls(bad) > 0 || bad.metrics.preservationRatio < 0.8) {
    return { label: "보통", score, description: "Bad에서 일부 보수적 점검이 필요하지만 자산 고갈은 없습니다." };
  }
  return { label: "안전", score, description: "Good·Normal·Bad 모두 목표 월생활비와 자산 잔고를 유지합니다." };
}

// 통합 안전성(Good + Bad) 결과에서 한줄 판단을 파생한다.
// 계산 로직을 새로 만들지 않고, 기존 SafetyResult 의 등급/상태만 해석한다.
export function describeSafetyVerdict(
  basicCombined: SafetyResult,
  stressCombined: SafetyResult,
  hasTarget: boolean,
): SafetyVerdict {
  const subline = hasTarget ? undefined : "목표 월생활비를 입력하면 목표 기준 평가로 전환됩니다.";

  const basicTier = safetyTier(basicCombined);
  if (basicTier === "none") {
    return {
      headline: "확인 필요 — 데이터 부족으로 일부 항목을 평가하지 못했습니다.",
      tone: "muted",
      subline,
    };
  }

  if (basicTier === "weak") {
    return {
      headline: hasTarget
        ? "현재 입력 기준으로는 목표 생활비 대비 부족합니다."
        : "현재 입력 기준으로는 보수적 점검이 필요합니다.",
      tone: "warning",
      subline,
    };
  }

  const stressTier = safetyTier(stressCombined);
  if (basicTier === "strong" && stressTier === "strong") {
    return {
      headline: hasTarget
        ? "현재 입력 기준으로 Good과 Bad 모두 목표 생활비를 충당합니다."
        : "현재 입력 기준으로 Good과 Bad 모두 안정적입니다.",
      tone: "positive",
      subline,
    };
  }

  if (basicTier === "strong") {
    return {
      headline: "Good 시나리오는 안정적이지만, Bad에서는 조정 권장입니다.",
      tone: "caution",
      subline,
    };
  }

  // Good이 "보통(C)" 구간인 경우.
  return {
    headline: "Good 시나리오는 대체로 안정적이나 일부 항목은 점검이 필요합니다.",
    tone: "caution",
    subline,
  };
}

export type PortfolioApplyState =
  | "none" // 아직 자동 계산/적용 없음
  | "clean" // 적용된 가정 == 현재 설정
  | "config_changed" // 설정이 바뀌어 재적용 필요
  | "stale"; // 적용된 가정이 오래됨

export function describeApplyState(state: PortfolioApplyState): { label: string; tone: UiTone } | null {
  switch (state) {
    case "none":
      return {
        // 아직 적용 전. ("아직" 키워드는 회귀 테스트에서 검증한다.)
        label: "아직 적용 전입니다. 자동 계산 또는 수동 입력 후 가정을 적용하면 시뮬레이션에 반영됩니다.",
        tone: "neutral",
      };
    case "config_changed":
      return {
        // 설정이 적용 시점과 달라짐. ("다릅니다" 키워드는 회귀 테스트에서 검증한다.)
        label: "설정이 적용 시점과 다릅니다. 다시 적용해야 결과에 반영됩니다.",
        tone: "caution",
      };
    case "stale":
      return {
        // 적용된 가정이 오래됨. ("오래" 키워드는 회귀 테스트에서 검증한다.)
        label: "적용한 지 오래된 가정입니다. 자동 계산을 갱신해 다시 적용하는 것을 권장합니다.",
        tone: "caution",
      };
    case "clean":
    default:
      // 적용됨(설정 일치)은 배너 대신 컴포넌트의 긍정 배지로 표시한다.
      return null;
  }
}

// 적용 완료 상태(설정 일치)에서 노출하는 긍정 배지 문구.
export const APPLY_CLEAN_BADGE = "적용된 가정으로 시뮬레이션 반영 중";

// 저장된 가정은 반영 중이지만, 세션 상태인 자동 계산 결과가 아직 없을 때의 안내.
// "적용됨"과 "자동 계산 결과 없음"을 분리해, 새로고침 직후 적용이 풀렸다고 오해하지 않게 한다.
export const SAVED_ASSUMPTIONS_SESSION_HINT =
  "저장된 가정은 시뮬레이션에 반영 중입니다. 자동 계산 결과는 세션마다 다시 불러와야 합니다.";

export const AUTO_NOT_APPLIED_HINT = "자동 계산 결과는 아직 반영되지 않았습니다. 적용하면 시뮬레이션에 반영됩니다.";

// 수동 fallback 안내 문구. 실패/데이터 부족/일반 상황을 짧고 부드럽게 구분한다.
export const MANUAL_FALLBACK_HINTS = {
  general: "수동 입력으로 보완할 수 있습니다.",
  fetchFailed: "자동 계산이 실패해도 직접 가정을 입력하면 적용할 수 있습니다.",
  shortHistory: "이력이 짧은 ETF는 수동 보완이 필요할 수 있습니다.",
} as const;

// 적용 버튼이 미해결 항목 때문에 막혀 있을 때의 안내 문구.
export const APPLY_BLOCKED_HINT =
  "적용하려면 남은 항목을 먼저 정리해 주세요. 자동 계산을 실행하거나 수동 입력으로 보완할 수 있습니다.";

// 자동 계산이 진행 중일 때의 안내 문구.
export const APPLY_WHILE_LOADING_HINT = "자동 계산이 끝나면 적용할 수 있습니다.";

// 자동 계산 "결과"가 오래된 경우의 안내. (적용된 가정이 오래된 경우는 describeApplyState("stale")로 별도 안내한다.)
export const AUTO_RESULT_STALE_HINT = "자동 계산 결과가 오래됐습니다. 적용 전 다시 계산하는 것을 권장합니다.";

// 자동 계산 결과가 이 시간보다 오래되면 재계산을 권장한다. (적용 가정 stale 기준 7일과 구분되는 별도 창.)
export const AUTO_RESULT_STALE_MS = 24 * 60 * 60 * 1000;

const REQUIRED_METRIC_KEYS: Record<PortfolioAccountType, PortfolioMetricKey[]> = {
  taxSaving: ["totalReturnCagr"],
  brokerage: ["priceCagr", "dividendYield", "dividendGrowth"],
};

// 적용 가정 빌더(asset-simulator-portfolio-assumptions)의 isAllowedMetric 과 동일한 규칙.
// 여기서 미리 판정해 적용 게이트/수동 fallback 안내를 실시간으로 맞춘다.
function isMetricUsable(metric: PortfolioMetricKey, value: ResolvedPortfolioMetric): boolean {
  if (value.status === "resolved") return value.valuePct !== null && Number.isFinite(value.valuePct);
  return (
    (metric === "dividendYield" || metric === "dividendGrowth") &&
    value.status === "not_applicable" &&
    value.valuePct === 0
  );
}

// 자동 계산 결과가 (수동 보완 없이는) 적용 불가한 상태인지 판정한다.
export function resolutionNeedsManualFallback(
  resolution: PortfolioHoldingResolution,
  accountType: PortfolioAccountType,
): boolean {
  return REQUIRED_METRIC_KEYS[accountType].some((metric) => !isMetricUsable(metric, resolution[metric]));
}

// 계좌에 필요한 지표 중 이력 부족(insufficient_history)이 있는지 판정한다.
export function resolutionHasInsufficientHistory(
  resolution: PortfolioHoldingResolution,
  accountType: PortfolioAccountType,
): boolean {
  return REQUIRED_METRIC_KEYS[accountType].some(
    (metric) => resolution[metric].status === "insufficient_history",
  );
}

// 자동 계산 결과가 오래되었는지(재계산 권장) 판정한다. resolvedAt 이 없으면 stale 아님.
export function isAutoResultStale(
  resolvedAt: string | null | undefined,
  now: Date = new Date(),
  maxAgeMs: number = AUTO_RESULT_STALE_MS,
): boolean {
  if (!resolvedAt) return false;
  const ms = Date.parse(resolvedAt);
  if (!Number.isFinite(ms)) return false;
  return now.getTime() - ms > maxAgeMs;
}

// Small shared key so the page/section can index transient resolver results.
export function resolutionKey(accountType: PortfolioAccountType, ticker: string): string {
  return `${accountType}:${ticker}`;
}

export function isEmptyPortfolioConfig(config: AssetSimulatorPortfolioConfigV1 | null | undefined): boolean {
  if (!config) return true;
  return config.taxSaving.holdings.length === 0 && config.brokerage.holdings.length === 0;
}

// ---------------------------------------------------------------------------
// 계좌 카드 헤더 / 설정 단계 표시(stepper) 파생 헬퍼.
// 계산·resolver·저장 로직은 건드리지 않고, 이미 계산된 상태를 표시용으로만 해석한다.
// ---------------------------------------------------------------------------

// 계좌 카드 헤더에 쓰는 비중 합계 요약. 100%면 "완료", 아니면 amber "확인 필요".
export type AccountWeightSummary = {
  pct: number;
  valid: boolean;
  label: string; // 예: "100% 완료" / "95% 확인 필요"
  tone: UiTone;
};

export function describeAccountWeight(holdings: PortfolioHoldingInput[]): AccountWeightSummary {
  const pct = sumWeightPct(holdings);
  const valid = isWeightTotalValid(holdings);
  return {
    pct,
    valid,
    label: `${pct}% ${valid ? "완료" : "확인 필요"}`,
    tone: valid ? "positive" : "caution",
  };
}

// 설정 패널 상단 단계 표시(stepper)의 각 단계 상태.
export type SetupStepStatus = "complete" | "in_progress" | "attention" | "pending";
export type SetupStepId = "input" | "compute" | "apply";
export type SetupStep = {
  id: SetupStepId;
  n: string;
  label: string;
  status: SetupStepStatus;
};

export const SETUP_STEP_STATUS_LABEL: Record<SetupStepStatus, string> = {
  complete: "완료",
  in_progress: "진행 중",
  attention: "확인 필요",
  pending: "대기",
};

// 티커/비중 입력 → 자동 계산·수동 보완 → 가정 적용의 3단계 상태를 파생한다.
// 입력은 컴포넌트가 이미 계산해 둔 게이트 값들만 받아 순수 함수로 유지한다.
export function describePortfolioSetupSteps(input: {
  hasHoldings: boolean;
  weightsValid: boolean; // 두 계좌 모두 100%
  anyLoading: boolean; // 자동 계산 진행 중
  needsAttention: boolean; // 데이터 부족/조회 실패 등 수동 보완 필요 항목 존재
  canApply: boolean; // 지금 적용 가능(적용 게이트 통과)
  applyState: PortfolioApplyState;
}): SetupStep[] {
  const { hasHoldings, weightsValid, anyLoading, needsAttention, canApply, applyState } = input;
  const applied = applyState === "clean" || applyState === "stale";

  // 1단계: 티커/비중 입력.
  const input1: SetupStepStatus = !hasHoldings ? "pending" : weightsValid ? "complete" : "attention";

  // 2단계: 자동 계산 또는 수동 보완.
  let compute: SetupStepStatus;
  if (!hasHoldings) compute = "pending";
  else if (anyLoading) compute = "in_progress";
  else if (needsAttention) compute = "attention";
  else if (canApply || applied) compute = "complete";
  else compute = "pending";

  // 3단계: 가정 적용.
  let apply: SetupStepStatus;
  if (applyState === "clean") apply = "complete";
  else if (applyState === "config_changed" || applyState === "stale") apply = "attention";
  else if (canApply) apply = "in_progress";
  else apply = "pending";

  return [
    { id: "input", n: "1", label: "티커·비중 입력", status: input1 },
    { id: "compute", n: "2", label: "자동 계산 또는 수동 보완", status: compute },
    { id: "apply", n: "3", label: "가정 적용", status: apply },
  ];
}
