import type {
  DividendBrokerageRow,
  RealBalanceRow,
  SimConfig,
  SimulationTimeline,
  SimulatorInputs,
  SimulatorProjection,
  SimulatorSummary,
  TotalWithdrawRow,
  WithdrawPlan,
  WithdrawRow,
  YearPlan,
  YearPlanRow,
  YearResult,
} from "./asset-simulator-types";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "./mock-asset-simulator-data";
import { resolveSimulationTimeline } from "./asset-simulator-timeline";

const ISA_ANNUAL_LIMIT = 2000;
const PENSION_ANNUAL_LIMIT = 1800;
const PENSION_LIMIT_WITH_ISA_TRANSFER = 3800;
const ISA_LIMIT_UNTIL_2050 = 10000;
const ISA_TAX_RATE_AFTER_2051 = 0.099;
const PENSION_TAX_RATE_AFTER_2051 = 0.055;
const DIVIDEND_TAX_KEEP_RATE = 0.85;

function clampNumber(value: number | undefined, fallback: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function maybeMigrateWonToManwon(value: number | undefined, fallback: number): number {
  const next = clampNumber(value, fallback);
  return next >= 1_000_000 ? Math.round(next / 10000) : next;
}

function pct(value: number): number {
  return value / 100;
}

function roundManwon(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value));
}

function roundOne(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 10) / 10;
}

function realValue(cfg: SimConfig, value: number, index: number): number {
  return value / Math.pow(1 + pct(cfg.inflationRate), index + 1);
}

function annual(plan: YearPlan): number {
  return plan.monthlyContribution * 12;
}

export function normalizeInputs(inputs: Partial<SimulatorInputs> = {}): SimulatorInputs {
  return {
    startYear: Math.round(clampNumber(inputs.startYear, DEFAULT_SIMULATOR_INPUTS.startYear, 1900, 2200)),
    years: Math.round(clampNumber(inputs.years, DEFAULT_SIMULATOR_INPUTS.years, 1, 60)),
    initialIsa: maybeMigrateWonToManwon(inputs.initialIsa, DEFAULT_SIMULATOR_INPUTS.initialIsa),
    initialPension: maybeMigrateWonToManwon(inputs.initialPension, DEFAULT_SIMULATOR_INPUTS.initialPension),
    reserveCash: maybeMigrateWonToManwon(inputs.reserveCash, DEFAULT_SIMULATOR_INPUTS.reserveCash),
    initialTaxableDividend: maybeMigrateWonToManwon(
      inputs.initialTaxableDividend ?? (inputs as Partial<SimulatorInputs> & { initialTaxable?: number; initDividend?: number }).initialTaxable,
      DEFAULT_SIMULATOR_INPUTS.initialTaxableDividend,
    ),
    annualReturnRate: clampNumber(inputs.annualReturnRate, DEFAULT_SIMULATOR_INPUTS.annualReturnRate, -99, 100),
    inflationRate: clampNumber(inputs.inflationRate, DEFAULT_SIMULATOR_INPUTS.inflationRate, 0, 50),
    withdrawalRate: clampNumber(inputs.withdrawalRate, DEFAULT_SIMULATOR_INPUTS.withdrawalRate, 0, 100),
    withdrawalGrowthRate: clampNumber(inputs.withdrawalGrowthRate, DEFAULT_SIMULATOR_INPUTS.withdrawalGrowthRate, 0, 100),
    withdrawalDelayYears: Math.round(clampNumber(inputs.withdrawalDelayYears, DEFAULT_SIMULATOR_INPUTS.withdrawalDelayYears, 1, 15)),
  };
}

