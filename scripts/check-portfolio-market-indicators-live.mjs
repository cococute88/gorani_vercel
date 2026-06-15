#!/usr/bin/env node

// PORTFOLIO-MARKET-INDICATORS-LIVE-VERIFY-1
// /portfolio 상단 시장지표가 sample/static/mock 값이 아니라 /api/market live briefing 을
// 재사용하고, 실패 시 fake 값 없이 unavailable 상태를 표시하는지 정적으로 검증한다.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), "utf8");

const page = read("app/portfolio/page.tsx");
const strip = read("components/portfolio/PortfolioMarketIndicatorStrip.tsx");
const marketData = read("lib/market-data.ts");
const apiRoute = read("app/api/market/route.ts");
const overviewCheck = read("scripts/check-portfolio-overview-cleanup.mjs");

const rows = [];
function present(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label} must include ${needle}`);
}
function absent(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label} must not include ${needle}`);
}

// 1. /portfolio 에 시장지표 strip 이 있으면 전용 컴포넌트를 통해 렌더링한다.
present(page, "PortfolioMarketIndicatorStrip", "portfolio page");
present(strip, "시장 지표", "portfolio market indicator strip");
rows.push({ case: "/portfolio market indicator render path", ok: true });

// 2. strip 은 mock/static 시장값을 직접 import/참조하지 않는다.
for (const [label, source] of [["portfolio page", page], ["portfolio market indicator strip", strip]]) {
  absent(source, "mock-market-data", label);
  absent(source, "lib/mockData", label);
  absent(source, "PIN_TICKERS", label);
  absent(source, "MiniTickerCard", label);
  absent(source, "SampleBadge", label);
  absent(source, "샘플", label);
}
rows.push({ case: "no sample/mock/static portfolio market UI", ok: true });

// 3. /market 이 사용하는 live client/API 를 재사용한다.
present(strip, "fetchMarketPayload", "portfolio market indicator strip");
present(marketData, "fetch(`/api/market?range=", "market data client");
present(apiRoute, "buildMarketPayload", "market API route");
present(apiRoute, "dynamic = \"force-dynamic\"", "market API route");
rows.push({ case: "/api/market live client reuse", ok: true });

// 4. live/partial/unavailable 및 개별 실패 표시가 가능하다.
for (const text of ["시장 데이터 Live", "시장 데이터 일부 조회 불가", "시장 데이터 조회 불가", "조회 불가"]) {
  present(strip, text, "portfolio market indicator strip");
}
present(strip, "payload.source === \"partial\"", "portfolio market indicator strip");
present(strip, "payload.source === \"unavailable\"", "portfolio market indicator strip");
present(strip, "item.changePct === null", "portfolio market indicator strip");
rows.push({ case: "live/partial/unavailable/failure states", ok: true });

// 5. fake 값이나 fake sparkline 을 생성하지 않고, briefing 의 sparkline 만 사용한다.
absent(strip, "Math.random", "portfolio market indicator strip");
absent(strip, "Math.sin", "portfolio market indicator strip");
absent(strip, "fallback", "portfolio market indicator strip");
present(strip, "item.sparkline", "portfolio market indicator strip");
present(strip, "SHOWN_KEYS", "portfolio market indicator strip");
rows.push({ case: "no fake fallback values or curves", ok: true });

// 6. 기존 overview cleanup 회귀 테스트도 동일 정책을 감시한다.
present(overviewCheck, "fetchMarketPayload", "portfolio overview cleanup check");
present(overviewCheck, "샘플", "portfolio overview cleanup check");
rows.push({ case: "overview cleanup guard remains", ok: true });

console.log("Portfolio market indicator live checks passed.");
console.table(rows);
