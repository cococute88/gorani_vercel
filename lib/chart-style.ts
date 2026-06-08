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