export function normalizeYearPlans(inputs: SimulatorInputs, yearPlans: YearPlanRow[] = []): YearPlanRow[] {
  const fallbackPlans = buildDefaultYearPlans(inputs.startYear, inputs.years);
  // 기존 find()의 "같은 연도 중 첫 행 우선" 동작을 유지하면서 O(Y²) 탐색만 제거한다.
  const plansByYear = new Map<number, YearPlanRow>();
  for (const plan of yearPlans) {
    if (!plansByYear.has(plan.year)) plansByYear.set(plan.year, plan);
  }
  return Array.from({ length: inputs.years }, (_, index) => {
    const year = inputs.startYear + index;
    const fallback = fallbackPlans[index];
    const existing = plansByYear.get(year);
    const legacy = existing as (YearPlanRow & {
      monthly?: number;
      monthlyAmount?: number;
      pensionCheck?: boolean;
      isaCheck?: boolean;
      isaTransfer?: boolean;
    }) | undefined;
    return {
      year,
      monthlyContribution: clampNumber(legacy?.monthlyContribution ?? legacy?.monthly ?? legacy?.monthlyAmount, fallback.monthlyContribution, 0),
      isaContribution: Boolean(legacy?.isaContribution ?? legacy?.isaCheck ?? fallback.isaContribution),
      pensionContribution: Boolean(legacy?.pensionContribution ?? legacy?.pensionCheck ?? fallback.pensionContribution),
      isaToPensionTransfer: Boolean(legacy?.isaToPensionTransfer ?? legacy?.isaTransfer ?? fallback.isaToPensionTransfer),
      status: existing?.status,
    };
  });
}

// EXIT("지금 EXIT?") 모드 전용 계획표를 만든다.
// 연도별 투자 계획표의 모든 적립/납입 계획을 무시하고, 현재 보유 자산만으로
// 즉시 은퇴(시작년도) 후 인출 조건만 적용하도록 모든 적립 항목을 0/false 로 둔다.
// 정상 모드 계산 경로(normalizeYearPlans 결과)는 전혀 건드리지 않는다.
export function buildExitYearPlans(inputs: SimulatorInputs): YearPlanRow[] {
  return Array.from({ length: inputs.years }, (_, index) => ({
    year: inputs.startYear + index,
    monthlyContribution: 0,
    isaContribution: false,
    pensionContribution: false,
    isaToPensionTransfer: false,
  }));
}

export function assign_statuses(plans: YearPlan[]): YearPlan[] {
  let retireFound = false;
  return plans.map((plan) => {
    let status: string;
    if (!retireFound && annual(plan) < 1000) {
      status = "은퇴";
      retireFound = true;
    } else if (retireFound) {
      status = "인출";
    } else {
      status = "적립";
    }
    return { ...plan, status };
  });
}

export function find_retire_index(plans: YearPlan[]): number {
  return plans.findIndex((plan) => plan.status === "은퇴");
}

function emptyYearResult(year: number, status: string): YearResult {
  return {
    year,
    status,
    pensionContribution: 0,
    pensionBalance: 0,
    isaContribution: 0,
    isaBalance: 0,
    reserveUsed: 0,
    reserveBalance: 0,
    totalBalance: 0,
    fromPrevReserveForPension: 0,
    fromPrevReserveForIsa: 0,
    isaTransferred: 0,
    totalPensionDeposit: 0,
    totalIsaDeposit: 0,
    pensionNominal: 0,
    isaNominal: 0,
    reserveNominal: 0,
    totalNominal: 0,
    pensionReal: 0,
    isaReal: 0,
    reserveReal: 0,
    totalReal: 0,
    cumulativeInflation: 1,
    nominalTaxSavingBalance: 0,
    realTaxSavingBalance: 0,
  };
}

