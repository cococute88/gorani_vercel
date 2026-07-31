import type { PortfolioCompareRequest } from "@/lib/portfolio-compare/types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function portfolioRequestHash(request: PortfolioCompareRequest): string {
  return JSON.stringify(canonicalize(request));
}

export function shouldApplyAnalysisResult(input: {
  startedSequence: number;
  currentSequence: number;
  startedHash: string;
  currentHash: string;
}): boolean {
  return input.startedSequence === input.currentSequence && input.startedHash === input.currentHash;
}

export type AnalysisUiState = "idle" | "loading" | "success" | "error" | "stale";

export function resolveAnalysisUiState(input: {
  loading: boolean;
  hasResult: boolean;
  hasError: boolean;
  stale: boolean;
}): AnalysisUiState {
  if (input.loading) return "loading";
  if (input.hasError) return "error";
  if (input.hasResult) return "success";
  if (input.stale) return "stale";
  return "idle";
}
