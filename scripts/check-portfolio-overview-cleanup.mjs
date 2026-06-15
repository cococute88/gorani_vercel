#!/usr/bin/env node

// PORTFOLIO-OVERVIEW-CLEANUP-1 (+ FOLLOWUP) 회귀 테스트.
// /portfolio 상단 정리 결과를 정적으로 검증한다.
// - 제거 유지: 동작하지 않는 "계좌 추가" 버튼, 우측 "계좌 n개 · 종목 n개" 카운트,
//   summary "구성 요약"/"자산 행"/"경고 n개" 카운트, 장황한 info notice 박스,
//   "실시간 시세(참고용)" strip, "샘플" 배지.
// - 복구(FOLLOWUP): 상단 compact 시장지표 strip 을 /api/market live briefing 으로 재현.
//   단 mock/static PIN_TICKERS / lib/mockData 시장값은 재사용하지 않는다.
// - 유지: 총 금융자산/투자 평가금액/현금성·기타/투자원금/누적 손익 등 핵심 정보.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

const page = read("app/portfolio/page.tsx");
const summary = read("components/PortfolioSummary.tsx");
const strip = read("components/portfolio/PortfolioMarketIndicatorStrip.tsx");

const rows = [];

function assertAbsent(haystack, needle, where) {
  assert.ok(!haystack.includes(needle), `${where} 에 "${needle}" 가 남아 있으면 안 된다`);
}

function assertPresent(haystack, needle, where) {
  assert.ok(haystack.includes(needle), `${where} 에 "${needle}" 가 있어야 한다`);
}

// 1. 상단 compact 시장지표 strip 복구 (live 재사용)
assertPresent(page, "PortfolioMarketIndicatorStrip", "portfolio page");
assertPresent(strip, "시장 지표", "market strip");
assertPresent(strip, "fetchMarketPayload", "market strip");
rows.push({ case: "시장지표 compact strip 복구", ok: true });

// 2. mock/static 시장값 재사용 금지 + sample 표시 금지
for (const file of [
  ["portfolio page", page],
  ["market strip", strip],
]) {
  assertAbsent(file[1], "PIN_TICKERS", file[0]);
  assertAbsent(file[1], "MiniTickerCard", file[0]);
  assertAbsent(file[1], "mockData", file[0]);
  assertAbsent(file[1], "SampleBadge", file[0]);
  assertAbsent(file[1], "샘플", file[0]);
}
rows.push({ case: "mock/static 시장값·샘플 표시 금지", ok: true });

// 3. live/partial/unavailable 상태 문구 사용
assertPresent(strip, "시장 데이터 Live", "market strip");
assertPresent(strip, "시장 데이터 일부 조회 불가", "market strip");
assertPresent(strip, "시장 데이터 조회 불가", "market strip");
rows.push({ case: "live/partial/unavailable 상태 문구", ok: true });

// 4. 동작하지 않는 계좌 추가 버튼 / Plus 아이콘 제거 유지
assertAbsent(page, "계좌 추가", "portfolio page");
assertAbsent(page, "lucide-react", "portfolio page");
rows.push({ case: "계좌 추가 버튼 제거 유지", ok: true });

// 5. 우측 상단 계좌/종목 카운트 제거 유지
assertAbsent(page, "· 종목", "portfolio page");
assertAbsent(page, "accountCount", "portfolio page");
assertAbsent(page, "holdingCount", "portfolio page");
rows.push({ case: "계좌/종목 카운트 제거 유지", ok: true });

// 6. 실시간 시세(참고용) strip 제거 유지
assertAbsent(page, "PortfolioQuoteStatusPanel", "portfolio page");
assertAbsent(page, "실시간 시세", "portfolio page");
rows.push({ case: "실시간 시세 strip 제거 유지", ok: true });

// 7. 남은 경고는 접힌 <details> 형태 (장황한 항상-열린 박스가 아님)
if (page.includes("확인이 필요한 항목")) {
  assertPresent(page, "<details", "portfolio page");
  assertPresent(page, "<summary", "portfolio page");
}
rows.push({ case: "경고는 접힌 details 형태", ok: true });

// 8. summary 내부 구성 요약 / 자산 행 / 경고 카운트 제거 유지
assertAbsent(summary, "구성 요약", "PortfolioSummary");
assertAbsent(summary, "자산 행", "PortfolioSummary");
assertAbsent(summary, "financeAssetCount", "PortfolioSummary");
assertAbsent(summary, "{warnings.length}개", "PortfolioSummary");
rows.push({ case: "구성 요약/자산 행/경고 카운트 제거 유지", ok: true });

// 9. 핵심 정보는 유지
for (const label of ["총 금융자산", "투자 평가금액", "현금성/기타 자산", "투자원금", "누적 손익"]) {
  assertPresent(summary, label, "PortfolioSummary");
}
assertPresent(summary, "투자 / 현금 비중", "PortfolioSummary");
assertPresent(page, "포트폴리오 현황", "portfolio page");
rows.push({ case: "핵심 정보 유지", ok: true });

console.log("Portfolio overview cleanup checks passed.");
console.table(rows);