export function simulate_deposits(cfg: SimConfig, rawPlans: YearPlan[]): YearResult[] {
  const plans = assign_statuses(rawPlans);
  const results: YearResult[] = [];
  let prevIsa = cfg.initialIsa;
  let prevPension = cfg.initialPension;
  let prevReserve = cfg.reserveCash;
  let totalPensionDeposit = 0;
  let totalIsaDeposit = 0;

  for (const plan of plans) {
    const isRetiredOrAfter = plan.status === "은퇴" || plan.status === "인출";
    const isAfterRetire = plan.status === "인출";
    let remainingAnnual = annual(plan);
    let pensionDeposit = 0;
    let isaDeposit = 0;
    let reserveDeposit = 0;
    let fromPrevReserveForPension = 0;
    let fromPrevReserveForIsa = 0;
    let isaTransferred = 0;

    if (plan.isaToPensionTransfer && prevIsa > 0) {
      isaTransferred = prevIsa;
      prevPension += prevIsa;
      prevIsa = 0;
    }

    const pensionLimit = plan.isaToPensionTransfer ? PENSION_LIMIT_WITH_ISA_TRANSFER : PENSION_ANNUAL_LIMIT;

    if (!isAfterRetire) {
      if (plan.pensionContribution && !isRetiredOrAfter) {
        if (remainingAnnual >= pensionLimit) {
          pensionDeposit = pensionLimit;
          remainingAnnual -= pensionLimit;
        } else {
          pensionDeposit = remainingAnnual;
          const needed = pensionLimit - remainingAnnual;
          if (prevReserve >= needed) {
            fromPrevReserveForPension = needed;
            pensionDeposit = pensionLimit;
            prevReserve -= needed;
          } else {
            fromPrevReserveForPension = prevReserve;
            pensionDeposit += prevReserve;
            prevReserve = 0;
          }
          remainingAnnual = 0;
        }
      }

      if (plan.isaContribution) {
        if (isRetiredOrAfter) {
          if (prevReserve >= ISA_ANNUAL_LIMIT) {
            fromPrevReserveForIsa = ISA_ANNUAL_LIMIT;
            isaDeposit = ISA_ANNUAL_LIMIT;
            prevReserve -= ISA_ANNUAL_LIMIT;
          } else {
            fromPrevReserveForIsa = prevReserve;
            isaDeposit = prevReserve;
            prevReserve = 0;
          }
          const remain = Math.min(remainingAnnual, ISA_ANNUAL_LIMIT - isaDeposit);
          isaDeposit += remain;
          remainingAnnual -= remain;
        } else if (remainingAnnual >= ISA_ANNUAL_LIMIT) {
          isaDeposit = ISA_ANNUAL_LIMIT;
          remainingAnnual -= ISA_ANNUAL_LIMIT;
        } else {
          isaDeposit = remainingAnnual;
          const needed = ISA_ANNUAL_LIMIT - remainingAnnual;
          if (prevReserve >= needed) {
            fromPrevReserveForIsa = needed;
            isaDeposit = ISA_ANNUAL_LIMIT;
            prevReserve -= needed;
          } else {
            fromPrevReserveForIsa = prevReserve;
            isaDeposit += prevReserve;
            prevReserve = 0;
          }
          remainingAnnual = 0;
        }
      }
      reserveDeposit = remainingAnnual;
    } else {
      if (plan.isaContribution) {
        if (prevReserve >= ISA_ANNUAL_LIMIT) {
          fromPrevReserveForIsa = ISA_ANNUAL_LIMIT;
          isaDeposit = ISA_ANNUAL_LIMIT;
          prevReserve -= ISA_ANNUAL_LIMIT;
        } else {
          fromPrevReserveForIsa = prevReserve;
          isaDeposit = prevReserve;
          prevReserve = 0;
        }
        const remain = Math.min(remainingAnnual, ISA_ANNUAL_LIMIT - isaDeposit);
        isaDeposit += remain;
        remainingAnnual -= remain;
      }
      reserveDeposit = remainingAnnual;
    }

    const pensionBalance = prevPension + pensionDeposit;
    const isaBalance = prevIsa + isaDeposit;
    const reserveBalance = prevReserve + reserveDeposit;
    totalPensionDeposit += pensionDeposit;
    totalIsaDeposit += isaDeposit;

    results.push({
      ...emptyYearResult(plan.year, plan.status ?? "적립"),
      pensionContribution: pensionDeposit,
      pensionBalance,
      isaContribution: isaDeposit,
      isaBalance,
      reserveUsed: reserveDeposit,
      reserveBalance,
      totalBalance: pensionBalance + isaBalance + reserveBalance,
      fromPrevReserveForPension,
      fromPrevReserveForIsa,
      isaTransferred,
      totalPensionDeposit,
      totalIsaDeposit,
    });

    prevPension = pensionBalance;
    prevIsa = isaBalance;
    prevReserve = reserveBalance;
  }

  return results;
}

export function apply_returns(cfg: SimConfig, rawResults: YearResult[]): YearResult[] {
  const growth = 1 + pct(cfg.annualReturnRate);
  let pensionNominal = 0;
  let isaNominal = 0;
  let reserveNominal = 0;

  return rawResults.map((result, index) => {
    if (index === 0) {
      pensionNominal = cfg.initialPension * growth + result.pensionContribution;
      isaNominal = cfg.initialIsa * growth + result.isaContribution;
      reserveNominal = cfg.reserveCash * growth + result.reserveUsed;
      if (result.isaTransferred > 0) {
        pensionNominal += result.isaTransferred * growth;
        isaNominal = result.isaContribution;
      }
    } else {
      pensionNominal = pensionNominal * growth + result.pensionContribution;
      isaNominal = isaNominal * growth + result.isaContribution;
      reserveNominal = reserveNominal * growth + result.reserveUsed;
      if (result.isaTransferred > 0) {
        pensionNominal += result.isaTransferred * growth;
        isaNominal = result.isaContribution;
      }
    }

    const totalNominal = pensionNominal + isaNominal + reserveNominal;
    return {
      ...result,
      pensionNominal,
      isaNominal,
      reserveNominal,
      totalNominal,
      nominalTaxSavingBalance: totalNominal,
    };
  });
}

