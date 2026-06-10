import type { DividendCaptureInput, DividendCaptureResult, DividendCaptureRow, OhlcPoint } from "@/lib/calculator-types";
import { getTickerDividends, getTickerOhlcHistory } from "@/lib/calculator-data-provider";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
}

function buyPriceFor(history: OhlcPoint[], index: number, buyType: DividendCaptureInput["buyType"]) {
  const offset = buyType.startsWith("D-2") ? 2 : 1;
  const source = history[Math.max(0, index - offset)];
  return buyType.endsWith("시가") ? source.open : source.close;
}

export const defaultDividendCaptureInput: DividendCaptureInput = {
  ticker: "ARCC",
  investmentAmount: 10_000,
  buyType: "D-1 종가",
  sellWindow: 0,
  taxRate: 15,
  recent5yOnly: false,
  dividendPerShare: 0.48,
  commissionRate: 0,
  slippageRate: 0,
  analysisMonths: 36,
  referenceBuyPrice: 20.5,
  referenceExOpenPrice: 20.05,
};

export function simulateDividendCapture(input: DividendCaptureInput): DividendCaptureResult {
  const end = "2026-06-10";
  const requestedStart = addDays(end, -Math.max(3, input.analysisMonths) * 31);
  const start = input.recent5yOnly ? addDays(end, -365 * 5) : requestedStart;
  const history = getTickerOhlcHistory(input.ticker, start, end, input.referenceBuyPrice);
  const rawDividends = getTickerDividends(input.ticker, start, end, input.dividendPerShare);
  const dividends = rawDividends.length > 0 ? rawDividends : [{ exDate: addDays(end, -90), amount: input.dividendPerShare }];
  const dateToIndex = new Map(history.map((point, index) => [point.date, index]));
  const taxMultiplier = Math.max(0, 1 - input.taxRate / 100);
  const totalCostRate = Math.max(0, input.commissionRate + input.slippageRate) / 100;

  const rows = dividends.flatMap<DividendCaptureRow>((dividend) => {
    let index = dateToIndex.get(dividend.exDate);
    if (index === undefined) {
      index = history.findIndex((point) => point.date >= dividend.exDate);
    }
    if (index < 2 || index < 0 || index + input.sellWindow >= history.length) return [];

    const buyPrice = buyPriceFor(history, index, input.buyType);
    const shares = Math.max(0, Math.floor(input.investmentAmount / Math.max(buyPrice, 0.01)));
    const afterTaxDividend = dividend.amount * taxMultiplier;
    const roundTripCostPerShare = buyPrice * totalCostRate * 2;
    const breakevenPrice = buyPrice - afterTaxDividend + roundTripCostPerShare;
    const windowData = history.slice(index, index + input.sellWindow + 1);
    const maxHigh = Math.max(...windowData.map((point) => point.high));
    const isSuccess = maxHigh >= breakevenPrice;
    const sellPrice = isSuccess ? breakevenPrice : windowData.at(-1)?.close ?? history[index].close;
    const futureRecovery = history.slice(index).find((point) => point.high >= breakevenPrice);
    const recoveryDate = isSuccess ? windowData.find((point) => point.high >= breakevenPrice)?.date : futureRecovery?.date;
    const grossDividend = shares * dividend.amount;
    const netDividend = shares * afterTaxDividend;
    const costs = shares * buyPrice * totalCostRate * 2;
    const pricePnL = (sellPrice - buyPrice) * shares;
    const totalPnL = pricePnL + netDividend - costs;
    const recoveryTradingDays = recoveryDate ? Math.max(0, history.findIndex((point) => point.date === recoveryDate) - index) : null;

    return [{
      round: `${dividend.exDate.slice(2, 4)}.${dividend.exDate.slice(5, 7)}`,
      exDate: dividend.exDate,
      buyPrice: round(buyPrice),
      afterTaxDividend: round(afterTaxDividend, 4),
      breakevenPrice: round(breakevenPrice, 4),
      maxHigh: round(maxHigh),
      sellPrice: round(sellPrice),
      shares,
      grossDividend: round(grossDividend),
      netDividend: round(netDividend),
      pricePnL: round(pricePnL),
      totalPnL: round(totalPnL),
      profitPct: round((totalPnL / Math.max(shares * buyPrice, 1)) * 100, 2),
      result: isSuccess ? "성공" : "실패",
      recoveryDate: recoveryDate ?? "회복불가",
      recoveryDays: recoveryTradingDays ?? 0,
      recoveryTradingDays: recoveryTradingDays === null ? "회복불가" : `${recoveryTradingDays}거래일`,
      recoveryCalendarDays: recoveryDate ? `${daysBetween(dividend.exDate, recoveryDate)}일` : "회복불가",
      note: isSuccess ? "매도허용기간 안에 손익분기점을 회복" : "허용기간 내 손익분기점 미회복",
    }];
  }).slice(-16);

  const successRows = rows.filter((row) => row.result === "성공");
  const numericRecoveryDays = rows.map((row) => Number.parseFloat(row.recoveryTradingDays)).filter(Number.isFinite);
  const firstBuyPrice = rows.at(-1)?.buyPrice ?? input.referenceBuyPrice;
  const firstShares = Math.max(0, Math.floor(input.investmentAmount / Math.max(firstBuyPrice, 0.01)));
  const netDividend = firstShares * input.dividendPerShare * taxMultiplier;

  return {
    rows,
    successRate: rows.length ? round((successRows.length / rows.length) * 100, 1) : 0,
    totalNetProfit: round(rows.reduce((sum, row) => sum + row.totalPnL, 0)),
    averageProfitPct: rows.length ? round(rows.reduce((sum, row) => sum + row.profitPct, 0) / rows.length, 2) : 0,
    averageRecoveryDays: numericRecoveryDays.length ? round(numericRecoveryDays.reduce((sum, day) => sum + day, 0) / numericRecoveryDays.length, 1) : 0,
    breakevenPrice: round(firstBuyPrice - input.dividendPerShare * taxMultiplier + firstBuyPrice * totalCostRate * 2, 4),
    shares: firstShares,
    netDividend: round(netDividend),
    expectedDrop: round(Math.max(0, input.referenceBuyPrice - input.referenceExOpenPrice)),
    warning: "현재는 입력값/샘플 데이터 기준 계산입니다. 실시간 시세 연결은 이후 단계에서 확장합니다.",
  };
}
