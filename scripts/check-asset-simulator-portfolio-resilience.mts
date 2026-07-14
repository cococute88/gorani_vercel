import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildFailedResolution,
  describePortfolioMetricsError,
  parsePortfolioAccountTypeParam,
  portfolioMetricsErrorBody,
  resolvePortfolioHoldingMetricsClient,
  type PortfolioMetricsServerErrorCode,
} from "../lib/asset-simulator-portfolio-client.ts";
import {
  isAutoResultStale,
  resolutionHasInsufficientHistory,
  resolutionNeedsManualFallback,
} from "../lib/asset-simulator-portfolio-ui.ts";
import { buildAppliedPortfolioAssumptions } from "../lib/asset-simulator-portfolio-assumptions.ts";
import type {
  AssetSimulatorPortfolioConfigV1,
  PortfolioHoldingResolution,
  ResolvedPortfolioMetric,
} from "../lib/asset-simulator-types.ts";

const metric = (overrides: Partial<ResolvedPortfolioMetric>): ResolvedPortfolioMetric => ({
  valuePct: null,
  source: "yahoo-close",
  status: "failed",
  asOf: null,
  periodStart: null,
  periodEnd: null,
  observationYears: null,
  warnings: [],
  ...overrides,
});

// resolution 조립 헬퍼: 계좌별 필요한 지표만 채우고 나머지는 not_applicable 로 둔다.
function taxSavingResolution(ticker: string, total: ResolvedPortfolioMetric): PortfolioHoldingResolution {
  return {
    ticker,
    totalReturnCagr: total,
    priceCagr: metric({ status: "not_applicable", source: "yahoo-close" }),
    dividendYield: metric({ status: "not_applicable", source: "yahoo-dividends" }),
    dividendGrowth: metric({ status: "not_applicable", source: "yahoo-dividends" }),
  };
}
function brokerageResolution(
  ticker: string,
  price: ResolvedPortfolioMetric,
  divYield: ResolvedPortfolioMetric,
  divGrowth: ResolvedPortfolioMetric,
): PortfolioHoldingResolution {
  return {
    ticker,
    totalReturnCagr: metric({ status: "not_applicable", source: "yahoo-adj-close" }),
    priceCagr: price,
    dividendYield: divYield,
    dividendGrowth: divGrowth,
  };
}

// ----- 1) 서버 에러 envelope --------------------------------------------------
const codes: PortfolioMetricsServerErrorCode[] = [
  "missing_ticker",
  "invalid_account_type",
  "provider_failed",
  "unexpected_error",
];
for (const code of codes) {
  const body = portfolioMetricsErrorBody(code);
  assert.equal(body.ok, false, `${code} envelope ok=false`);
  assert.equal(body.errorCode, code, `${code} errorCode 유지`);
  assert.ok(body.message.length > 0, `${code} 기본 메시지 존재`);
}
assert.equal(
  portfolioMetricsErrorBody("missing_ticker", "override").message,
  "override",
  "message override 반영",
);

// ----- 2) accountType 파싱 ---------------------------------------------------
assert.equal(parsePortfolioAccountTypeParam("taxSaving"), "taxSaving", "taxSaving 유효");
assert.equal(parsePortfolioAccountTypeParam("brokerage"), "brokerage", "brokerage 유효");
assert.equal(parsePortfolioAccountTypeParam("invalid"), null, "잘못된 값은 null");
assert.equal(parsePortfolioAccountTypeParam(null), null, "누락 값은 null");

// ----- 3) 클라이언트 에러 문구 (수동 fallback 안내 포함) ----------------------
for (const code of ["provider_failed", "unexpected_error", "network_error", "bad_response"] as const) {
  const message = describePortfolioMetricsError(code);
  assert.ok(message.length > 0, `${code} 문구 존재`);
  assert.ok(/수동 입력|다시 시도/.test(message), `${code} 문구가 재시도/수동 보완을 안내`);
}

// ----- 4) 실패 fallback resolution ------------------------------------------
const fallback = buildFailedResolution(" $schd ", "네트워크 오류");
assert.equal(fallback.ticker, "SCHD", "fallback 티커 정규화");
for (const key of ["totalReturnCagr", "priceCagr", "dividendYield", "dividendGrowth"] as const) {
  assert.equal(fallback[key].status, "failed", `fallback ${key} status=failed`);
  assert.equal(fallback[key].valuePct, null, `fallback ${key} valuePct=null`);
  assert.ok(fallback[key].warnings.includes("네트워크 오류"), `fallback ${key} 메시지 전달`);
}
assert.ok(resolutionNeedsManualFallback(fallback, "taxSaving"), "fallback 은 수동 보완 필요");
assert.ok(resolutionNeedsManualFallback(fallback, "brokerage"), "fallback 은 수동 보완 필요(위탁)");

