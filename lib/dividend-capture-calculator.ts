import type { DividendCaptureInput, DividendCaptureResult, DividendCaptureRow } from "@/lib/calculator-types";
import { getTickerDividends } from "@/lib/calculator-data-provider";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const defaultDividendCaptureInput: DividendCaptureInput = {
  ticker: "SCHD",
  investmentAmount: 10_000,
  buyDate: "2026-03-15",
  exDividendDate: "2026-03-20",
  sellBasis: "recovery",
  maxHoldingDays: 20,
  dividendPerShare: 0.824,
  taxRate: 15.4,
  commissionRate: 0.05,
  slippageRate: 0.1,
  analysisMonths: 12,
  buyPrice: 78.4,
  postExLowPrice: 77.35,
  recoveryPrice: 78.25,
};

export function simulateDividendCapture(input: DividendCaptureInput): DividendCaptureResult {
  const shares = Math.max(0, Math.floor(input.investmentAmount / Math.max(input.buyPrice, 0.01)));
  const taxMultiplier = Math.max(0, 1 - input.taxRate / 100);
  const roundTripCost = input.investmentAmount * ((input.commissionRate + input.slippageRate) / 100) * 2;
  const grossDividend = shares * input.dividendPerShare;
  const netDividend = grossDividend * taxMultiplier;
  const breakevenPrice = input.buyPrice - (netDividend - roundTripCost) / Math.max(shares, 1);
  const recoveryGap = input.buyPrice - input.postExLowPrice;

  const start = addDays(input.exDividendDate, -Math.max(30, input.analysisMonths * 31));
  const dividends = getTickerDividends(input.ticker, start, input.exDividendDate, input.dividendPerShare).slice(-6);
  const source = dividends.length > 0 ? dividends : [{ exDate: input.exDividendDate, amount: input.dividendPerShare }];

  const rows: DividendCaptureRow[] = source.map((dividend, index) => {
    const variation = 1 + (index - (source.length - 1) / 2) * 0.012;
    const buyPrice = input.buyPrice * variation;
    const dropRate = recoveryGap / Math.max(input.buyPrice, 0.01);
    const exLowPrice = buyPrice * (1 - dropRate * (0.9 + (index % 3) * 0.08));
    const recoveryStrength = input.recoveryPrice / Math.max(input.buyPrice, 0.01) + (index % 4 - 1.5) * 0.003;
    const sellPrice = input.sellBasis === "recovery" ? Math.max(exLowPrice, buyPrice * recoveryStrength) : input.recoveryPrice * variation;
    const rowShares = Math.max(0, Math.floor(input.investmentAmount / Math.max(buyPrice, 0.01)));
    const rowGrossDividend = rowShares * dividend.amount;
    const rowNetDividend = rowGrossDividend * taxMultiplier;
    const rowCost = rowShares * buyPrice * ((input.commissionRate + input.slippageRate) / 100) * 2;
    const pricePnL = (sellPrice - buyPrice) * rowShares;
    const totalPnL = pricePnL + rowNetDividend - rowCost;
    const recoveryDays = Math.min(input.maxHoldingDays + (index % 3), Math.max(1, Math.ceil((buyPrice - exLowPrice) / Math.max(sellPrice - exLowPrice, 0.01))));
    const rowBreakeven = buyPrice - (rowNetDividend - rowCost) / Math.max(rowShares, 1);
    const result = totalPnL >= 0 && recoveryDays <= input.maxHoldingDays ? "성공" : "실패";
    return {
      round: `${dividend.exDate.slice(2, 4)}.${dividend.exDate.slice(5, 7)}`,
      exDate: dividend.exDate,
      buyPrice: round(buyPrice),
      exLowPrice: round(exLowPrice),
      sellPrice: round(sellPrice),
      shares: rowShares,
      grossDividend: round(rowGrossDividend),
      netDividend: round(rowNetDividend),
      pricePnL: round(pricePnL),
      totalPnL: round(totalPnL),
      profitPct: round((totalPnL / Math.max(rowShares * buyPrice, 1)) * 100, 2),
      recoveryDays,
      breakevenPrice: round(rowBreakeven),
      result,
      note: result === "성공" ? "세후 배당과 회복 가격이 비용을 상쇄" : "회복 지연 또는 비용 반영 후 손실",
    };
  });

  const successRows = rows.filter((row) => row.result === "성공");
  return {
    rows,
    successRate: rows.length ? round((successRows.length / rows.length) * 100, 1) : 0,
    totalNetProfit: round(rows.reduce((sum, row) => sum + row.totalPnL, 0)),
    averageProfitPct: rows.length ? round(rows.reduce((sum, row) => sum + row.profitPct, 0) / rows.length, 2) : 0,
    averageRecoveryDays: rows.length ? round(rows.reduce((sum, row) => sum + row.recoveryDays, 0) / rows.length, 1) : 0,
    breakevenPrice: round(breakevenPrice),
    shares,
    netDividend: round(netDividend),
    expectedDrop: round(recoveryGap),
    warning: "현재는 입력값/샘플 데이터 기준 계산입니다. 실시간 시세 연결은 이후 단계에서 확장합니다.",
  };
}
