import assert from "node:assert/strict";
import {
  simulate_deposits,
  apply_returns,
  get_real_balances,
  find_retire_index,
  assign_statuses,
  buildExitYearPlans,
  normalizeInputs,
  simulate_tax_account_withdraw,
} from "../lib/asset-simulator.ts";
import type { SimulatorInputs } from "../lib/asset-simulator-types.ts";

function runWithdraw(partial: Partial<SimulatorInputs>) {
  const inputs = normalizeInputs(partial);
  const plans = assign_statuses(buildExitYearPlans(inputs)); // EXIT 모드: 적립 0, retireIdx=0
  const dep = simulate_deposits(inputs, plans);
  const nom = apply_returns(inputs, dep);
  const real = get_real_balances(inputs, nom);
  const retireIdx = find_retire_index(plans);
  const plan = simulate_tax_account_withdraw(inputs, real, retireIdx)!;
  return { inputs, plan, results: real };
}

function round(x: number, d = 4) {
  return Math.round(x * 10 ** d) / 10 ** d;
}

// ── 시나리오 공통: 납입원금 1억(연금), ISA 0, 큰 CAGR 로 평가금액이 매우 커지도록 설정 ──
// startYear 2041 → delay 0? delay 최소 1. actualStart = 2042. ~2050 = 2042..2050 = 9년.
// "55세까지 10년" 을 만들려면 actualStartYear=2041, 즉 retireYear=2040, delay=1.
// EXIT 모드는 retireIdx=0, retireYear=startYear. delay=1 → actualStart=startYear+1.
// actualStart=2041 → ~2050 = 2041..2050 = 10년.  => startYear=2040, delay=1.

console.log("=== 시나리오 1: 연금원금 1억, 10년, 물가3%, 인출증가율0%, CAGR 20% ===");
{
  const { plan } = runWithdraw({
    startYear: 2040,
    years: 20,
    initialPension: 10000, // 1억
    initialIsa: 0,
    reserveCash: 0,
    initialTaxableDividend: 0,
    annualReturnRate: 20, // 평가금액이 매우 커도 인출액에 영향 없어야 함
    inflationRate: 3,
    withdrawalRate: 4,
    withdrawalGrowthRate: 0,
    withdrawalDelayYears: 1,
  });

  const pre2050 = plan.rows.filter((r) => !r.isDelay && r.category === "~2050");
  assert.equal(pre2050.length, 10, `~2050 인출연수=10 이어야 함, 실제 ${pre2050.length}`);

  const totalPensionGross = pre2050.reduce((s, r) => s + r.pensionGross, 0);
  console.log("  연금 누적 인출(원금) =", round(totalPensionGross, 2), "(목표 10000)");
  assert.ok(Math.abs(totalPensionGross - 10000) < 0.01, `원금 정확히 소진 실패: ${totalPensionGross}`);

  // 55세 직전 잔여 인출가능 원금 0
  const last = pre2050[pre2050.length - 1];
  console.log("  마지막 해 잔여원금(pensionRemainingLimit) =", round(last.pensionRemainingLimit ?? -1, 4));
  assert.ok(Math.abs(last.pensionRemainingLimit ?? -1) < 1e-6, "55세 직전 잔여원금 0 실패");

  // 실질가치 일정 (인출증가율 0% → 매년 monthlyReal 동일)
  const reals = pre2050.map((r) => r.monthlyReal);
  const allEqual = reals.every((v) => Math.abs(v - reals[0]) < 1e-6);
  console.log("  monthlyReal[0..2] =", reals.slice(0, 3).map((v) => round(v)));
  assert.ok(allEqual, "실질 구매력이 일정하지 않음(인출증가율 0%): " + JSON.stringify(reals.map((v) => round(v))));

  // 명목은 매년 물가(3%)만큼 증가
  const noms = pre2050.map((r) => r.monthlyNominal);
  for (let k = 1; k < noms.length; k++) {
    const ratio = noms[k] / noms[k - 1];
    assert.ok(Math.abs(ratio - 1.03) < 1e-4, `명목 증가율이 물가(3%)와 다름: ${round(ratio)}`);
  }
  console.log("  명목 증가율 ≈ 1.03 확인 OK");
}

