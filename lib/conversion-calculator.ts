import { getTickerHistory } from "@/lib/calculator-data-provider";
import type { ConversionInput, ConversionResult, ConversionRow } from "@/lib/calculator-types";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export const defaultConversionInput: ConversionInput = {
  sellTicker: "QLD",
  buyTicker: "SCHD",
  sellShares: 40,
  sellPrice: 105.4,
  buyPrice: 78.4,
  periodMonths: 12,
  averageMonths: 6,
  thresholdPct: 3,
  sellFeeRate: 0.05,
  buyFeeRate: 0.05,
};

export function calculateConversion(input: ConversionInput): ConversionResult {
  const end = new Date("2026-06-10");
  const start = addMonths(end, -Math.max(1, input.periodMonths));
  const sellHistory = getTickerHistory(input.sellTicker, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), input.sellPrice);
  const buyHistory = getTickerHistory(input.buyTicker, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), input.buyPrice);
  const byDate = new Map(buyHistory.map((point) => [point.date, point.close]));
  const rawRows = sellHistory
    .map((sellPoint) => ({ date: sellPoint.date, sellPrice: sellPoint.close, buyPrice: byDate.get(sellPoint.date) ?? input.buyPrice }))
    .filter((row) => row.buyPrice > 0);

  const sampled = rawRows.filter((_, index) => index % Math.max(1, Math.floor(rawRows.length / 14)) === 0).slice(-14);
  const currentRatio = input.sellPrice / Math.max(input.buyPrice, 0.01);
  const ratiosForAverage = sampled.slice(-Math.max(1, input.averageMonths)).map((row) => row.sellPrice / row.buyPrice);
  const averageRatio = ratiosForAverage.length ? ratiosForAverage.reduce((sum, ratio) => sum + ratio, 0) / ratiosForAverage.length : currentRatio;

  const rows: ConversionRow[] = sampled.map((row) => {
    const ratio = row.sellPrice / Math.max(row.buyPrice, 0.01);
    const deviationPct = ((ratio - averageRatio) / Math.max(averageRatio, 0.01)) * 100;
    return {
      ...row,
      ratio: round(ratio, 3),
      averageRatio: round(averageRatio, 3),
      deviationPct: round(deviationPct, 2),
      signal: deviationPct >= input.thresholdPct ? "전환 우위" : deviationPct <= -input.thresholdPct ? "대기" : "중립",
    };
  });

  const deviationPct = ((currentRatio - averageRatio) / Math.max(averageRatio, 0.01)) * 100;
  const grossSellAmount = input.sellShares * input.sellPrice;
  const netSellAmount = grossSellAmount * (1 - input.sellFeeRate / 100);
  const effectiveBuyPrice = input.buyPrice * (1 + input.buyFeeRate / 100);
  const buyableShares = Math.floor(netSellAmount / Math.max(effectiveBuyPrice, 0.01));

  return {
    rows: [
      ...rows,
      {
        date: "현재 입력값",
        sellPrice: input.sellPrice,
        buyPrice: input.buyPrice,
        ratio: round(currentRatio, 3),
        averageRatio: round(averageRatio, 3),
        deviationPct: round(deviationPct, 2),
        signal: deviationPct >= input.thresholdPct ? "전환 우위" : deviationPct <= -input.thresholdPct ? "대기" : "중립",
      },
    ],
    currentRatio: round(currentRatio, 3),
    averageRatio: round(averageRatio, 3),
    deviationPct: round(deviationPct, 2),
    grossSellAmount: round(grossSellAmount),
    netSellAmount: round(netSellAmount),
    buyableShares,
    leftoverCash: round(netSellAmount - buyableShares * effectiveBuyPrice),
    judgment:
      deviationPct >= input.thresholdPct
        ? "현재 전환비가 평균보다 높아 매도 후 매수 수량 확보에 유리합니다."
        : deviationPct <= -input.thresholdPct
          ? "현재 전환비가 평균보다 낮아 전환을 보류하고 관찰하는 구간입니다."
          : "현재 전환비가 평균권에 있어 수수료와 세금을 함께 확인해야 합니다.",
    warning: "현재는 입력값/샘플 데이터 기준 계산입니다. 실시간 시세 연결은 이후 단계에서 확장합니다.",
  };
}
