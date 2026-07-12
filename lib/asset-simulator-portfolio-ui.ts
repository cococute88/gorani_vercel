import type {
  AssetSimulatorPortfolioConfigV1,
  PortfolioAccountType,
  PortfolioHoldingInput,
  PortfolioHoldingResolution,
  PortfolioMetricKey,
  PortfolioMetricStatus,
  ResolvedPortfolioMetric,
  SafetyResult,
} from "./asset-simulator-types";

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
