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

  const toneByGrade: Record<string, { toneLabel: string; tone: UiTone }> = {
    S: { toneLabel: "매우 안정적", tone: "positive" },
    A: { toneLabel: "안정적", tone: "positive" },
    B: { toneLabel: "양호", tone: "positive" },
    C: { toneLabel: "점검 필요", tone: "caution" },
    D: { toneLabel: "보수적 조정 권장", tone: "warning" },
    F: { toneLabel: "보수적 조정 권장", tone: "warning" },
  };
  const descriptor = toneByGrade[result.grade] ?? { toneLabel: "점검 필요", tone: "caution" as UiTone };
  return { gradeLabel: result.grade, toneLabel: descriptor.toneLabel, tone: descriptor.tone, showScore: true };
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

// 충당률(월 수요 대비 월 공급 평균, 0~1)을 백분율 문자열로 표시한다. 값이 없으면 대시.
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

export type SafetyVerdict = {
  // 한줄 판단. 단정적 표현을 피하고 부드럽게 안내한다.
  headline: string;
  tone: UiTone;
  // 목표 월생활비 미입력 시에만 채워지는 보조 안내.
  subline?: string;
};

// 통합 안전성(기본 + 하락장) 결과에서 한줄 판단을 파생한다.
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
        ? "현재 입력 기준으로 기본과 하락장 모두 목표 생활비를 충당합니다."
        : "현재 입력 기준으로 기본과 하락장 모두 안정적입니다.",
      tone: "positive",
      subline,
    };
  }

  if (basicTier === "strong") {
    return {
      headline: "기본 시나리오는 안정적이지만, 하락장에서는 조정 권장입니다.",
      tone: "caution",
      subline,
    };
  }

  // 기본이 "보통(C)" 구간인 경우.
  return {
    headline: "기본 시나리오는 대체로 안정적이나 일부 항목은 점검이 필요합니다.",
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
        label: "아직 포트폴리오 가정이 적용되지 않았습니다.",
        tone: "neutral",
      };
    case "config_changed":
      return {
        label: "현재 설정이 적용된 가정과 다릅니다. 다시 적용하면 반영됩니다.",
        tone: "caution",
      };
    case "stale":
      return {
        label: "적용된 가정이 오래됐습니다. 필요하면 다시 계산해 적용해 주세요.",
        tone: "caution",
      };
    case "clean":
    default:
      return null;
  }
}

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