export function get_real_balances(cfg: SimConfig, results: YearResult[]): YearResult[] {
  let cumulativeInflation = 1;
  return results.map((result) => {
    cumulativeInflation *= 1 + pct(cfg.inflationRate);
    const pensionReal = result.pensionNominal / cumulativeInflation;
    const isaReal = result.isaNominal / cumulativeInflation;
    const reserveReal = result.reserveNominal / cumulativeInflation;
    const totalReal = result.totalNominal / cumulativeInflation;
    return {
      ...result,
      pensionReal,
      isaReal,
      reserveReal,
      totalReal,
      cumulativeInflation,
      realTaxSavingBalance: totalReal,
    };
  });
}

export function real_balance_rows(results: YearResult[]): RealBalanceRow[] {
  return results.map((row) => ({
    year: row.year,
    pensionReal: row.pensionReal,
    isaReal: row.isaReal,
    reserveReal: row.reserveReal,
    totalReal: row.totalReal,
    cumulativeInflation: row.cumulativeInflation,
  }));
}

export function _calc_first_by_limit(totalLimit: number, years: number, effRate: number): number {
  if (years <= 0) return 0;
  if (effRate === 0) return totalLimit / years;
  const factor = (Math.pow(1 + effRate, years) - 1) / effRate;
  return totalLimit / factor;
}

// 55세 이전(~2050) 절세계좌 인출 "첫해 인출액" 산정.
//
// 기존 _find_optimal() 은 평가금액(원금+운용수익)을 기준으로 이분탐색하여 인출액을 역산했다.
// 신규 기획 의도("55세 이전에는 납입한 원금만 인출, 수익은 계속 운용")에 따라
// 평가금액 역산 방식을 제거하고, "누적 납입원금"을 목표기간 동안 실질가치 일정하게
// 소진하는 등비수열 합 공식(_calc_first_by_limit 재사용)으로 단순화한다.
//   firstWithdraw = principal / Σ_{k=0}^{N-1} (1+effRate)^k
//   effRate = (1+인출증가율)(1+물가) - 1
//     · 인출증가율 = 0  → 명목 인출금이 물가만큼 증가 → 실질 구매력 일정
//     · 인출증가율 > 0  → 명목 인출금이 물가보다 빠르게 증가 → 실질 구매력 점증(허용)
function _calc_principal_first_withdraw(principal: number, years: number, effRate: number): number {
  return _calc_first_by_limit(Math.max(0, principal), years, effRate);
}

