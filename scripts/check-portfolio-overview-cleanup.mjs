#!/usr/bin/env node

// PORTFOLIO-OVERVIEW-CLEANUP-1 회귀 테스트.
// /portfolio 상단을 정리하면서 제거하기로 한 UI 가 다시 들어오지 않도록 정적으로 검증한다.
// - 시장 지표 sample strip (SampleBadge / PIN_TICKERS / MiniTickerCard) 제거
// - 동작하지 않는 "계좌 추가" 버튼 제거
// - 우측 상단 "계좌 n개 · 종목 n개" 카운트 제거
// - summary 내부 "구성 요약" / "자산 행" / "경고 n개" 카운트 제거
// - 장황한 안내(info) 박스 제거 (남은 경고는 접힌 <details> 형태)
// - 핵심 정보(총 금융자산/투자 평가금액/현금성·기타/투자원금/누적 손익)는 유지

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

const rows = [];

function assertAbsent(haystack, needle, where) {
  assert.ok(!haystack.includes(needle), `${where} 에 "${needle}" 가 남아 있으면 안 된다`);
}

function assertPresent(haystack, needle, where) {
  assert.ok(haystack.includes(needle), `${where} 에 "${needle}" 가 있어야 한다`);
}

// 1. 시장 지표 sample strip 제거
assertAbsent(page, "시장 지표", "portfolio page");
assertAbsent(page, "SampleBadge", "portfolio page");
assertAbsent(page, "PIN_TICKERS", "portfolio page");
assertAbsent(page, "MiniTickerCard", "portfolio page");
assertAbsent(page, "샘플", "portfolio page");
rows.push({ case: "시장 지표 sample strip 제거", ok: true });

// 2. 동작하지 않는 계좌 추가 버튼 / Plus 아이콘 제거
assertAbsent(page, "계좌 추가", "portfolio page");
assertAbsent(page, "lucide-react", "portfolio page");
rows.push({ case: "계좌 추가 버튼 제거", ok: true });

// 3. 우측 상단 계좌/종목 카운트 제거
assertAbsent(page, "· 종목", "portfolio page");
assertAbsent(page, "accountCount", "portfolio page");
assertAbsent(page, "holdingCount", "portfolio page");
rows.push({ case: "계좌/종목 카운트 제거", ok: true });

// 4. 실시간 시세(참고용) strip 제거
assertAbsent(page, "PortfolioQuoteStatusPanel", "portfolio page");
assertAbsent(page, "실시간 시세", "portfolio page");
rows.push({ case: "실시간 시세 strip 제거", ok: true });

// 5. 남은 경고는 접힌 <details> 형태 (장황한 항상-열린 박스가 아님)
if (page.includes("확인이 필요한 항목")) {
  assertPresent(page, "<details", "portfolio page");
  assertPresent(page, "<summary", "portfolio page");
}
rows.push({ case: "경고는 접힌 details 형태", ok: true });

// 6. summary 내부 구성 요약 / 자산 행 / 경고 카운트 제거
assertAbsent(summary, "구성 요약", "PortfolioSummary");
assertAbsent(summary, "자산 행", "PortfolioSummary");
assertAbsent(summary, "financeAssetCount", "PortfolioSummary");
assertAbsent(summary, "{warnings.length}개", "PortfolioSummary");
rows.push({ case: "구성 요약/자산 행/경고 카운트 제거", ok: true });

// 7. 핵심 정보는 유지
for (const label of ["총 금융자산", "투자 평가금액", "현금성/기타 자산", "투자원금", "누적 손익"]) {
  assertPresent(summary, label, "PortfolioSummary");
}
assertPresent(summary, "투자 / 현금 비중", "PortfolioSummary");
assertPresent(page, "포트폴리오 현황", "portfolio page");
rows.push({ case: "핵심 정보 유지", ok: true });

console.log("Portfolio overview cleanup checks passed.");
console.table(rows);
