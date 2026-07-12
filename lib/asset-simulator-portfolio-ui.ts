import type {
  AssetSimulatorPortfolioConfigV1,
  PortfolioAccountType,
  PortfolioHoldingInput,
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
      return { label: "데이터 부족 · 수동 입력 필요", tone: "caution" };
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
    return { gradeLabel: "평가 대상 없음", toneLabel: "평가할 데이터가 아직 없습니다", tone: "muted", showScore: false };
  }
  if (result.status === "data_insufficient" || result.grade === null) {
    return {
      gradeLabel: "데이터 부족",
      toneLabel: "데이터가 부족해 아직 평가하지 않았습니다",
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
    case "config_changed":
      return {
        label: "포트폴리오 설정이 변경되었습니다. 다시 적용하면 시뮬레이션에 반영됩니다.",
        tone: "caution",
      };
    case "stale":
      return {
        label: "적용된 가정이 오래되었습니다. 필요하면 다시 계산해 주세요.",
        tone: "caution",
      };
    case "clean":
    case "none":
    default:
      return null;
  }
}

export const AUTO_NOT_APPLIED_HINT = "자동 계산값은 적용 버튼을 누르기 전까지 시뮬레이션에 반영되지 않습니다.";

// Small shared key so the page/section can index transient resolver results.
export function resolutionKey(accountType: PortfolioAccountType, ticker: string): string {
  return `${accountType}:${ticker}`;
}

export function isEmptyPortfolioConfig(config: AssetSimulatorPortfolioConfigV1 | null | undefined): boolean {
  if (!config) return true;
  return config.taxSaving.holdings.length === 0 && config.brokerage.holdings.length === 0;
}