// ----- 5) resolvePortfolioHoldingMetricsClient (fetch stub) -----------------
const realFetch = globalThis.fetch;
type FetchStub = () => Promise<Response>;
function withFetch(stub: FetchStub) {
  globalThis.fetch = stub as unknown as typeof globalThis.fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}

try {
  // 5a) 성공 응답
  const resolvedResolution = taxSavingResolution("SCHD", metric({ status: "resolved", valuePct: 9, source: "yahoo-adj-close" }));
  withFetch(async () =>
    new Response(
      JSON.stringify({ ok: true, ticker: "SCHD", accountType: "taxSaving", seriesSource: "yahoo", resolution: resolvedResolution }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  const success = await resolvePortfolioHoldingMetricsClient("SCHD", "taxSaving");
  assert.equal(success.ok, true, "성공 응답 ok=true");
  assert.equal(success.errorCode, null, "성공 응답 errorCode 없음");
  assert.equal(success.resolution.totalReturnCagr.status, "resolved", "성공 resolution 전달");
  assert.equal(success.seriesSource, "yahoo", "seriesSource 전달");

  // 5b) 구조화된 에러 바디를 가진 non-2xx
  withFetch(async () =>
    new Response(JSON.stringify(portfolioMetricsErrorBody("invalid_account_type")), { status: 400 }),
  );
  const badAccount = await resolvePortfolioHoldingMetricsClient("SCHD", "taxSaving");
  assert.equal(badAccount.ok, false, "400 응답 ok=false");
  assert.equal(badAccount.errorCode, "invalid_account_type", "바디 errorCode 우선 사용");
  assert.equal(badAccount.resolution.priceCagr.status, "failed", "실패 시 fallback resolution 제공");

  // 5c) 코드 없는 5xx → status 기반 매핑
  withFetch(async () => new Response(JSON.stringify({ oops: true }), { status: 502 }));
  const gateway = await resolvePortfolioHoldingMetricsClient("SCHD", "brokerage");
  assert.equal(gateway.ok, false, "502 응답 ok=false");
  assert.equal(gateway.errorCode, "provider_failed", "코드 없는 5xx → provider_failed");

  // 5d) 네트워크 실패 (fetch throw)
  withFetch(async () => {
    throw new TypeError("Failed to fetch");
  });
  const network = await resolvePortfolioHoldingMetricsClient("SCHD", "taxSaving");
  assert.equal(network.ok, false, "네트워크 실패 ok=false");
  assert.equal(network.errorCode, "network_error", "fetch throw → network_error");

  // 5e) JSON 파싱 실패 (200이지만 본문이 JSON 아님)
  withFetch(async () => new Response("<html>not json</html>", { status: 200 }));
  const badJson = await resolvePortfolioHoldingMetricsClient("SCHD", "taxSaving");
  assert.equal(badJson.ok, false, "JSON 파싱 실패 ok=false");
  assert.equal(badJson.errorCode, "bad_response", "200 비 JSON → bad_response");

  // 5f) 200 이지만 resolution 누락
  withFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const missingResolution = await resolvePortfolioHoldingMetricsClient("SCHD", "taxSaving");
  assert.equal(missingResolution.ok, false, "resolution 누락 ok=false");
  assert.equal(missingResolution.errorCode, "bad_response", "resolution 누락 → bad_response");

  // 5g) AbortError 는 다시 던진다 (호출자가 무시할 수 있게)
  withFetch(async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  });
  await assert.rejects(
    () => resolvePortfolioHoldingMetricsClient("SCHD", "taxSaving"),
    (error: unknown) => (error as { name?: string })?.name === "AbortError",
    "AbortError 재던짐",
  );
} finally {
  restoreFetch();
}

// ----- 6) 수동 보완 판정 헬퍼 -----------------------------------------------
const okTax = taxSavingResolution("SCHD", metric({ status: "resolved", valuePct: 9, source: "yahoo-adj-close" }));
assert.equal(resolutionNeedsManualFallback(okTax, "taxSaving"), false, "resolved 절세는 보완 불필요");

const okBrokerage = brokerageResolution(
  "SCHD",
  metric({ status: "resolved", valuePct: 5 }),
  metric({ status: "resolved", valuePct: 4, source: "yahoo-dividends" }),
  metric({ status: "not_applicable", valuePct: 0, source: "yahoo-dividends" }),
);
assert.equal(resolutionNeedsManualFallback(okBrokerage, "brokerage"), false, "무배당 growth(0) 는 사용 가능");

const shortHistory = brokerageResolution(
  "JEPQ",
  metric({ status: "insufficient_history", source: "yahoo-close" }),
  metric({ status: "resolved", valuePct: 9, source: "yahoo-dividends" }),
  metric({ status: "resolved", valuePct: 1, source: "yahoo-dividends" }),
);
assert.ok(resolutionNeedsManualFallback(shortHistory, "brokerage"), "이력 부족은 보완 필요");
assert.ok(resolutionHasInsufficientHistory(shortHistory, "brokerage"), "이력 부족 감지");
assert.equal(resolutionHasInsufficientHistory(okBrokerage, "brokerage"), false, "정상은 이력 부족 아님");

// ----- 7) 자동 결과 stale 판정 ----------------------------------------------
const now = new Date("2026-07-12T00:00:00.000Z");
assert.equal(isAutoResultStale(undefined, now), false, "결과 없으면 stale 아님");
assert.equal(isAutoResultStale("2026-07-11T18:00:00.000Z", now), false, "24시간 이내는 최신");
assert.equal(isAutoResultStale("2026-07-10T00:00:00.000Z", now), true, "24시간 초과는 stale");
assert.equal(isAutoResultStale("nonsense", now), false, "파싱 불가 값은 stale 아님");

// ----- 8) 부분 실패 유지 & 수동 fallback 으로 이슈 해소 ----------------------
// 위탁계좌: SCHD(정상 auto) + JEPQ(auto, 조회 실패) → JEPQ 이슈로 적용 차단, SCHD 결과는 유지.
const partialConfig: AssetSimulatorPortfolioConfigV1 = {
  version: 1,
  taxSaving: { accountType: "taxSaving", holdings: [{ id: "t1", ticker: "SCHD", weightPct: 100, metricMode: "manual", manual: { totalReturnCagrPct: 10 } }] },
  brokerage: {
    accountType: "brokerage",
    holdings: [
      { id: "b1", ticker: "SCHD", weightPct: 50, metricMode: "auto" },
      { id: "b2", ticker: "JEPQ", weightPct: 50, metricMode: "auto" },
    ],
  },
};
const schdBrokerageOk = brokerageResolution(
  "SCHD",
  metric({ status: "resolved", valuePct: 5 }),
  metric({ status: "resolved", valuePct: 4, source: "yahoo-dividends" }),
  metric({ status: "resolved", valuePct: 2, source: "yahoo-dividends" }),
);
const jepqFailed = buildFailedResolution("JEPQ", "조회 실패");

const partial = buildAppliedPortfolioAssumptions(partialConfig, [schdBrokerageOk, jepqFailed]);
assert.equal(partial.assumptions, null, "실패 티커가 있으면 적용 차단");
assert.ok(
  partial.issues.some((issue) => issue.accountType === "brokerage" && issue.holdingId === "b2"),
  "실패 티커(JEPQ)만 이슈로 연결",
);
assert.ok(
  !partial.issues.some((issue) => issue.holdingId === "b1"),
  "성공 티커(SCHD)는 이슈 없음(결과 유지)",
);

// JEPQ 를 수동 입력으로 전환하면 이슈가 해소되고 적용 가능해진다.
const fallbackConfig: AssetSimulatorPortfolioConfigV1 = {
  ...partialConfig,
  brokerage: {
    accountType: "brokerage",
    holdings: [
      { id: "b1", ticker: "SCHD", weightPct: 50, metricMode: "auto" },
      { id: "b2", ticker: "JEPQ", weightPct: 50, metricMode: "manual", manual: { priceCagrPct: 2, dividendYieldPct: 9, dividendGrowthPct: 1 } },
    ],
  },
};
const resolved = buildAppliedPortfolioAssumptions(fallbackConfig, [schdBrokerageOk]);
assert.deepEqual(resolved.issues, [], "수동 fallback 으로 이슈 해소");
assert.ok(resolved.assumptions, "수동 fallback 적용 가능");

// ----- 9) 컴포넌트 UI 배선 확인 ----------------------------------------------
const section = readFileSync("components/asset-simulator/PortfolioConfigSection.tsx", "utf8");
assert.match(section, /resolvePortfolioHoldingMetricsClient/, "resilient client fetch 사용");
assert.match(section, /AbortController/, "AbortController 로 최신 요청만 반영");
assert.match(section, /disabled=\{!canApply\}/, "미해결 이슈 시 적용 버튼 차단");
assert.match(section, /가정 수정/, "필요할 때만 가정 수정으로 수동 입력 노출");
assert.match(section, /자동값으로 되돌리기/, "수동 보정 후 자동값 복원 제공");
assert.doesNotMatch(section, /전체 자동 계산/, "전체 자동 계산 버튼 제거");
assert.match(section, /aria-busy/, "로딩 상태 aria-busy 표시");

console.log("asset simulator portfolio resilience checks passed");