export function simulate_tax_account_withdraw(
  cfg: SimConfig,
  results: YearResult[],
  timeline: SimulationTimeline,
): WithdrawPlan | null {
  const retireIdx = timeline.retirementIndex;
  const actualStartIdx = timeline.withdrawalStartIndex;
  if (retireIdx === null || actualStartIdx === null) return null;

  const retireYear = timeline.retirementYear ?? results[retireIdx].year;
  const actualStartYear = timeline.withdrawalStartYear ?? results[actualStartIdx].year;
  const returnRate = pct(cfg.annualReturnRate);
  const inflationRate = pct(cfg.inflationRate);
  const withdrawalRate = pct(cfg.withdrawalRate);
  const withdrawalGrowthRate = pct(cfg.withdrawalGrowthRate);

  // ── 55세 이전(~2050) 인출 구간 식별 ─────────────────────────────────────
  // actualStartIdx 부터 연도가 2050 이하인 마지막 인덱스를 찾는다.
  let lastPre2050Idx = -1;
  for (let i = actualStartIdx; i < results.length; i += 1) {
    if (results[i].year <= 2050) lastPre2050Idx = i;
    else break;
  }
  // 실제 인출 연수(목표기간 N). 시뮬레이션이 2050 이전에 끝나도 안전하도록 실제 행 수로 계산한다.
  const yearsUntil2050 = lastPre2050Idx >= actualStartIdx ? lastPre2050Idx - actualStartIdx + 1 : 0;

  // ── 누적 납입원금 풀(평가금액 아님) ─────────────────────────────────────
  // simulate_deposits 단계의 isaBalance/pensionBalance 는 "운용수익이 미반영된" 납입원금 누계이며
  // ISA→연금 이전(transfer)도 반영되어 있다. 55세 이전 인출은 이 납입원금만을 대상으로 하고,
  // 운용수익(평가금액-원금)은 인출하지 않고 계속 운용되는 것으로 가정한다.
  // 풀 = 2050년까지 절세계좌에 쌓인 누적 납입원금(대기/인출 기간 추가 납입 포함, FIFO 미관리).
  const principalSourceIdx = lastPre2050Idx >= actualStartIdx ? lastPre2050Idx : retireIdx;
  const isaPrincipalRaw = results[principalSourceIdx]?.isaBalance ?? results[retireIdx].isaBalance;
  const pensionPrincipalRaw = results[principalSourceIdx]?.pensionBalance ?? results[retireIdx].pensionBalance;
  // ISA 는 2050년까지 비과세 인출 한도(1억) 범위 내에서만 원금 인출. 초과분은 잔고에 남아 2051~ 과세구간에서 처리.
  const isaPrincipalPool = Math.min(isaPrincipalRaw, ISA_LIMIT_UNTIL_2050);
  const pensionPrincipalPool = pensionPrincipalRaw;

  // 명목 인출 증가율: 실질 구매력 유지(물가) + 인출증가율. ISA·연금에 동일하게 적용한다.
  //   인출증가율 0  → 명목이 물가만큼 증가 → 실질 일정
  //   인출증가율 >0 → 명목이 물가보다 빠르게 증가 → 실질 점증(허용)
  const effRate = (1 + withdrawalGrowthRate) * (1 + inflationRate) - 1;

  // 첫해 인출액 = 납입원금을 목표기간 N 동안 등비수열로 정확히 소진하도록 역산.
  const isaFirst = _calc_principal_first_withdraw(isaPrincipalPool, yearsUntil2050, effRate);
  const pensionFirst = _calc_principal_first_withdraw(pensionPrincipalPool, yearsUntil2050, effRate);

  const plan: WithdrawPlan = {
    retireYear,
    actualStartYear,
    yearsUntil2050,
    // BalanceAtStart 는 이제 "55세 이전에 인출 가능한 납입원금"을 의미한다(평가금액 아님).
    isaBalanceAtStart: isaPrincipalPool,
    pensionBalanceAtStart: pensionPrincipalPool,
    isaFirstWithdraw: isaFirst,
    pensionFirstWithdraw: pensionFirst,
    isaConstraint: "원금소진",
    pensionConstraint: "원금소진",
    pensionDepositLimit: pensionPrincipalPool,
    isaLimitUntil2050: ISA_LIMIT_UNTIL_2050,
    rows: [],
    totalGrossIsa: 0,
    totalGrossPension: 0,
    totalNetIsa: 0,
    totalNetPension: 0,
    finalIsaBalance: 0,
    finalPensionBalance: 0,
  };

  // 평가금액 잔고(운용수익 포함): 55세 이후(2051~) 인출은 기존대로 이 잔고 기준으로 계산한다.
  let pensionBalance = results[retireIdx].pensionNominal || results[retireIdx].pensionBalance;
  let isaBalance = results[retireIdx].isaNominal || results[retireIdx].isaBalance;
  // 55세 이전 인출 대상인 "남은 납입원금". 매년 인출분만큼 감소하며 마지막 해에 0 이 된다.
  let remainingIsaPrincipal = isaPrincipalPool;
  let remainingPensionPrincipal = pensionPrincipalPool;
  let totalWithdrawIsa = 0;
  let totalWithdrawPension = 0;
  let isa2051Base = 0;
  let pension2051Base = 0;
  let cumulativeInflation = 1;
  for (let i = 0; i <= retireIdx; i += 1) cumulativeInflation *= 1 + inflationRate;

  for (let i = retireIdx + 1; i < results.length; i += 1) {
    const row = results[i];
    cumulativeInflation *= 1 + inflationRate;
    pensionBalance *= 1 + returnRate;
    isaBalance *= 1 + returnRate;
    isaBalance += row.isaContribution;

    const isDelay = i < actualStartIdx;
    let isaGross = 0;
    let pensionGross = 0;
    let isaNet = 0;
    let pensionNet = 0;
    let isaTaxRate = 0;
    let pensionTaxRate = 0;
    let category = "";
    let isaRemainingLimit: number | null = null;
    let pensionRemainingLimit: number | null = null;

    if (isDelay) {
      category = "대기";
    } else if (row.year <= 2050) {
      category = "~2050";
      const yearsFromStart = i - actualStartIdx;
      const isLastPre2050 = i === lastPre2050Idx;

      // ISA: 납입원금 등비 인출. 마지막 해에는 잔여 원금을 전액 인출하여 정확히 0 으로 소진한다.
      // 평가금액(isaNominal)은 인출액 계산에 사용하지 않는다(운용수익은 계속 운용).
      isaGross = isLastPre2050
        ? remainingIsaPrincipal
        : Math.min(isaFirst * Math.pow(1 + effRate, yearsFromStart), remainingIsaPrincipal);
      // 안전장치: 평가잔고를 초과해 인출하지 않는다(정상적으로 평가잔고 ≥ 원금 이므로 비구속).
      isaGross = Math.min(isaGross, isaBalance);
      remainingIsaPrincipal = Math.max(0, remainingIsaPrincipal - isaGross);

      // 연금: 동일 방식(누적 납입원금 등비 소진).
      pensionGross = isLastPre2050
        ? remainingPensionPrincipal
        : Math.min(pensionFirst * Math.pow(1 + effRate, yearsFromStart), remainingPensionPrincipal);
      pensionGross = Math.min(pensionGross, pensionBalance);
      remainingPensionPrincipal = Math.max(0, remainingPensionPrincipal - pensionGross);

      // 55세 이전은 납입원금 인출이므로 비과세(net = gross).
      isaNet = isaGross;
      pensionNet = pensionGross;
      // 잔여 인출 가능 원금(표기용).
      isaRemainingLimit = remainingIsaPrincipal;
      pensionRemainingLimit = remainingPensionPrincipal;
    } else {
      category = "2051~";
      isaTaxRate = ISA_TAX_RATE_AFTER_2051;
      pensionTaxRate = PENSION_TAX_RATE_AFTER_2051;
      const yearsFrom2051 = row.year - 2051;
      if (yearsFrom2051 === 0) {
        isa2051Base = isaBalance * withdrawalRate;
        pension2051Base = pensionBalance * withdrawalRate;
        isaGross = isa2051Base;
        pensionGross = pension2051Base;
      } else {
        isaGross = isa2051Base * Math.pow(1 + withdrawalGrowthRate, yearsFrom2051);
        pensionGross = pension2051Base * Math.pow(1 + withdrawalGrowthRate, yearsFrom2051);
      }
      isaGross = Math.min(isaGross, isaBalance);
      pensionGross = Math.min(pensionGross, pensionBalance);
      isaNet = isaGross * (1 - isaTaxRate);
      pensionNet = pensionGross * (1 - pensionTaxRate);
    }

    isaBalance = Math.max(0, isaBalance - isaGross);
    pensionBalance = Math.max(0, pensionBalance - pensionGross);
    totalWithdrawIsa += isaGross;
    totalWithdrawPension += pensionGross;
    const totalNet = isaNet + pensionNet;
    const monthlyNet = totalNet / 12;
    const monthlyNetReal = monthlyNet / cumulativeInflation;

    plan.rows.push({
      year: row.year,
      category,
      isDelay,
      isaGross,
      isaNet,
      isaBalanceNominal: isaBalance,
      isaRemainingLimit,
      pensionGross,
      pensionNet,
      pensionBalanceNominal: pensionBalance,
      pensionRemainingLimit,
      totalNet,
      monthlyNominal: monthlyNet,
      monthlyReal: monthlyNetReal,
      isaTaxRate,
      pensionTaxRate,
    });

    plan.totalGrossIsa += isaGross;
    plan.totalGrossPension += pensionGross;
    plan.totalNetIsa += isaNet;
    plan.totalNetPension += pensionNet;
  }

  plan.finalIsaBalance = isaBalance;
  plan.finalPensionBalance = pensionBalance;
  return plan;
}