console.log("=== 시나리오 2: 동일 + 인출증가율 2% → 실질 매년 +2% ===");
{
  const { plan } = runWithdraw({
    startYear: 2040,
    years: 20,
    initialPension: 10000,
    initialIsa: 0,
    reserveCash: 0,
    initialTaxableDividend: 0,
    annualReturnRate: 20,
    inflationRate: 3,
    withdrawalRate: 4,
    withdrawalGrowthRate: 2,
    withdrawalDelayYears: 1,
  });
  const pre2050 = plan.rows.filter((r) => !r.isDelay && r.category === "~2050");
  const totalPensionGross = pre2050.reduce((s, r) => s + r.pensionGross, 0);
  console.log("  연금 누적 인출(원금) =", round(totalPensionGross, 2), "(목표 10000)");
  assert.ok(Math.abs(totalPensionGross - 10000) < 0.01, `원금 정확히 소진 실패: ${totalPensionGross}`);

  const reals = pre2050.map((r) => r.monthlyReal);
  for (let k = 1; k < reals.length; k++) {
    const ratio = reals[k] / reals[k - 1];
    assert.ok(Math.abs(ratio - 1.02) < 1e-4, `실질 증가율이 인출증가율(2%)와 다름: ${round(ratio)}`);
  }
  console.log("  실질 증가율 ≈ 1.02 확인 OK (후반 실질가치 증가)");
}

console.log("=== 시나리오 3: 평가금액 독립성 (CAGR 5% vs 30% → 인출액 동일) ===");
{
  const base = {
    startYear: 2040,
    years: 20,
    initialPension: 10000,
    initialIsa: 0,
    reserveCash: 0,
    initialTaxableDividend: 0,
    inflationRate: 3,
    withdrawalRate: 4,
    withdrawalGrowthRate: 1,
    withdrawalDelayYears: 1,
  };
  const a = runWithdraw({ ...base, annualReturnRate: 5 }).plan.rows.filter((r) => !r.isDelay && r.category === "~2050").map((r) => round(r.pensionGross, 6));
  const b = runWithdraw({ ...base, annualReturnRate: 30 }).plan.rows.filter((r) => !r.isDelay && r.category === "~2050").map((r) => round(r.pensionGross, 6));
  console.log("  CAGR 5%  인출[0..2] =", a.slice(0, 3));
  console.log("  CAGR 30% 인출[0..2] =", b.slice(0, 3));
  assert.deepEqual(a, b, "CAGR 변경 시 55세 이전 인출액이 달라짐(평가금액 의존) → 위반");
  console.log("  평가금액 무관 확인 OK");
}

console.log("=== 시나리오 4: 55세 이후(2051~) 과세 로직 유지 확인 ===");
{
  const { plan } = runWithdraw({
    startYear: 2040,
    years: 30,
    initialPension: 10000,
    initialIsa: 5000,
    reserveCash: 0,
    initialTaxableDividend: 0,
    annualReturnRate: 7,
    inflationRate: 3,
    withdrawalRate: 4,
    withdrawalGrowthRate: 1,
    withdrawalDelayYears: 1,
  });
  const after = plan.rows.filter((r) => r.category === "2051~");
  assert.ok(after.length > 0, "2051~ 구간이 존재해야 함");
  // 과세율 유지
  assert.ok(after.every((r) => Math.abs(r.pensionTaxRate - 0.055) < 1e-9), "연금 과세율 5.5% 유지");
  assert.ok(after.every((r) => Math.abs(r.isaTaxRate - 0.099) < 1e-9), "ISA 과세율 9.9% 유지");
  // net = gross*(1-tax)
  const r0 = after[0];
  assert.ok(Math.abs(r0.pensionNet - r0.pensionGross * (1 - 0.055)) < 1e-6, "연금 net 계산 유지");
  console.log("  2051~ 행수 =", after.length, ", 과세율/net 계산 기존 로직 유지 OK");
}

console.log("\nALL SCENARIOS PASSED ✅");
