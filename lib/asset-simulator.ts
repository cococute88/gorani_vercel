import type {
  DividendBrokerageRow,
  RealBalanceRow,
  SimConfig,
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
  return Array.from({ length: inputs.years }, (_, index) => {
    const year = inputs.startYear + index;
    const fallback = fallbackPlans[index];
    const existing = yearPlans.find((plan) => plan.year === year);
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

export function _find_optimal(
  initialBalance: number,
  returnRate: number,
  effRate: number,
  years: number,
  limit: number,
  additionalDeposits: number[] = [],
): number {
  if (years <= 0) return 0;
  let high = _calc_first_by_limit(limit, years, effRate);
  let low = 0;
  let optimal = 0;

  for (let iter = 0; iter < 50; iter += 1) {
    const mid = (low + high) / 2;
    let balance = initialBalance;
    let totalWithdraw = 0;
    let prevWithdraw = 0;
    let valid = true;

    for (let y = 0; y < years; y += 1) {
      balance *= 1 + returnRate;
      if (y < additionalDeposits.length) balance += additionalDeposits[y];
      let withdraw = mid * Math.pow(1 + effRate, y);
      if (totalWithdraw + withdraw > limit) withdraw = Math.max(0, limit - totalWithdraw);
      if (withdraw > balance || withdraw < prevWithdraw - 0.001) {
        valid = false;
        break;
      }
      balance -= withdraw;
      totalWithdraw += withdraw;
      prevWithdraw = withdraw;
    }

    if (valid) {
      optimal = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return optimal;
}

export function simulate_tax_account_withdraw(cfg: SimConfig, results: YearResult[], retireIdx: number): WithdrawPlan | null {
  if (retireIdx < 0) return null;
  const delay = Math.max(1, Math.min(15, cfg.withdrawalDelayYears));
  const actualStartIdx = retireIdx + delay;
  if (actualStartIdx >= results.length) return null;

  const retireYear = results[retireIdx].year;
  const actualStartYear = results[actualStartIdx].year;
  let isaAtStart = results[retireIdx].isaNominal || results[retireIdx].isaBalance;
  let pensionAtStart = results[retireIdx].pensionNominal || results[retireIdx].pensionBalance;
  const returnRate = pct(cfg.annualReturnRate);
  const inflationRate = pct(cfg.inflationRate);
  const withdrawalRate = pct(cfg.withdrawalRate);
  const withdrawalGrowthRate = pct(cfg.withdrawalGrowthRate);

  for (let d = retireIdx + 1; d <= retireIdx + delay; d += 1) {
    if (d < results.length) {
      isaAtStart *= 1 + returnRate;
      pensionAtStart *= 1 + returnRate;
      isaAtStart += results[d].isaContribution;
    }
  }

  const pensionDepositLimit = cfg.initialPension + results[retireIdx].totalPensionDeposit;
  const yearsUntil2050 = Math.max(0, 2050 - actualStartYear + 1);
  const isaEffRate = (1 + withdrawalGrowthRate) * (1 + inflationRate) - 1;
  const pensionEffRate = withdrawalGrowthRate;
  const isaAdditional = results.slice(actualStartIdx).filter((row) => row.year <= 2050).map((row) => row.isaContribution);
  const isaFirst = _find_optimal(isaAtStart, returnRate, isaEffRate, yearsUntil2050, ISA_LIMIT_UNTIL_2050, isaAdditional);
  const pensionFirst = _find_optimal(pensionAtStart, returnRate, pensionEffRate, yearsUntil2050, pensionDepositLimit);
  const isaFirstByLimit = _calc_first_by_limit(ISA_LIMIT_UNTIL_2050, yearsUntil2050, isaEffRate);
  const pensionFirstByLimit = _calc_first_by_limit(pensionDepositLimit, yearsUntil2050, pensionEffRate);

  const plan: WithdrawPlan = {
    retireYear,
    actualStartYear,
    yearsUntil2050,
    isaBalanceAtStart: isaAtStart,
    pensionBalanceAtStart: pensionAtStart,
    isaFirstWithdraw: isaFirst,
    pensionFirstWithdraw: pensionFirst,
    isaConstraint: isaFirst < isaFirstByLimit * 0.99 ? "잔고제약" : "한도기준",
    pensionConstraint: pensionFirst < pensionFirstByLimit * 0.99 ? "잔고제약" : "한도기준",
    pensionDepositLimit,
    isaLimitUntil2050: ISA_LIMIT_UNTIL_2050,
    rows: [],
    totalGrossIsa: 0,
    totalGrossPension: 0,
    totalNetIsa: 0,
    totalNetPension: 0,
    finalIsaBalance: 0,
    finalPensionBalance: 0,
  };

  let pensionBalance = results[retireIdx].pensionNominal || results[retireIdx].pensionBalance;
  let isaBalance = results[retireIdx].isaNominal || results[retireIdx].isaBalance;
  let totalWithdrawIsa = 0;
  let totalWithdrawPension = 0;
  let isa2051Base = 0;
  let pension2051Base = 0;
  let prevIsaWithdraw = 0;
  let prevPensionWithdraw = 0;
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
      isaGross = isaFirst * Math.pow(1 + isaEffRate, yearsFromStart);
      if (totalWithdrawIsa + isaGross > ISA_LIMIT_UNTIL_2050) isaGross = Math.max(0, ISA_LIMIT_UNTIL_2050 - totalWithdrawIsa);
      if (isaGross < prevIsaWithdraw && prevIsaWithdraw > 0) isaGross = prevIsaWithdraw;
      isaGross = Math.min(isaGross, isaBalance * withdrawalRate, isaBalance);

      pensionGross = pensionFirst * Math.pow(1 + pensionEffRate, yearsFromStart);
      if (totalWithdrawPension + pensionGross > pensionDepositLimit) pensionGross = Math.max(0, pensionDepositLimit - totalWithdrawPension);
      if (pensionGross < prevPensionWithdraw && prevPensionWithdraw > 0) pensionGross = prevPensionWithdraw;
      pensionGross = Math.min(pensionGross, pensionBalance * withdrawalRate, pensionBalance);

      isaNet = isaGross;
      pensionNet = pensionGross;
      isaRemainingLimit = Math.max(0, ISA_LIMIT_UNTIL_2050 - totalWithdrawIsa - isaGross);
      pensionRemainingLimit = Math.max(0, pensionDepositLimit - totalWithdrawPension - pensionGross);
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

    if (!isDelay) {
      prevIsaWithdraw = isaGross;
      prevPensionWithdraw = pensionGross;
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

export function simulate_total_withdraw(cfg: SimConfig, results: YearResult[], retireIdx: number): TotalWithdrawRow[] {
  const rows: TotalWithdrawRow[] = [];
  const safeRetireIdx = retireIdx < 0 ? results.length : retireIdx;
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

export function calculateAssetSimulatorPreview(rawInputs: SimulatorInputs, rawYearPlans: YearPlanRow[]): SimulatorProjection {
  const inputs = normalizeInputs(rawInputs);
  const yearPlans = assign_statuses(normalizeYearPlans(inputs, rawYearPlans));
  const depositResults = simulate_deposits(inputs, yearPlans);
  const nominalResults = apply_returns(inputs, depositResults);
  const results = get_real_balances(inputs, nominalResults);
  const realData = real_balance_rows(results);
  const retireIdx = find_retire_index(yearPlans);
  const totalWithdrawSourceRows = simulate_total_withdraw(inputs, results, retireIdx);
  const withdrawPlan = simulate_tax_account_withdraw(inputs, results, retireIdx);
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
    retirementYear: retireIdx >= 0 ? yearPlans[retireIdx].year : null,
    actualWithdrawalStartYear: withdrawPlan?.actualStartYear ?? null,
    pensionLimit: inputs.initialPension + (pensionLimitSource?.totalPensionDeposit ?? 0),
  };

  return {
    inputs,
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