export function simulate_total_withdraw(cfg: SimConfig, results: YearResult[], timeline: SimulationTimeline): TotalWithdrawRow[] {
  const rows: TotalWithdrawRow[] = [];
  const safeRetireIdx = timeline.retirementIndex ?? results.length;
  let firstWithdraw = 0;
  let cumulativeInflation = 1;

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    cumulativeInflation *= 1 + pct(cfg.inflationRate);
    const isWithdraw = index > safeRetireIdx;
    let withdraw = 0;
    let afterBalance = result.totalNominal;
    let realWithdraw = 0;

    if (isWithdraw) {
      if (firstWithdraw === 0) {
        firstWithdraw = result.totalNominal * pct(cfg.withdrawalRate);
        withdraw = firstWithdraw;
      } else {
        withdraw = firstWithdraw * Math.pow(1 + pct(cfg.withdrawalGrowthRate), index - safeRetireIdx - 1);
      }
      afterBalance = result.totalNominal - withdraw;
      realWithdraw = withdraw / cumulativeInflation;
    }

    rows.push({
      year: result.year,
      totalNominal: result.totalNominal,
      withdraw,
      monthly: withdraw / 12,
      afterBalance,
      realWithdraw,
      isWithdraw,
      taxSavingMonthlyNominal: 0,
      taxSavingMonthlyReal: 0,
      taxableMonthlyDividendNominal: 0,
      taxableMonthlyDividendReal: 0,
      totalMonthlyIncomeNominal: 0,
      totalMonthlyIncomeReal: 0,
    });
  }
  return rows;
}

