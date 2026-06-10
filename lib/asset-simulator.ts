import type {
  DividendBrokerageRow,
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
const PENSION_ANNUAL_LIMIT = 600;
const ISA_TRANSFER_LIMIT = 3000;
const TAX_RATE_ON_DIVIDEND = 0.154;

function clampNumber(value: number | undefined, fallback: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function maybeMigrateWonToManwon(value: number | undefined, fallback: number): number {
  const next = clampNumber(value, fallback);
  return next >= 1_000_000 ? Math.round(next / 10000) : next;
}

function roundManwon(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value));
}

function roundOne(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function realValue(cfg: SimConfig, value: number, index: number): number {
  return value / Math.pow(1 + cfg.inflationRate / 100, index);
}

export function normalizeInputs(inputs: Partial<SimulatorInputs> = {}): SimulatorInputs {
  return {
    startYear: Math.round(clampNumber(inputs.startYear, DEFAULT_SIMULATOR_INPUTS.startYear, 1900, 2200)),
    years: Math.round(clampNumber(inputs.years, DEFAULT_SIMULATOR_INPUTS.years, 1, 60)),
    initialIsa: maybeMigrateWonToManwon(inputs.initialIsa, DEFAULT_SIMULATOR_INPUTS.initialIsa),
    initialPension: maybeMigrateWonToManwon(inputs.initialPension, DEFAULT_SIMULATOR_INPUTS.initialPension),
    reserveCash: maybeMigrateWonToManwon(inputs.reserveCash, DEFAULT_SIMULATOR_INPUTS.reserveCash),
    initialTaxableDividend: maybeMigrateWonToManwon(
      inputs.initialTaxableDividend ?? (inputs as Partial<SimulatorInputs> & { initialTaxable?: number }).initialTaxable,
      DEFAULT_SIMULATOR_INPUTS.initialTaxableDividend,
    ),
    annualReturnRate: clampNumber(inputs.annualReturnRate, DEFAULT_SIMULATOR_INPUTS.annualReturnRate, -99, 100),
    inflationRate: clampNumber(inputs.inflationRate, DEFAULT_SIMULATOR_INPUTS.inflationRate, 0, 50),
    withdrawalRate: clampNumber(inputs.withdrawalRate, DEFAULT_SIMULATOR_INPUTS.withdrawalRate, 0, 30),
    withdrawalGrowthRate: clampNumber(inputs.withdrawalGrowthRate, DEFAULT_SIMULATOR_INPUTS.withdrawalGrowthRate, 0, 30),
    withdrawalDelayYears: Math.round(clampNumber(inputs.withdrawalDelayYears, DEFAULT_SIMULATOR_INPUTS.withdrawalDelayYears, 1, 15)),
  };
}

export function normalizeYearPlans(inputs: SimulatorInputs, yearPlans: YearPlanRow[]): YearPlanRow[] {
  const fallbackPlans = buildDefaultYearPlans(inputs.startYear, inputs.years);

  return Array.from({ length: inputs.years }, (_, index) => {
    const fallback = fallbackPlans[index];
    const existing = yearPlans.find((plan) => plan.year === inputs.startYear + index);
    const legacy = existing as (YearPlanRow & { isaContribution?: boolean | number; pensionContribution?: boolean | number; isaToPensionTransfer?: boolean | number }) | undefined;

    return {
      year: inputs.startYear + index,
      monthlyContribution: clampNumber(existing?.monthlyContribution, fallback.monthlyContribution),
      isaContribution: typeof legacy?.isaContribution === "number" ? legacy.isaContribution > 0 : legacy?.isaContribution ?? fallback.isaContribution,
      pensionContribution: typeof legacy?.pensionContribution === "number" ? legacy.pensionContribution > 0 : legacy?.pensionContribution ?? fallback.pensionContribution,
      isaToPensionTransfer:
        typeof legacy?.isaToPensionTransfer === "number" ? legacy.isaToPensionTransfer > 0 : legacy?.isaToPensionTransfer ?? fallback.isaToPensionTransfer,
    };
  });
}

export function assign_statuses(plans: YearPlan[]): YearPlan[] {
  return plans.map((plan) => {
    let status = "대기";
    if (plan.monthlyContribution > 0) status = "적립중";
    if (plan.isaToPensionTransfer) status = status === "적립중" ? "적립+이전" : "ISA연금이전";
    if (plan.monthlyContribution <= 0 && !plan.isaToPensionTransfer) status = "은퇴";
    return { ...plan, status };
  });
}

export function find_retire_index(plans: YearPlan[]): number {
  const idx = plans.findIndex((plan) => plan.monthlyContribution <= 0 && !plan.isaContribution && !plan.pensionContribution);
  return idx >= 0 ? idx : Math.min(8, plans.length - 1);
}

function splitAnnualContribution(plan: YearPlan): { isa: number; pension: number; reserveNeeded: number } {
  const annual = plan.monthlyContribution * 12;
  let pension = 0;
  let isa = 0;

  if (plan.pensionContribution && plan.isaContribution) {
    pension = Math.min(PENSION_ANNUAL_LIMIT, annual);
    isa = Math.min(ISA_ANNUAL_LIMIT, Math.max(0, annual - pension));
  } else if (plan.pensionContribution) {
    pension = Math.min(PENSION_ANNUAL_LIMIT, annual);
  } else if (plan.isaContribution) {
    isa = Math.min(ISA_ANNUAL_LIMIT, annual);
  }

  return { isa, pension, reserveNeeded: Math.max(0, annual - isa - pension) };
}

export function simulate_deposits(cfg: SimConfig, rawPlans: YearPlan[]): YearResult[] {
  const plans = assign_statuses(rawPlans);
  let isaBalance = cfg.initialIsa;
  let pensionBalance = cfg.initialPension;
  let reserveBalance = cfg.reserveCash;

  return plans.map((plan) => {
    const { isa, pension, reserveNeeded } = splitAnnualContribution(plan);
    const reserveUsed = Math.min(reserveBalance, reserveNeeded);
    reserveBalance -= reserveUsed;

    isaBalance += isa;
    pensionBalance += pension + reserveUsed;

    if (plan.isaToPensionTransfer) {
      const transfer = Math.min(ISA_TRANSFER_LIMIT, isaBalance);
      isaBalance -= transfer;
      pensionBalance += transfer;
    }

    const totalBalance = isaBalance + pensionBalance;
    return {
      year: plan.year,
      status: plan.status ?? "-",
      pensionContribution: roundManwon(pension),
      pensionBalance: roundManwon(pensionBalance),
      isaContribution: roundManwon(isa),
      isaBalance: roundManwon(isaBalance),
      reserveUsed: roundManwon(reserveUsed),
      reserveBalance: roundManwon(reserveBalance),
      totalBalance: roundManwon(totalBalance),
      nominalTaxSavingBalance: roundManwon(totalBalance),
      realTaxSavingBalance: roundManwon(totalBalance),
    };
  });
}

export function apply_returns(cfg: SimConfig, rawResults: YearResult[]): YearResult[] {
  const growth = 1 + cfg.annualReturnRate / 100;
  let isaBalance = cfg.initialIsa;
  let pensionBalance = cfg.initialPension;
  let reserveBalance = cfg.reserveCash;

  return rawResults.map((result) => {
    isaBalance = isaBalance * growth + result.isaContribution;
    pensionBalance = pensionBalance * growth + result.pensionContribution + result.reserveUsed;
    reserveBalance = Math.max(0, reserveBalance - result.reserveUsed);

    if (result.status.includes("이전")) {
      const transfer = Math.min(ISA_TRANSFER_LIMIT, isaBalance);
      isaBalance -= transfer;
      pensionBalance += transfer;
    }

    const totalBalance = isaBalance + pensionBalance;
    return {
      ...result,
      isaBalance: roundManwon(isaBalance),
      pensionBalance: roundManwon(pensionBalance),
      reserveBalance: roundManwon(reserveBalance),
      totalBalance: roundManwon(totalBalance),
      nominalTaxSavingBalance: roundManwon(totalBalance),
      realTaxSavingBalance: roundManwon(totalBalance),
    };
  });
}

export function get_real_balances(cfg: SimConfig, results: YearResult[]): YearResult[] {
  return results.map((result, index) => ({
    ...result,
    realTaxSavingBalance: roundManwon(realValue(cfg, result.nominalTaxSavingBalance, index)),
  }));
}

export function _calc_first_by_limit(results: YearResult[], retireIdx: number): number {
  const row = results[Math.min(Math.max(retireIdx, 0), results.length - 1)];
  return row ? roundManwon((row.nominalTaxSavingBalance * 0.04) / 12) : 0;
}

export function _find_optimal(cfg: SimConfig, results: YearResult[], retireIdx: number): number {
  const start = results[Math.min(Math.max(retireIdx, 0), results.length - 1)]?.nominalTaxSavingBalance ?? 0;
  return roundManwon((start * (cfg.withdrawalRate / 100)) / 12);
}

export function simulate_tax_account_withdraw(cfg: SimConfig, results: YearResult[], retireIdx: number): WithdrawPlan {
  let isaBalance = results[Math.max(retireIdx - 1, 0)]?.isaBalance ?? cfg.initialIsa;
  let pensionBalance = results[Math.max(retireIdx - 1, 0)]?.pensionBalance ?? cfg.initialPension;
  const startIndex = Math.min(results.length - 1, retireIdx + cfg.withdrawalDelayYears - 1);
  const firstAnnualWithdrawal = (isaBalance + pensionBalance) * (cfg.withdrawalRate / 100);
  let firstMonthlyWithdrawal = 0;

  const rows: WithdrawRow[] = results.map((result, index) => {
    if (index < startIndex) {
      return {
        year: result.year,
        category: "대기중",
        isaBalanceNominal: roundManwon(index < retireIdx ? result.isaBalance : isaBalance),
        pensionBalanceNominal: roundManwon(index < retireIdx ? result.pensionBalance : pensionBalance),
        monthlyNominal: 0,
        monthlyReal: 0,
      };
    }

    isaBalance *= 1 + cfg.annualReturnRate / 100;
    pensionBalance *= 1 + cfg.annualReturnRate / 100;
    const withdrawalIndex = index - startIndex;
    const annualWithdrawal = firstAnnualWithdrawal * Math.pow(1 + cfg.withdrawalGrowthRate / 100, withdrawalIndex);
    const fromIsa = Math.min(isaBalance, annualWithdrawal);
    isaBalance -= fromIsa;
    const fromPension = Math.min(pensionBalance, annualWithdrawal - fromIsa);
    pensionBalance -= fromPension;
    const monthlyNominal = (fromIsa + fromPension) / 12;
    if (firstMonthlyWithdrawal === 0) firstMonthlyWithdrawal = monthlyNominal;

    return {
      year: result.year,
      category: fromIsa > 0 && fromPension > 0 ? "ISA+연금" : fromIsa > 0 ? "ISA" : fromPension > 0 ? "연금" : "소진",
      isaBalanceNominal: roundManwon(isaBalance),
      pensionBalanceNominal: roundManwon(pensionBalance),
      monthlyNominal: roundOne(monthlyNominal),
      monthlyReal: roundOne(realValue(cfg, monthlyNominal, index)),
    };
  });

  return { rows, firstMonthlyWithdrawal: roundOne(firstMonthlyWithdrawal) };
}

export function simulate_total_withdraw(cfg: SimConfig, results: YearResult[], retireIdx: number): TotalWithdrawRow[] {
  const taxPlan = simulate_tax_account_withdraw(cfg, results, retireIdx);
  const dividendRows = simulate_dividend_brokerage(cfg, results, taxPlan.rows);

  return results.map((result, index) => {
    const tax = taxPlan.rows[index];
    const dividend = dividendRows[index];
    return {
      year: result.year,
      taxSavingMonthlyNominal: tax.monthlyNominal,
      taxSavingMonthlyReal: tax.monthlyReal,
      taxableMonthlyDividendNominal: dividend.afterTaxMonthlyDividendNominal,
      taxableMonthlyDividendReal: dividend.afterTaxMonthlyDividendReal,
      totalMonthlyIncomeNominal: roundOne(tax.monthlyNominal + dividend.afterTaxMonthlyDividendNominal),
      totalMonthlyIncomeReal: roundOne(tax.monthlyReal + dividend.afterTaxMonthlyDividendReal),
    };
  });
}

export function simulate_dividend_brokerage(
  cfg: SimConfig,
  results: YearResult[],
  taxRows: WithdrawRow[] = [],
): DividendBrokerageRow[] {
  let balance = cfg.initialTaxableDividend;
  const afterTaxDividendRate = Math.max(0, cfg.withdrawalRate / 100) * (1 - TAX_RATE_ON_DIVIDEND);

  return results.map((result, index) => {
    balance *= 1 + cfg.annualReturnRate / 100;
    const annualDividend = balance * afterTaxDividendRate;
    const monthlyDividend = annualDividend / 12;
    const taxMonthly = taxRows[index]?.monthlyNominal ?? 0;
    const taxMonthlyReal = taxRows[index]?.monthlyReal ?? 0;

    return {
      year: result.year,
      taxableDividendBalanceNominal: roundManwon(balance),
      taxableDividendBalanceReal: roundManwon(realValue(cfg, balance, index)),
      afterTaxAnnualDividendNominal: roundOne(annualDividend),
      afterTaxAnnualDividendReal: roundOne(realValue(cfg, annualDividend, index)),
      afterTaxMonthlyDividendNominal: roundOne(monthlyDividend),
      afterTaxMonthlyDividendReal: roundOne(realValue(cfg, monthlyDividend, index)),
      totalMonthlyDividendNominal: roundOne(taxMonthly + monthlyDividend),
      totalMonthlyDividendReal: roundOne(taxMonthlyReal + realValue(cfg, monthlyDividend, index)),
    };
  });
}

export function calculateAssetSimulatorPreview(
  rawInputs: SimulatorInputs,
  rawYearPlans: YearPlanRow[],
): SimulatorProjection {
  const inputs = normalizeInputs(rawInputs);
  const yearPlans = assign_statuses(normalizeYearPlans(inputs, rawYearPlans));
  const depositResults = simulate_deposits(inputs, yearPlans);
  const nominalResults = apply_returns(inputs, depositResults);
  const results = get_real_balances(inputs, nominalResults);
  const retireIdx = find_retire_index(yearPlans);
  const taxPlan = simulate_tax_account_withdraw(inputs, results, retireIdx);
  const totalWithdrawRows = simulate_total_withdraw(inputs, results, retireIdx);
  const dividendRows = simulate_dividend_brokerage(inputs, results, taxPlan.rows);

  const chartRows = results.map((result, index) => {
    const total = totalWithdrawRows[index];
    const dividend = dividendRows[index];
    return {
      ...result,
      ...total,
      taxableDividendBalanceNominal: dividend.taxableDividendBalanceNominal,
      taxableDividendBalanceReal: dividend.taxableDividendBalanceReal,
      combinedNominalBalance: roundManwon(result.nominalTaxSavingBalance + dividend.taxableDividendBalanceNominal),
      combinedRealBalance: roundManwon(result.realTaxSavingBalance + dividend.taxableDividendBalanceReal),
    };
  });

  const finalResult = results[results.length - 1];
  const finalChart = chartRows[chartRows.length - 1];
  const summary: SimulatorSummary = {
    finalNominalWithoutWithdrawal: finalResult?.nominalTaxSavingBalance ?? 0,
    finalRealWithoutWithdrawal: finalResult?.realTaxSavingBalance ?? 0,
    combinedNominalBalance: finalChart?.combinedNominalBalance ?? 0,
    combinedRealBalance: finalChart?.combinedRealBalance ?? 0,
    retirementYear: inputs.startYear + retireIdx,
    pensionLimit: PENSION_ANNUAL_LIMIT,
  };

  return {
    inputs,
    yearPlans,
    results,
    chartRows,
    taxWithdrawRows: taxPlan.rows,
    totalWithdrawRows,
    dividendRows,
    summary,
  };
}
