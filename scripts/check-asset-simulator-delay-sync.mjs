import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const mock = read("lib/mock-asset-simulator-data.ts");
const panel = read("components/asset-simulator/SimulatorInputPanel.tsx");
const table = read("components/asset-simulator/YearPlanTable.tsx");
const cards = read("components/asset-simulator/SimulatorMetricCards.tsx");
const tabs = read("components/asset-simulator/SimulatorResultTabs.tsx");

// 1) 기본 적립 기간/월적립액은 단일 상수로 정의되어, 계획 생성 로직과 안내 문구가
//    동일 출처를 공유해야 한다. (요구사항 9: 향후 변경 시에도 불일치 금지)
assert.match(mock, /export const DEFAULT_CONTRIBUTION_YEARS = 5;/, "DEFAULT_CONTRIBUTION_YEARS=5 상수가 정의되어야 합니다.");
assert.match(mock, /export const DEFAULT_MONTHLY_CONTRIBUTION = 300;/, "DEFAULT_MONTHLY_CONTRIBUTION=300 상수가 정의되어야 합니다.");
assert.match(
  mock,
  /const isContributionYear = index < DEFAULT_CONTRIBUTION_YEARS;/,
  "기본 계획 생성은 DEFAULT_CONTRIBUTION_YEARS 상수를 사용해야 합니다(하드코딩 8 금지).",
);
assert.doesNotMatch(mock, /index < 8/, "기본 계획에 하드코딩된 8년(index < 8)이 남아 있으면 안 됩니다.");

// 2) 안내 문구는 상수에서 도출되어 실제 로직과 항상 일치해야 한다.
assert.match(
  table,
  /import \{ DEFAULT_CONTRIBUTION_YEARS, DEFAULT_MONTHLY_CONTRIBUTION \} from "@\/lib\/mock-asset-simulator-data";/,
  "YearPlanTable 은 기본 적립 상수를 import 해야 합니다.",
);
assert.match(
  table,
  /초기 \{DEFAULT_CONTRIBUTION_YEARS\}년 월 \{DEFAULT_MONTHLY_CONTRIBUTION\}만원 적립/,
  "안내 문구는 상수 기반으로 '초기 5년 월 300만원 적립' 을 표시해야 합니다.",
);
assert.doesNotMatch(table, /초기 8년/, "안내 문구에 '초기 8년' 하드코딩이 남아 있으면 안 됩니다.");

// 3) 입력 패널은 저장값 로딩(하이드레이션) 후 inputs 변화에 draft 표시값을 재동기화해야 한다.
//    (편집 중 항목만 보존) -> 설정 패널이 저장값을 정확히 반영.
assert.match(panel, /const \[focusedKey, setFocusedKey\] = useState<keyof SimulatorInputs \| null>\(null\);/, "focusedKey 상태가 있어야 합니다.");
assert.match(
  panel,
  /for \(const item of INPUTS\) \{\s*\n\s*if \(item\.key === focusedKey\) continue;\s*\n\s*next\[item\.key\] = displayInputValue\(item\.key, inputs\[item\.key\]\);/,
  "inputs 변경 시 편집 중이 아닌 항목은 항상 최신 inputs 로 draft 를 재동기화해야 합니다.",
);
assert.match(panel, /\}, \[inputs, focusedKey\]\);/, "동기화 effect 는 inputs 와 focusedKey 에 의존해야 합니다.");
assert.match(panel, /onFocus=\{\(\) => setFocusedKey\(item\.key\)\}/, "입력 포커스 시 focusedKey 를 설정해야 합니다.");
assert.doesNotMatch(panel, /if \(!\(item\.key in next\)\)/, "missing-key 전용 초기화(저장값 미반영 버그)가 남아 있으면 안 됩니다.");

// 4) 은퇴년도 카드와 차트 세로선은 동일한 summary 출처를 사용해야 한다.
assert.match(cards, /summary\.retirementYear/, "은퇴년도 카드는 summary.retirementYear 를 사용해야 합니다.");
assert.match(cards, /summary\.actualWithdrawalStartYear/, "카드 보조 텍스트는 summary.actualWithdrawalStartYear 를 사용해야 합니다.");
assert.match(
  tabs,
  /retirementYear=\{projection\.summary\.retirementYear \?\? undefined\} withdrawalStartYear=\{projection\.summary\.actualWithdrawalStartYear \?\? undefined\}/,
  "차트는 카드와 동일한 projection.summary 연도 값을 사용해야 합니다.",
);

console.log("check-asset-simulator-delay-sync: OK");
