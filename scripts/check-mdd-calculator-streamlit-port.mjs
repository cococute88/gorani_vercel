import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const files = {
  mdd: read("components/calculator/MddCalculator.tsx"),
  lib: read("lib/mdd-calculator.ts"),
  pkg: read("package.json"),
};

let failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed += 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// 1. 한글화 — 주요 문구
for (const phrase of [
  "현재가",
  "기간 내 최고가",
  "현재 고점대비 하락률",
  "최대 MDD",
  "MDD 고점일",
  "MDD 저점일 → 회복일",
  "최근 가격 및 Drawdown 상세",
  "고점 대비 하락률",
]) {
  assert(files.mdd.includes(phrase), `MDD 계산기 문구 한글화: "${phrase}"`);
}
assert(!/Recent price and drawdown/.test(files.mdd), "영어 'Recent price and drawdown' 제거됨");
assert(!/Current drawdown from high|Period high|Max drawdown<|Max MDD/.test(files.mdd), "영어 KPI 라벨 제거됨");

// 2~4. 그래프 존재
assert(files.mdd.includes("달러 기준 가격"), "가격 그래프 존재 (달러 기준 가격)");
assert(files.mdd.includes("고점 대비 하락률 (Drawdown / MDD)"), "Drawdown/MDD 그래프 존재");
assert(files.mdd.includes("달러 vs 원화 Drawdown 비교"), "달러 vs 원화 Drawdown 비교 그래프 존재");

// 5. x축 formatter YY.MM
assert(/function formatAxisDate/.test(files.mdd) && files.mdd.includes("slice(2, 4)") && files.mdd.includes("slice(5, 7)"), "x축 formatter가 YY.MM 구조");
assert(files.mdd.includes("tickFormatter={formatAxisDate}"), "차트 x축에 formatAxisDate 적용");

// 6. tooltip date formatter YYYY.MM.DD
assert(/function formatTooltipDate/.test(files.mdd) && files.mdd.includes("slice(0, 4)") && files.mdd.includes("slice(8, 10)"), "tooltip date formatter가 YYYY.MM.DD 구조");
assert(files.mdd.includes("formatTooltipDate("), "tooltip에 formatTooltipDate 적용");

// 7. 기간 버튼 1년/3년/5년 + 커스텀 (기간 선택 개선)
for (const label of ["1년", "3년", "5년"]) {
  assert(files.lib.includes(`"${label}"`), `기간 버튼 라벨 존재: ${label}`);
}
assert(files.mdd.includes("MDD_PERIODS"), "컴포넌트가 MDD_PERIODS 기간 버튼을 사용");
assert(files.mdd.includes("커스텀"), "커스텀 기간 버튼 존재");
assert(/type="date"/.test(files.mdd), "커스텀 기간 시작일/종료일 Date Picker 존재");

// 8. 10년 clamp 로직
assert(files.lib.includes("resolvePeriodWindow") && files.lib.includes("clampedToMax"), "10년 미만 데이터 최대 clamp 로직 존재");

// 9. Brush / range selector placement
assert(files.mdd.includes("<Brush"), "Brush(range selector) 구조 존재");
const yearlySection = files.mdd.slice(files.mdd.indexOf("{/* 연도별 수익률 */"), files.mdd.indexOf("{/* 종목 기본 정보 표"));
const drawdownCompareSection = files.mdd.slice(files.mdd.indexOf("{/* 그래프 3 — 달러 vs 원화 Drawdown 비교 */"), files.mdd.indexOf("{/* 역대 최대 낙폭/회복기간 */"));
assert(yearlySection.includes("<BarChart") && !yearlySection.includes("<Brush"), "연도별 수익률 그래프에 Brush 없음");
assert(drawdownCompareSection.includes("달러 vs 원화 Drawdown 비교") && drawdownCompareSection.includes("<Brush"), "달러 vs 원화 Drawdown 비교 그래프에 Brush 있음");
assert(drawdownCompareSection.includes("tickFormatter={formatAxisDate}"), "Drawdown 비교 Brush가 YY.MM formatter 사용");

// 10. 역대 최대 낙폭/회복기간 최소 5행 구조
assert(files.lib.includes("computeDrawdownEpisodes"), "역대 낙폭 episode 계산 함수 존재");
assert(/limit\s*\??:?\s*=?\s*8/.test(files.lib) || files.mdd.includes("limit: 8"), "낙폭 리스트 limit이 5행 이상 (8)");
assert(files.mdd.includes("역대 최대 낙폭과 회복기간"), "역대 최대 낙폭 표 렌더링");
assert(files.mdd.includes("미회복"), "미회복 구간 표시");

// 11. 연도별 수익률 그래프
assert(files.mdd.includes("연도별 수익률") && files.lib.includes("computeYearlyReturns"), "연도별 수익률 그래프 존재");

// 12. 비교 기준년도 표
assert(files.mdd.includes("비교기준년도") && files.lib.includes("computeComparisonTable"), "비교 기준년도 표 존재");
assert(files.mdd.includes("연평균수익률") && files.mdd.includes("총수익률"), "비교 기준년도 표 컬럼 존재");

// 13. 주요 변동성 지표 표
assert(files.mdd.includes("주요 변동성 지표") && files.lib.includes("computeVolatilityStats"), "주요 변동성 지표 표 존재");
for (const label of ["52주 최고가", "52주 최저가", "연 최고 수익률(Year Best)", "연 최저 수익률(Year Worst)"]) {
  assert(files.mdd.includes(label), `변동성 지표 항목: ${label}`);
}

// 14. 기존 최근 가격/drawdown 표가 최하단
const recentIdx = files.mdd.indexOf("최근 가격 및 Drawdown 상세");
const volIdx = files.mdd.indexOf("주요 변동성 지표");
const yearlyIdx = files.mdd.indexOf("연도별 수익률");
assert(recentIdx > volIdx && recentIdx > yearlyIdx, "최근 가격/Drawdown 표가 변동성/연도별 표보다 아래(최하단)에 위치");

// 15. fake/sample chart 금지
assert(files.mdd.includes('quote.usdSource !== "sample"') || files.mdd.includes("dataAvailable"), "샘플 소스일 때 차트 대신 unavailable 상태 표시 (fake chart 금지)");
assert(!files.mdd.includes("buildSamplePrices") && !files.mdd.includes("getTickerHistory"), "컴포넌트에서 샘플 데이터 생성 함수를 사용하지 않음");

// 16. 정렬/스크롤 회귀 유지
assert(files.mdd.includes("setPriceSort") && files.mdd.includes("sortArrow(priceSort"), "최근 가격 표 정렬 헤더 유지");
assert(files.mdd.includes("setSegmentSort") && files.mdd.includes("sortArrow(segmentSort"), "역대 낙폭 표 정렬 헤더 존재");
assert(files.mdd.includes("max-h-[520px]") && files.mdd.includes("overflow-auto") && files.mdd.includes("sticky top-0"), "표 내부 스크롤 + sticky 헤더 유지");

assert(files.pkg.includes("check:mdd-calculator-streamlit-port"), "package script 등록됨");

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll MDD Streamlit port checks passed.");