export function simulate_dividend_brokerage(cfg: SimConfig, results: YearResult[], taxRows: WithdrawRow[] = []): DividendBrokerageRow[] {
  const taxByYear = new Map(taxRows.map((row) => [row.year, row]));
  let balance = cfg.initialTaxableDividend;
  const returnRate = pct(cfg.annualReturnRate);
  const inflationRate = pct(cfg.inflationRate);
  const withdrawalRate = pct(cfg.withdrawalRate);

  return results.map((result) => {
    const isWithdraw = String(result.status).includes("인출");
    const growth = balance * returnRate;
    const afterGrowth = balance + growth;
    let grossDividend = 0;
    if (isWithdraw) {
      grossDividend = balance * withdrawalRate;
      balance = Math.max(0, afterGrowth - grossDividend);
    } else {
      balance = afterGrowth;
    }

    const netDividend = grossDividend * DIVIDEND_TAX_KEEP_RATE;
    const discount = Math.pow(1 + inflationRate, result.year - cfg.startYear);
    const balanceReal = balance / discount;
    const netDividendReal = netDividend / discount;
    const monthlyDividend = netDividend / 12;
    const monthlyDividendReal = netDividendReal / 12;
    const taxRow = taxByYear.get(result.year);
    const taxMonthly = taxRow && !taxRow.isDelay ? taxRow.monthlyNominal : 0;
    const taxMonthlyReal = taxRow && !taxRow.isDelay ? taxRow.monthlyReal : 0;

    return {
      year: result.year,
      taxableDividendBalanceNominal: balance,
      taxableDividendBalanceReal: balanceReal,
      afterTaxAnnualDividendNominal: netDividend,
      afterTaxAnnualDividendReal: netDividendReal,
      afterTaxMonthlyDividendNominal: monthlyDividend,
      afterTaxMonthlyDividendReal: monthlyDividendReal,
      totalMonthlyDividendNominal: monthlyDividend + taxMonthly,
      totalMonthlyDividendReal: monthlyDividendReal + taxMonthlyReal,
    };
  });
}

