import type {
  SimulatorInputs,
  SimulatorProjection,
  SimulatorSummary,
  SimulatorYearResult,
  YearPlanRow,
} from "./asset-simulator-types";
import { buildDefaultYearPlans } from "./mock-asset-simulator-data";

function clampNumber(value: number, fallback: number, min = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, value);
}

function roundWon(value: number): number {
  return Math.round(Math.max(0, value));
}

export function normalizeYearPlans(inputs: SimulatorInputs, yearPlans: YearPlanRow[]): YearPlanRow[] {
  const fallbackPlans = buildDefaultYearPlans(inputs.startYear, inputs.years, inputs.withdrawalDelayYears);

  return Array.from({ length: inputs.years }, (_, index) => {
    const fallback = fallbackPlans[index];
    const existing = yearPlans.find((plan) => plan.year === inputs.startYear + index);

    return {
      ...fallback,
      ...existing,
      year: inputs.startYear + index,
      monthlyContribution: clampNumber(existing?.monthlyContribution ?? fallback.monthlyContribution, fallback.monthlyContribution),
      isaContribution: clampNumber(existing?.isaContribution ?? fallback.isaContribution, fallback.isaContribution),
      pensionContribution: clampNumber(existing?.pensionContribution ?? fallback.pensionContribution, fallback.pensionContribution),
      taxableContribution: clampNumber(existing?.taxableContribution ?? fallback.taxableContribution, fallback.taxableContribution),
      isaToPensionTransfer: clampNumber(existing?.isaToPensionTransfer ?? fallback.isaToPensionTransfer, fallback.isaToPensionTransfer),
      note: existing?.note ?? fallback.note,
    };
  });
}

export function calculateAssetSimulatorPreview(
  inputs: SimulatorInputs,
  rawYearPlans: YearPlanRow[],
): SimulatorProjection {
  const years = Math.max(1, Math.min(60, Math.round(inputs.years)));
  const safeInputs = { ...inputs, years };
  const yearPlans = normalizeYearPlans(safeInputs, rawYearPlans);
  const annualReturn = safeInputs.annualReturnRate / 100;
  const inflation = safeInputs.inflationRate / 100;
  const withdrawalRate = safeInputs.withdrawalRate / 100;
  const withdrawalGrowth = safeInputs.withdrawalGrowthRate / 100;
  const retirementIndex = 8 + safeInputs.withdrawalDelayYears;

  let isaBalance = safeInputs.initialIsa;
  let pensionBalance = safeInputs.initialPension;
  let taxableBalance = safeInputs.initialTaxable;
  let firstWithdrawal = 0;
  let totalContribution = 0;
  let totalWithdrawal = 0;

  const results: SimulatorYearResult[] = yearPlans.map((plan, index) => {
    isaBalance = roundWon(isaBalance * (1 + annualReturn));
    pensionBalance = roundWon(pensionBalance * (1 + annualReturn));
    taxableBalance = roundWon(taxableBalance * (1 + annualReturn));

    const transfer = Math.min(plan.isaToPensionTransfer, isaBalance);
    isaBalance -= transfer;
    pensionBalance += transfer;

    const annualIsaContribution = plan.isaContribution * 12;
    const annualPensionContribution = plan.pensionContribution * 12;
    const annualTaxableContribution = plan.taxableContribution * 12;
    const annualContribution = annualIsaContribution + annualPensionContribution + annualTaxableContribution;

    isaBalance += annualIsaContribution;
    pensionBalance += annualPensionContribution;
    taxableBalance += annualTaxableContribution;

    const nominalBeforeWithdrawal = isaBalance + pensionBalance + taxableBalance;
    let annualWithdrawal = 0;

    if (index >= retirementIndex) {
      const withdrawalIndex = index - retirementIndex;
      annualWithdrawal = roundWon(
        nominalBeforeWithdrawal * withdrawalRate * Math.pow(1 + withdrawalGrowth, withdrawalIndex),
      );
      if (firstWithdrawal === 0) firstWithdrawal = annualWithdrawal;

      const fromTaxable = Math.min(taxableBalance, annualWithdrawal);
      taxableBalance -= fromTaxable;
      const remainingAfterTaxable = annualWithdrawal - fromTaxable;
      const fromIsa = Math.min(isaBalance, remainingAfterTaxable);
      isaBalance -= fromIsa;
      const remainingAfterIsa = remainingAfterTaxable - fromIsa;
      pensionBalance = Math.max(0, pensionBalance - remainingAfterIsa);
    }

    totalContribution += annualContribution;
    totalWithdrawal += annualWithdrawal;

    const nominalTotal = roundWon(isaBalance + pensionBalance + taxableBalance);
    const realTotal = roundWon(nominalTotal / Math.pow(1 + inflation, index));
    const cashflow = roundWon(nominalTotal * 0.018);

    return {
      year: plan.year,
      elapsedYear: index,
      isaBalance: roundWon(isaBalance),
      pensionBalance: roundWon(pensionBalance),
      taxableBalance: roundWon(taxableBalance),
      nominalTotal,
      realTotal,
      annualContribution,
      annualWithdrawal,
      cashflow,
    };
  });

  const finalResult = results[results.length - 1];
  const summary: SimulatorSummary = {
    finalNominalAssets: finalResult?.nominalTotal ?? 0,
    finalRealAssets: finalResult?.realTotal ?? 0,
    expectedRetirementYear: safeInputs.startYear + retirementIndex,
    monthlyWithdrawal: firstWithdrawal > 0 ? Math.round(firstWithdrawal / 12) : 0,
    totalContribution,
    totalWithdrawal,
  };

  return { inputs: safeInputs, yearPlans, results, summary };
}
