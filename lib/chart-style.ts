// recharts 공통 스타일 (다크 테마). 차트 컴포넌트에서 재사용.
// JSX 인라인 객체 대신 이 상수를 단일 중괄호로 참조한다.

export const CHART_GRID = "#2a3336";
export const AXIS_TICK = { fill: "#94a3b8", fontSize: 12 };
export const AXIS_TICK_SM = { fill: "#94a3b8", fontSize: 11 };
export const AXIS_LINE = { stroke: "#2a3336" };
export const TOOLTIP_STYLE = {
  background: "#1e2324",
  border: "1px solid #2a3336",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 12,
};
export const TOOLTIP_LABEL_STYLE = { color: "#94a3b8" };
export const TOOLTIP_CURSOR_FILL = { fill: "rgba(255,255,255,0.04)" };
export const TOOLTIP_CURSOR_LINE = { stroke: "#3b82f6", strokeWidth: 1 };
export const CHART_MARGIN = { top: 8, right: 12, left: 4, bottom: 0 };
export const LEGEND_STYLE = { fontSize: 12, color: "#94a3b8" };

// 상승=빨강 / 하락=파랑 (기존 프로젝트 톤)
export const UP_COLOR = "#e5484d";
export const DOWN_COLOR = "#3b82f6";
export const SERIES_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

// 차트 x축 입력을 안전하게 Date 로 변환한다.
// - YYYY-MM / YYYY-MM-DD 문자열은 로컬 시간 기준으로 직접 파싱(타임존 시프트 방지)
// - timestamp(number), Date 객체도 처리
// - 변환 불가하면 null
function toChartDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    // YYYY-MM 또는 YYYY-MM-DD(시간 접미사 포함) 만 신뢰한다.
    // 그 외 임의 문자열은 Date 파서가 엉뚱하게 해석할 수 있어 null 처리한다.
    const m = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? "1"));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  return null;
}

// 차트 x축 월 단위 틱 포맷: 다양한 날짜 입력을 "YY/MM" 으로 변환한다 (예: 2026-03 → 26/03).
// invalid date 는 원본 문자열을 그대로 반환하거나 빈 문자열로 안전 처리한다.
export function formatChartMonthTick(value: unknown): string {
  const date = toChartDate(value);
  if (!date) return typeof value === "string" ? value : "";
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yy}/${mm}`;
}


function formatDateParts(value: unknown, separator: string, includeDay: boolean, invalidStringFallback: string): string {
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (m) {
      const yyOrYear = includeDay ? m[1] : m[1].slice(-2);
      const day = m[3] ?? "01";
      return includeDay ? `${yyOrYear}${separator}${m[2]}${separator}${day}` : `${yyOrYear}${separator}${m[2]}`;
    }
    return invalidStringFallback;
  }

  const date = toChartDate(value);
  if (!date) return "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return includeDay ? `${year}${separator}${month}${separator}${day}` : `${year.slice(-2)}${separator}${month}`;
}

// 공포탐욕 차트 x축 월 tick: YYYY-MM-DD 문자열을 타임존 시프트 없이 "YY.MM" 으로 표시한다.
export function formatFearGreedAxisTick(value: unknown): string {
  return formatDateParts(value, ".", false, "");
}

// 공포탐욕 차트 tooltip label: 사용자에게 날짜만 "YYYY.MM.DD" 로 보여주고 index/raw key 노출을 막는다.
export function formatFearGreedTooltipLabel(value: unknown): string {
  return formatDateParts(value, ".", true, "날짜 없음");
}