export function calculateAssetSimulatorPreview(
  rawInputs: SimulatorInputs,
  rawYearPlans: YearPlanRow[],
  exitMode = false,
): SimulatorProjection {
  const inputs = normalizeInputs(rawInputs);
  // EXIT 모드: 연도별 투자 계획표 입력값을 전부 무시하고 현재 보유 자산만 시작 자산으로 사용한다.
  // buildExitYearPlans 는 모든 적립액을 0 으로 두므로 assign_statuses 가 첫 해(=시작년도)를
  // "은퇴" 로 표시한다. 즉 retireIdx === 0, 은퇴년도 === inputs.startYear 가 보장되고,
  // 인출 시작 연도 === inputs.startYear + withdrawalDelayYears 규칙은
  // resolveSimulationTimeline에서 계획표와 무관하게 동일하게 해석된다.
  const normalizedYearPlans = exitMode
    ? buildExitYearPlans(inputs)
    : normalizeYearPlans(inputs, rawYearPlans);
  const timeline = resolveSimulationTimeline(inputs, normalizedYearPlans);
  const yearPlans = assign_statuses(normalizedYearPlans);
  const depositResults = simulate_deposits(inputs, yearPlans);
  const nominalResults = apply_returns(inputs, depositResults);
  const results = get_real_balances(inputs, nominalResults);
  const realData = real_balance_rows(results);
  const retireIdx = timeline.retirementIndex ?? -1;
  const totalWithdrawSourceRows = simulate_total_withdraw(inputs, results, timeline);
  const withdrawPlan = simulate_tax_account_withdraw(inputs, results, timeline);
  const taxWithdrawRows = withdrawPlan?.rows ?? [];
  const dividendRows = simulate_dividend_brokerage(inputs, results, taxWithdrawRows);
  const taxByYear = new Map(taxWithdrawRows.map((row) => [row.year, row]));
  const dividendByYear = new Map(dividendRows.map((row) => [row.year, row]));

  const totalWithdrawRows = results.map((result, index) => {
    const tax = taxByYear.get(result.year);
    const dividend = dividendByYear.get(result.year);
    const taxSavingMonthlyNominal = tax && !tax.isDelay ? tax.monthlyNominal : 0;
    const taxSavingMonthlyReal = tax && !tax.isDelay ? tax.monthlyReal : 0;
    const taxableMonthlyDividendNominal = dividend?.afterTaxMonthlyDividendNominal ?? 0;
    const taxableMonthlyDividendReal = dividend?.afterTaxMonthlyDividendReal ?? 0;
    return {
      ...totalWithdrawSourceRows[index],
      taxSavingMonthlyNominal,
      taxSavingMonthlyReal,
      taxableMonthlyDividendNominal,
      taxableMonthlyDividendReal,
      totalMonthlyIncomeNominal: taxSavingMonthlyNominal + taxableMonthlyDividendNominal,
      totalMonthlyIncomeReal: taxSavingMonthlyReal + taxableMonthlyDividendReal,
    };
  });

  const chartRows = results.map((result, index) => {
    const total = totalWithdrawRows[index];
    const dividend = dividendRows[index];
    const taxRow = taxByYear.get(result.year);
    const taxNominal = taxRow ? taxRow.isaBalanceNominal + taxRow.pensionBalanceNominal : result.isaNominal + result.pensionNominal;
    const taxReal = taxNominal / Math.pow(1 + pct(inputs.inflationRate), result.year - inputs.startYear);
    return {
      ...result,
      ...total,
      nominalTaxSavingBalance: taxNominal,
      realTaxSavingBalance: taxReal,
      taxableDividendBalanceNominal: dividend.taxableDividendBalanceNominal,
      taxableDividendBalanceReal: dividend.taxableDividendBalanceReal,
      combinedNominalBalance: taxNominal + dividend.taxableDividendBalanceNominal,
      combinedRealBalance: taxReal + dividend.taxableDividendBalanceReal,
    };
  });

  const finalResult = results[results.length - 1];
  const finalChart = chartRows[chartRows.length - 1];
  const pensionLimitSource = finalResult ?? results[retireIdx] ?? null;
  const summary: SimulatorSummary = {
    finalNominalWithoutWithdrawal: finalResult?.totalNominal ?? 0,
    finalRealWithoutWithdrawal: finalResult?.totalReal ?? 0,
    combinedNominalBalance: finalChart?.combinedNominalBalance ?? 0,
    combinedRealBalance: finalChart?.combinedRealBalance ?? 0,
    retirementYear: timeline.retirementYear,
    actualWithdrawalStartYear: timeline.withdrawalStartYear,
    pensionLimit: inputs.initialPension + (pensionLimitSource?.totalPensionDeposit ?? 0),
  };

  return {
    inputs,
    timeline,
    yearPlans,
    results,
    realData,
    chartRows,
    taxWithdrawRows,
    totalWithdrawRows,
    dividendRows,
    withdrawPlan,
    summary,
  };
}
