import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 55세 이전(~2050) 절세계좌 인출을 "평가금액 역산"이 아닌 "누적 납입원금 소진"으로
// 계산하도록 리팩터링된 구조를 정적으로 보증한다.
// (수치 검증은 scripts/check-asset-simulator-principal-withdraw-numeric.mts 에서 tsx 로 수행)
const calc = readFileSync("lib/asset-simulator.ts", "utf8");

// 1) 평가금액 역산(_find_optimal) 방식은 완전히 제거되어야 한다(주석 설명 제외).
assert.doesNotMatch(
  calc,
  /export function _find_optimal\b/,
  "_find_optimal 정의가 남아 있으면 안 됩니다(평가금액 역산 제거).",
);
assert.doesNotMatch(
  calc,
  /=\s*_find_optimal\(/,
  "_find_optimal 호출이 남아 있으면 안 됩니다.",
);

// 2) 첫해 인출액은 누적 납입원금 기반 등비 소진 공식으로 계산해야 한다.
assert.match(
  calc,
  /function _calc_principal_first_withdraw\(principal: number, years: number, effRate: number\)/,
  "_calc_principal_first_withdraw(원금 기반 첫해 인출액) 헬퍼가 있어야 합니다.",
);
assert.match(
  calc,
  /const isaFirst = _calc_principal_first_withdraw\(isaPrincipalPool, yearsUntil2050, effRate\);/,
  "ISA 첫 인출액은 원금풀(isaPrincipalPool) 기반이어야 합니다.",
);
assert.match(
  calc,
  /const pensionFirst = _calc_principal_first_withdraw\(pensionPrincipalPool, yearsUntil2050, effRate\);/,
  "연금 첫 인출액은 원금풀(pensionPrincipalPool) 기반이어야 합니다.",
);

// 3) 원금풀은 평가금액(isaNominal/pensionNominal)이 아니라 납입원금(isaBalance/pensionBalance)에서 와야 한다.
assert.match(
  calc,
  /isaPrincipalRaw = results\[principalSourceIdx\]\?\.isaBalance/,
  "ISA 원금풀은 isaBalance(납입원금 누계)에서 산출해야 합니다.",
);
assert.match(
  calc,
  /pensionPrincipalRaw = results\[principalSourceIdx\]\?\.pensionBalance/,
  "연금 원금풀은 pensionBalance(납입원금 누계)에서 산출해야 합니다.",
);
assert.match(
  calc,
  /const isaPrincipalPool = Math\.min\(isaPrincipalRaw, ISA_LIMIT_UNTIL_2050\);/,
  "ISA 원금풀은 비과세 한도(1억) 내로 제한되어야 합니다.",
);

// 4) 명목 인출 증가율(effRate) = (1+인출증가율)(1+물가)-1 를 ISA·연금에 동일 적용(실질가치 일정/점증).
assert.match(
  calc,
  /const effRate = \(1 \+ withdrawalGrowthRate\) \* \(1 \+ inflationRate\) - 1;/,
  "effRate 공식이 (1+인출증가율)(1+물가)-1 여야 합니다.",
);
assert.doesNotMatch(
  calc,
  /const pensionEffRate = withdrawalGrowthRate;/,
  "연금 전용 effRate(물가 미반영)는 제거되어야 합니다.",
);

// 5) ~2050 구간은 원금 잔량(remainingPrincipal)에서 인출하고, 마지막 해에 전액 소진해야 한다.
assert.match(
  calc,
  /let remainingIsaPrincipal = isaPrincipalPool;/,
  "남은 ISA 원금 추적 변수가 있어야 합니다.",
);
assert.match(
  calc,
  /let remainingPensionPrincipal = pensionPrincipalPool;/,
  "남은 연금 원금 추적 변수가 있어야 합니다.",
);
assert.match(
  calc,
  /isaGross = isLastPre2050\s*\n?\s*\?\s*remainingIsaPrincipal/,
  "마지막 ~2050 해에는 잔여 ISA 원금을 전액 인출(정확히 0 소진)해야 합니다.",
);
assert.match(
  calc,
  /pensionGross = isLastPre2050\s*\n?\s*\?\s*remainingPensionPrincipal/,
  "마지막 ~2050 해에는 잔여 연금 원금을 전액 인출(정확히 0 소진)해야 합니다.",
);

// 6) 55세 이전 인출은 비과세(net = gross) 여야 한다.
assert.match(calc, /\/\/ 55세 이전은 납입원금 인출이므로 비과세\(net = gross\)\./, "55세 이전 비과세 주석/로직이 있어야 합니다.");

// 7) 55세 이후(2051~) 로직은 기존 평가금액(잔고×인출률) + 과세율을 그대로 유지해야 한다(변경 금지 영역).
assert.match(calc, /isa2051Base = isaBalance \* withdrawalRate;/, "2051~ ISA 기준은 평가잔고×인출률(기존) 유지여야 합니다.");
assert.match(calc, /pension2051Base = pensionBalance \* withdrawalRate;/, "2051~ 연금 기준은 평가잔고×인출률(기존) 유지여야 합니다.");
assert.match(calc, /isaNet = isaGross \* \(1 - isaTaxRate\);/, "2051~ ISA 과세(net=gross*(1-세율)) 유지여야 합니다.");
assert.match(calc, /pensionNet = pensionGross \* \(1 - pensionTaxRate\);/, "2051~ 연금 과세(net=gross*(1-세율)) 유지여야 합니다.");
assert.match(calc, /const ISA_TAX_RATE_AFTER_2051 = 0\.099;/, "ISA 과세율 상수 유지여야 합니다.");
assert.match(calc, /const PENSION_TAX_RATE_AFTER_2051 = 0\.055;/, "연금 과세율 상수 유지여야 합니다.");

console.log("check-asset-simulator-principal-withdraw: OK");
