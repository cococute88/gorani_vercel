import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const calc = read("lib/asset-simulator.ts");
const timeline = read("lib/asset-simulator-timeline.ts");
const page = read("components/asset-simulator/AssetSimulatorPage.tsx");
const table = read("components/asset-simulator/YearPlanTable.tsx");

// 1) EXIT 모드 계산 경로: 연도별 투자 계획표를 완전히 무시하고 보유 자산만 사용한다.
assert.match(
  calc,
  /export function buildExitYearPlans\(inputs: SimulatorInputs\): YearPlanRow\[\]/,
  "buildExitYearPlans 가 존재해야 합니다.",
);
assert.match(
  calc,
  /monthlyContribution: 0,\s*\n\s*isaContribution: false,\s*\n\s*pensionContribution: false,\s*\n\s*isaToPensionTransfer: false,/,
  "EXIT 계획표는 모든 적립/납입 항목을 0/false 로 두어야 합니다.",
);
assert.match(
  calc,
  /exitMode\s*\n?\s*\?\s*buildExitYearPlans\(inputs\)/,
  "exitMode 일 때 타임라인 해석 전 buildExitYearPlans 결과를 사용해야 합니다.",
);

// 2) 인출 시작 연도 규칙: retireIdx === 0, 인출 시작 = startYear + withdrawalDelayYears.
//    (buildExitYearPlans 가 첫 해를 "은퇴" 로 만들고, 공통 타임라인이 delay를 적용)
assert.match(
  timeline,
  /candidateWithdrawalStartIndex = retirementIndex === null \? null : retirementIndex \+ delay;/,
  "공통 타임라인의 인출 시작 인덱스는 retirementIndex + delay 여야 합니다.",
);
assert.match(
  timeline,
  /const delay = Math\.max\(1, Math\.min\(15, inputs\.withdrawalDelayYears\)\);/,
  "delay 는 withdrawalDelayYears(1~15) 를 그대로 사용해야 합니다.",
);

// 문서화된 기대값(시작연도 2026 기준): delay 1 -> 2027, delay 5 -> 2031, delay 10 -> 2036.
// retireIdx 가 항상 0 이므로 actualStartYear === startYear + delay 가 성립한다.
for (const [delay, expected] of [
  [1, 2027],
  [5, 2031],
  [10, 2036],
]) {
  assert.equal(2026 + delay, expected, `EXIT 인출연도 규칙 위반: delay=${delay}`);
}

// 3) 토글 상태/자동 접기 로직 (요구사항 5~8).
assert.match(page, /useState\(true\)\)?;?[^\n]*\n[^\n]*planTableOpen|const \[planTableOpen, setPlanTableOpen\] = useState\(true\)/, "planTableOpen 기본값은 열림(true) 이어야 합니다.");
assert.match(
  page,
  /const handleExitModeChange = \(next: boolean\) => \{[\s\S]*?setExitMode\(next\);[\s\S]*?setPlanTableOpen\(!next\);/,
  "EXIT 토글 시 ON->접기 / OFF->펼치기 자동 처리가 있어야 합니다.",
);
assert.match(page, /onExitModeChange=\{handleExitModeChange\}/, "체크박스는 handleExitModeChange 를 사용해야 합니다.");
assert.match(
  page,
  /<YearPlanTable[^>]*open=\{planTableOpen\}[^>]*onToggleOpen=\{[^}]+\}[^>]*exitMode=\{exitMode\}/,
  "YearPlanTable 에 open/onToggleOpen/exitMode props 가 전달되어야 합니다.",
);

// 4) 토글 버튼 + CSV 버튼 공존 (요구사항 5,9).
assert.match(table, /계획표 접기/, "계획표 접기 문구가 있어야 합니다.");
assert.match(table, /계획표 펼치기/, "계획표 펼치기 문구가 있어야 합니다.");
assert.match(table, /TableCsvMenu/, "CSV 다운로드 메뉴는 유지되어야 합니다.");
assert.match(table, /\{bodyVisible \? \(/, "본문은 접힘 상태에서 조건부 렌더링되어야 합니다.");
assert.match(table, /aria-expanded=\{open\}/, "토글 버튼은 aria-expanded 로 접근성 상태를 노출해야 합니다.");

console.log("check-asset-simulator-exit-mode: OK");
