import { normalizePortfolioTicker } from "./asset-simulator-portfolio";
import type {
  PortfolioAccountType,
  PortfolioHoldingResolution,
  PortfolioMetricSource,
  ResolvedPortfolioMetric,
} from "./asset-simulator-types";

// Client-side helper for the portfolio metric resolver. The browser never calls
// Yahoo directly — it goes through the server route which builds the long-range
// series and runs resolvePortfolioHoldingMetrics.
//
// This module is intentionally free of server-only / browser-only dependencies so
// the pure helpers (error envelope, account-type parsing, fallback resolution) can
// be reused by the API route and exercised directly in check scripts.

// ----- API contract ---------------------------------------------------------

// Errors the server route can return in its JSON envelope.
export type PortfolioMetricsServerErrorCode =
  | "missing_ticker"
  | "invalid_account_type"
  | "provider_failed"
  | "unexpected_error";

// Additional failure modes the client can surface without a well-formed envelope.
export type PortfolioMetricsClientErrorCode =
  | PortfolioMetricsServerErrorCode
  | "network_error"
  | "bad_response";

export type PortfolioMetricsErrorBody = {
  ok: false;
  errorCode: PortfolioMetricsServerErrorCode;
  message: string;
};

// Success shape. `ok` is optional so older/cached responses without the flag stay
// compatible; the client keys off `resolution` being present.
export type PortfolioMetricsResponse = {
  ok?: boolean;
  ticker: string;
  accountType: PortfolioAccountType;
  seriesSource: string;
  resolution: PortfolioHoldingResolution;
};

const SERVER_ERROR_MESSAGES: Record<PortfolioMetricsServerErrorCode, string> = {
  missing_ticker: "티커를 입력해야 합니다.",
  invalid_account_type: "계좌 유형은 taxSaving 또는 brokerage여야 합니다.",
  provider_failed: "시세 데이터를 불러오지 못했습니다.",
  unexpected_error: "자동 계산 중 예기치 못한 오류가 발생했습니다.",
};

// Softer, action-oriented copy shown in the UI. Every failure nudges toward the
// manual fallback so the user is never stuck.
const CLIENT_ERROR_MESSAGES: Record<PortfolioMetricsClientErrorCode, string> = {
  missing_ticker: "티커를 입력해야 합니다.",
  invalid_account_type: "계좌 유형이 올바르지 않습니다.",
  provider_failed: "시세 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하거나 수동 입력으로 보완해 주세요.",
  unexpected_error: "자동 계산 중 오류가 발생했습니다. 다시 시도하거나 수동 입력으로 보완해 주세요.",
  network_error: "네트워크 연결을 확인한 뒤 다시 시도하거나 수동 입력으로 보완해 주세요.",
  bad_response: "응답을 해석할 수 없습니다. 다시 시도하거나 수동 입력으로 보완해 주세요.",
};

// Build the JSON body for a failed route response. Shared by the API route so the
// wire format stays in one place.
export function portfolioMetricsErrorBody(
  errorCode: PortfolioMetricsServerErrorCode,
  message?: string,
): PortfolioMetricsErrorBody {
  return { ok: false, errorCode, message: message ?? SERVER_ERROR_MESSAGES[errorCode] };
}

// Validate the accountType query param. Shared by the route and reused in tests.
export function parsePortfolioAccountTypeParam(
  value: string | null | undefined,
): PortfolioAccountType | null {
  if (value === "taxSaving" || value === "brokerage") return value;
  return null;
}

// Human-friendly copy for any client-visible error code.
export function describePortfolioMetricsError(errorCode: PortfolioMetricsClientErrorCode): string {
  return CLIENT_ERROR_MESSAGES[errorCode] ?? CLIENT_ERROR_MESSAGES.unexpected_error;
}

// ----- fallback resolution --------------------------------------------------

function failedMetric(source: PortfolioMetricSource, message: string): ResolvedPortfolioMetric {
  return {
    valuePct: null,
    source,
    status: "failed",
    asOf: null,
    periodStart: null,
    periodEnd: null,
    observationYears: null,
    warnings: message ? [message] : [],
  };
}

