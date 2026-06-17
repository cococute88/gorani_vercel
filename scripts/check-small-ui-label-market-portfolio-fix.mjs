#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(rootDir, rel), "utf8");

const nav = read("lib/mockData.ts");
const strip = read("components/portfolio/PortfolioMarketIndicatorStrip.tsx");
const portfolio = read("app/portfolio/page.tsx");
const accounts = read("components/AssetAccountCards.tsx");
const fetchers = read("lib/server/market-fetchers.ts");
const chart = read("lib/chart-style.ts");
const marketData = read("lib/market-data.ts");

for (const label of ["투자현황", "자산시뮬", "캘린더", "투자성과"]) {
  assert.ok(nav.includes(`label: "${label}"`), `nav label missing: ${label}`);
}
for (const old of ["전체 종목", "전체종목", "자산 시뮬레이터", "배당캘린더", "투자 성과"]) {
  assert.ok(!nav.includes(`label: "${old}"`), `old nav display label remains: ${old}`);
}

const expectedOrder = 'const SHOWN_KEYS = ["sp500", "nasdaq", "dow", "schd", "usdkrw", "vix", "wti", "gld"] as const;';
assert.ok(strip.includes(expectedOrder), "portfolio market strip order must include Dow Jones/SCHD/GLD in requested order");
for (const pair of [
  ['key: "dow"', 'label: "Dow Jones"'],
  ['key: "schd"', 'label: "SCHD"'],
  ['key: "gld"', 'label: "GLD"'],
]) {
  assert.ok(fetchers.includes(pair[0]) && fetchers.includes(pair[1]), `market briefing source missing ${pair.join(" / ")}`);
}
assert.ok(fetchers.includes('ticker: "SCHD"'), "SCHD must use quote/history fetcher ticker");
assert.ok(fetchers.includes('ticker: "GLD"'), "GLD must use quote/history fetcher ticker");

for (const label of ["목적별 비중", "보유 비중 분석", "종목별 비중"]) {
  assert.ok(portfolio.includes(label), `portfolio label missing: ${label}`);
}
for (const old of ["title=\"자산 구성\"", "보유 자산군 분석", "title=\"자산군 비중\""]) {
  assert.ok(!portfolio.includes(old), `old portfolio label remains: ${old}`);
}

assert.ok(accounts.includes("lg:grid-cols-3"), "account cards must support desktop 3-column grid");
assert.ok(accounts.includes("min-[1300px]:grid-cols-3"), "compact account cards must preserve 3 columns in portfolio desktop layout");

assert.ok(chart.includes("formatFearGreedTooltipLabel(value: unknown, payload?"), "Fear & Greed tooltip formatter must read payload score");
assert.ok(chart.includes("YYYY.MM.DD") || chart.includes("formatDateParts(value, \".\", true"), "Fear & Greed tooltip must format date as YYYY.MM.DD");
assert.ok(chart.includes("fearGreedTooltipRating(score)"), "Fear & Greed tooltip must append score sentiment label");
assert.ok(marketData.includes("fearGreedTooltipRating"), "Fear & Greed sentiment helper must exist");
for (const sample of ['score <= 24', 'score <= 44', 'score <= 55', 'score <= 75', 'return "극단탐욕"']) {
  assert.ok(marketData.includes(sample), `Fear & Greed helper boundary missing: ${sample}`);
}

console.log("SMALL-UI-LABEL-MARKET-PORTFOLIO-FIX-1 checks passed.");
