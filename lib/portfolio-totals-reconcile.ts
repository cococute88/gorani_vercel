import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";

export type TotalFinancialAssetSource =
  | "snapshot.totalAssetKRW"
  | "financeAssets.sum"
  | "investmentValueKRW"
  | "holdings.sum"
  | "unavailable";

export type InvestmentValueSource = "snapshot.investmentValueKRW" | "holdings.sum" | "unavailable";
export type CashAndOtherSource = "total-minus-investment" | "unavailable";

export interface PortfolioTotalsWarning {
  code: string;
  message: string;
}

export interface PortfolioTotalsReconciliation {
  totalFinancialAssetKRW: number | null;
  totalFinancialAssetSource: TotalFinancialAssetSource;
  investmentValueKRW: number | null;
  investmentValueSource: InvestmentValueSource;
  investmentPrincipalKRW: number | null;
  cashAndOtherKRW: number | null;
  cashAndOtherSource: CashAndOtherSource;
  returnAmountKRW: number | null;
  returnPct: number | null;
  warnings: PortfolioTotalsWarning[];
}

function validMoney(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function validNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function addWarning(warnings: PortfolioTotalsWarning[], code: string, message: string): void {
  if (warnings.some((warning) => warning.code === code)) return;
  warnings.push({ code, message });
}

function warnInvalidField(
  warnings: PortfolioTotalsWarning[],
  field: string,
  value: unknown,
): void {
  if (value === null || value === undefined) return;
  if (typeof value === "number" && !Number.isFinite(value)) {
    addWarning(warnings, "invalid_numeric_field_ignored", `${field} 값이 유효하지 않아 제외했습니다.`);
  }
}

function sumHoldings(holdings: Holding[] | undefined, warnings: PortfolioTotalsWarning[]): number | null {
  let sum = 0;
  let count = 0;
  for (const holding of holdings ?? []) {
    const value = validMoney(holding.valueKRW);
    if (value === null) {
      warnInvalidField(warnings, "holdings.valueKRW", holding.valueKRW);
      continue;
    }
    sum += value;
    count += 1;
  }
  return count > 0 ? Math.round(sum) : null;
}

function sumFinanceAssets(
  financeAssets: FinanceAsset[] | undefined,
  warnings: PortfolioTotalsWarning[],
): number | null {
  let sum = 0;
  let count = 0;
  for (const asset of financeAssets ?? []) {
    if (asset.isDebt === true) continue;
    const value = validMoney(asset.amountKRW);
    if (value === null) {
      warnInvalidField(warnings, "financeAssets.amountKRW", asset.amountKRW);
      continue;
    }
    sum += value;
    count += 1;
  }
  return count > 0 ? Math.round(sum) : null;
}

function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1000, Math.abs(a) * 0.001);
}

export function reconcilePortfolioTotals(
  snapshot: PortfolioSnapshot | null | undefined,
): PortfolioTotalsReconciliation {
  const warnings: PortfolioTotalsWarning[] = [];
  if (!snapshot) {
    addWarning(warnings, "total_unavailable", "총 금융자산을 계산할 스냅샷이 없습니다.");
    addWarning(warnings, "investment_unavailable", "투자 평가금액을 계산할 보유종목 정보가 없습니다.");
    return {
      totalFinancialAssetKRW: null,
      totalFinancialAssetSource: "unavailable",
      investmentValueKRW: null,
      investmentValueSource: "unavailable",
      investmentPrincipalKRW: null,
      cashAndOtherKRW: null,
      cashAndOtherSource: "unavailable",
      returnAmountKRW: null,
      returnPct: null,
      warnings,
    };
  }

  warnInvalidField(warnings, "snapshot.totalAssetKRW", snapshot.totalAssetKRW);
  warnInvalidField(warnings, "snapshot.investmentValueKRW", snapshot.investmentValueKRW);
  warnInvalidField(warnings, "snapshot.investmentPrincipalKRW", snapshot.investmentPrincipalKRW);

  const holdingsSum = sumHoldings(snapshot.holdings, warnings);
  const financeAssetsSum = sumFinanceAssets(snapshot.financeAssets, warnings);
  const snapshotTotal = validMoney(snapshot.totalAssetKRW);
  const snapshotInvestment = validMoney(snapshot.investmentValueKRW);

  let investmentValueKRW: number | null = null;
  let investmentValueSource: InvestmentValueSource = "unavailable";
  if (snapshotInvestment !== null) {
    investmentValueKRW = Math.round(snapshotInvestment);
    investmentValueSource = "snapshot.investmentValueKRW";
  } else if (holdingsSum !== null) {
    investmentValueKRW = holdingsSum;
    investmentValueSource = "holdings.sum";
  } else {
    addWarning(warnings, "investment_unavailable", "투자 평가금액을 계산할 보유종목 정보가 없습니다.");
  }

  let totalFinancialAssetKRW: number | null = null;
  let totalFinancialAssetSource: TotalFinancialAssetSource = "unavailable";
  if (snapshotTotal !== null) {
    totalFinancialAssetKRW = Math.round(snapshotTotal);
    totalFinancialAssetSource = "snapshot.totalAssetKRW";
  } else if (financeAssetsSum !== null) {
    totalFinancialAssetKRW = financeAssetsSum;
    totalFinancialAssetSource = "financeAssets.sum";
  } else if (investmentValueKRW !== null) {
    totalFinancialAssetKRW = investmentValueKRW;
    totalFinancialAssetSource = "investmentValueKRW";
  } else if (holdingsSum !== null) {
    totalFinancialAssetKRW = holdingsSum;
    totalFinancialAssetSource = "holdings.sum";
  } else {
    addWarning(warnings, "total_unavailable", "총 금융자산을 계산할 자산 정보가 없습니다.");
  }

  if (financeAssetsSum !== null && holdingsSum !== null && !closeEnough(financeAssetsSum, holdingsSum)) {
    addWarning(
      warnings,
      "financeAssets_holdings_mismatch",
      "총 금융자산과 투자 평가금액에 차이가 있어 현금성/기타 자산으로 분리했습니다.",
    );
  }

  let cashAndOtherKRW: number | null = null;
  let cashAndOtherSource: CashAndOtherSource = "unavailable";
  if (totalFinancialAssetKRW !== null && investmentValueKRW !== null) {
    const delta = totalFinancialAssetKRW - investmentValueKRW;
    if (delta < 0) {
      addWarning(warnings, "total_less_than_investment", "총 금융자산이 투자 평가금액보다 작아 차액을 0원으로 표시했습니다.");
      cashAndOtherKRW = 0;
    } else {
      cashAndOtherKRW = Math.round(delta);
    }
    cashAndOtherSource = "total-minus-investment";
  }

  const investmentPrincipalKRW = validMoney(snapshot.investmentPrincipalKRW);
  const returnAmountKRW =
    investmentValueKRW !== null && investmentPrincipalKRW !== null
      ? Math.round(investmentValueKRW - investmentPrincipalKRW)
      : null;
  const returnPct =
    returnAmountKRW !== null && investmentPrincipalKRW !== null && investmentPrincipalKRW > 0
      ? (returnAmountKRW / investmentPrincipalKRW) * 100
      : null;

  return {
    totalFinancialAssetKRW,
    totalFinancialAssetSource,
    investmentValueKRW,
    investmentValueSource,
    investmentPrincipalKRW: investmentPrincipalKRW !== null ? Math.round(investmentPrincipalKRW) : null,
    cashAndOtherKRW,
    cashAndOtherSource,
    returnAmountKRW,
    returnPct,
    warnings,
  };
}