// A safe placeholder resolution so a failed fetch never leaves the UI without a
// shape to render. All required metrics read as "failed", which keeps the apply
// gate closed until the user retries or switches to manual input.
export function buildFailedResolution(ticker: string, message: string): PortfolioHoldingResolution {
  const normalized = normalizePortfolioTicker(ticker);
  return {
    ticker: normalized,
    totalReturnCagr: failedMetric("yahoo-adj-close", message),
    priceCagr: failedMetric("yahoo-close", message),
    dividendYield: failedMetric("yahoo-dividends", message),
    dividendGrowth: failedMetric("yahoo-dividends", message),
  };
}

// ----- fetch ----------------------------------------------------------------

export function portfolioMetricsPath(ticker: string, accountType: PortfolioAccountType): string {
  const params = new URLSearchParams({ ticker, accountType });
  return `/api/asset-simulator/portfolio-metrics?${params.toString()}`;
}

export type PortfolioMetricsClientResult = {
  ok: boolean;
  // Always present: the real resolution on success, a failed fallback otherwise.
  resolution: PortfolioHoldingResolution;
  seriesSource: string | null;
  errorCode: PortfolioMetricsClientErrorCode | null;
  message: string | null;
};

function isAbortError(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { name?: string }).name === "AbortError";
}

function extractServerErrorCode(payload: unknown): PortfolioMetricsServerErrorCode | null {
  if (!payload || typeof payload !== "object") return null;
  const code = (payload as { errorCode?: unknown }).errorCode;
  if (
    code === "missing_ticker" ||
    code === "invalid_account_type" ||
    code === "provider_failed" ||
    code === "unexpected_error"
  ) {
    return code;
  }
  return null;
}

function extractResolution(payload: unknown): PortfolioHoldingResolution | null {
  if (!payload || typeof payload !== "object") return null;
  const resolution = (payload as { resolution?: unknown }).resolution;
  if (!resolution || typeof resolution !== "object") return null;
  const record = resolution as Record<string, unknown>;
  if (!record.totalReturnCagr || !record.priceCagr || !record.dividendYield || !record.dividendGrowth) {
    return null;
  }
  return resolution as PortfolioHoldingResolution;
}

function extractSeriesSource(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const source = (payload as { seriesSource?: unknown }).seriesSource;
  return typeof source === "string" ? source : null;
}

function statusToErrorCode(status: number): PortfolioMetricsClientErrorCode {
  if (status >= 500) return "provider_failed";
  return "bad_response";
}

function failureResult(
  errorCode: PortfolioMetricsClientErrorCode,
  ticker: string,
): PortfolioMetricsClientResult {
  const message = describePortfolioMetricsError(errorCode);
  return {
    ok: false,
    resolution: buildFailedResolution(ticker, message),
    seriesSource: null,
    errorCode,
    message,
  };
}

// Resolve a single holding's metrics through the server route. This never throws
// for network / HTTP / parse failures — it returns a structured result carrying a
// fallback resolution so callers can render without try/catch guards. The only
// rethrow is AbortError, so a superseded/unmounted request can be ignored.
export async function resolvePortfolioHoldingMetricsClient(
  ticker: string,
  accountType: PortfolioAccountType,
  signal?: AbortSignal,
): Promise<PortfolioMetricsClientResult> {
  const normalized = normalizePortfolioTicker(ticker);

  let response: Response;
  try {
    response = await fetch(portfolioMetricsPath(normalized, accountType), {
      signal,
      headers: { accept: "application/json" },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return failureResult("network_error", normalized);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body (gateway error page, empty body, truncated stream, ...).
    return failureResult(response.ok ? "bad_response" : statusToErrorCode(response.status), normalized);
  }

  if (!response.ok) {
    const errorCode = extractServerErrorCode(payload) ?? statusToErrorCode(response.status);
    return failureResult(errorCode, normalized);
  }

  const resolution = extractResolution(payload);
  if (!resolution) {
    return failureResult("bad_response", normalized);
  }

  return {
    ok: true,
    resolution,
    seriesSource: extractSeriesSource(payload),
    errorCode: null,
    message: null,
  };
}
