export const CALCULATOR_TAB_PARAM_MAP = {
  "dividend-capture": "capture",
  capture: "capture",
  conversion: "conversion",
  mdd: "mdd",
  compare: "compare",
  "portfolio-compare": "portfolio-compare",
} as const;

export type CalculatorTabKey = (typeof CALCULATOR_TAB_PARAM_MAP)[keyof typeof CALCULATOR_TAB_PARAM_MAP];

export function resolveCalculatorTab(tabParam: string | null | undefined): CalculatorTabKey {
  if (!tabParam) return "mdd";
  return CALCULATOR_TAB_PARAM_MAP[tabParam as keyof typeof CALCULATOR_TAB_PARAM_MAP] ?? "mdd";
}
