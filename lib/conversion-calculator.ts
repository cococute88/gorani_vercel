import { getTickerHistory } from "@/lib/calculator-data-provider";
import type {
  ConversionInput,
  ConversionPricePoint,
  ConversionResult,
  ConversionRow,
} from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";

type ConversionHistoryInput = {
  sellPrices?: ConversionPricePoint[];
  buyPrices?: ConversionPricePoint[];
};

type ConversionCalculationMeta = {
  source?: QuoteSource;
  warnings?: string[];
  updatedAt?: string;
};

type ConversionRatioPoint = {
  date: string;
  sellClose: number;
  buyClose: number;
  ratio: number;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function isValidClose(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizePrices(points: ConversionPricePoint[], label: string) {
  const byDate = new Map<string, ConversionPricePoint>();

  for (const point of points) {
    if (!point?.date || !isValidDate(point.date) || !isValidClose(point.close)) continue;
    byDate.set(point.date, { date: point.date, close: point.close });
  }

  const prices = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const warnings: string[] = [];
  const dropped = points.length - prices.length;
  if (dropped > 0) warnings.push(`${label}: ${dropped} invalid price point(s) were excluded before conversion calculation.`);

  return { prices, warnings };
}

function buildRatioPoints(sellPrices: ConversionPricePoint[], buyPrices: ConversionPricePoint[]) {
  const buyByDate = new Map(buyPrices.map((point) => [point.date, point.close]));
  const rows: ConversionRatioPoint[] = [];

  for (const sellPoint of sellPrices) {
    const buyClose = buyByDate.get(sellPoint.date);
    if (!isValidClose(buyClose)) continue;
    rows.push({
      date: sellPoint.date,
      sellClose: sellPoint.close,
      buyClose,
      ratio: sellPoint.close / buyClose,
    });
  }

  return rows;
}

function toSignal(deviationPct: number, thresholdPct: number) {
  return deviationPct >= thresholdPct ? "전환 우위" : deviationPct <= -thresholdPct ? "대기" : "중립";
}

function emptyConversionResult(input: ConversionInput, source: QuoteSource, warnings: string[], updatedAt?: string): ConversionResult {
  const currentRatio = input.sellPrice / Math.max(input.buyPrice, 0.01);
  const grossSellAmount = input.sellShares * input.sellPrice;
  const netSellAmount = grossSellAmount * (1 - Math.max(0, input.sellFeeRate) / 100);
  const effectiveBuyPrice = input.buyPrice * (1 + Math.max(0, input.buyFeeRate) / 100);
  const buyableShares = Math.floor(netSellAmount / Math.max(effectiveBuyPrice, 0.01));

  return {
    rows: [],
    source,
    warnings,
    updatedAt,
    usedStartDate: input.startDate,
    usedEndDate: input.endDate,
    sellFirstDate: null,
    buyFirstDate: null,
    currentRatio: round(currentRatio, 4),
    averageRatio: round(currentRatio, 4),
    deviationPct: 0,
    grossSellAmount: round(grossSellAmount),
    netSellAmount: round(netSellAmount),
    buyableShares,
    leftoverCash: round(netSellAmount - buyableShares * effectiveBuyPrice),
    judgment: "공통 거래일 가격 데이터가 부족해 전환 판단을 계산하지 못했습니다.",
    warning: warnings.join(" "),
  };
}

export const defaultConversionInput: ConversionInput = {
  sellTicker: "TQQQ",
  buyTicker: "SCHD",
  sellShares: 40,
  sellPrice: 72.4,
  buyPrice: 78.4,
  startDate: "2023-06-10",
  endDate: "2026-06-10",
  averageMonths: 36,
  thresholdPct: 3,
  sellFeeRate: 0,
  buyFeeRate: 0,
};

export function calculateConversionFromPrices(
  input: ConversionInput,
  history: Required<ConversionHistoryInput>,
  meta: ConversionCalculationMeta = {},
): ConversionResult {
  const warnings = [...(meta.warnings ?? [])];
  const normalizedSell = normalizePrices(history.sellPrices, input.sellTicker || "sell");
  const normalizedBuy = normalizePrices(history.buyPrices, input.buyTicker || "buy");
  warnings.push(...normalizedSell.warnings, ...normalizedBuy.warnings);

  const ratioPoints = buildRatioPoints(normalizedSell.prices, normalizedBuy.prices);
  const source = meta.source ?? "sample";

  if (ratioPoints.length < 2) {
    warnings.push("At least two common trading days are required for conversion ratio calculation.");
    return emptyConversionResult(input, source, warnings, meta.updatedAt);
  }

  const averageStartDate = addMonths(new Date(`${input.endDate}T00:00:00.000Z`), -Math.max(1, input.averageMonths));
  const averageRows = ratioPoints.filter((row) => new Date(`${row.date}T00:00:00.000Z`) >= averageStartDate);
  const rowsForAverage = averageRows.length ? averageRows : ratioPoints;
  const averageRatio = rowsForAverage.reduce((sum, row) => sum + row.ratio, 0) / rowsForAverage.length;
  const latest = ratioPoints.at(-1) ?? ratioPoints[0];
  const currentRatio = latest.ratio;
  const deviationPct = ((currentRatio - averageRatio) / Math.max(averageRatio, 0.01)) * 100;
  const grossSellAmount = input.sellShares * latest.sellClose;
  const netSellAmount = grossSellAmount * (1 - Math.max(0, input.sellFeeRate) / 100);
  const effectiveBuyPrice = latest.buyClose * (1 + Math.max(0, input.buyFeeRate) / 100);
  const buyableShares = Math.floor(netSellAmount / Math.max(effectiveBuyPrice, 0.01));

  const rows: ConversionRow[] = ratioPoints.map((row) => {
    const rowDeviationPct = ((row.ratio - averageRatio) / Math.max(averageRatio, 0.01)) * 100;
    return {
      date: row.date,
      sellPrice: round(row.sellClose, 2),
      buyPrice: round(row.buyClose, 2),
      ratio: round(row.ratio, 4),
      averageRatio: round(averageRatio, 4),
      deviationPct: round(rowDeviationPct, 2),
      signal: toSignal(rowDeviationPct, input.thresholdPct),
    };
  });

  if (source === "sample" && !warnings.some((warning) => warning.toLowerCase().includes("sample"))) {
    warnings.push("Sample fallback is being used for this conversion result.");
  }

  return {
    rows,
    source,
    warnings,
    updatedAt: meta.updatedAt,
    usedStartDate: latest ? ratioPoints[0].date : input.startDate,
    usedEndDate: latest ? latest.date : input.endDate,
    sellFirstDate: normalizedSell.prices[0]?.date ?? null,
    buyFirstDate: normalizedBuy.prices[0]?.date ?? null,
    currentRatio: round(currentRatio, 4),
    averageRatio: round(averageRatio, 4),
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
    warning: warnings.join(" "),
  };
}

export function calculateConversion(
  input: ConversionInput,
  history?: ConversionHistoryInput,
  meta: ConversionCalculationMeta = {},
): ConversionResult {
  const hasExternalPrices = Array.isArray(history?.sellPrices) && Array.isArray(history?.buyPrices);

  if (hasExternalPrices) {
    const normalizedSell = normalizePrices(history.sellPrices ?? [], input.sellTicker || "sell");
    const normalizedBuy = normalizePrices(history.buyPrices ?? [], input.buyTicker || "buy");
    const ratioPoints = buildRatioPoints(normalizedSell.prices, normalizedBuy.prices);

    if (ratioPoints.length >= 2) {
      return calculateConversionFromPrices(
        input,
        { sellPrices: history.sellPrices ?? [], buyPrices: history.buyPrices ?? [] },
        { ...meta, source: meta.source ?? "yahoo" },
      );
    }

    return calculateConversionFromPrices(
      input,
      {
        sellPrices: getTickerHistory(input.sellTicker, input.startDate, input.endDate, input.sellPrice),
        buyPrices: getTickerHistory(input.buyTicker, input.startDate, input.endDate, input.buyPrice),
      },
      {
        ...meta,
        source: "sample",
        warnings: [
          ...(meta.warnings ?? []),
          ...normalizedSell.warnings,
          ...normalizedBuy.warnings,
          "Live price history had fewer than two common trading days; sample fallback was used.",
        ],
      },
    );
  }

  return calculateConversionFromPrices(
    input,
    {
      sellPrices: getTickerHistory(input.sellTicker, input.startDate, input.endDate, input.sellPrice),
      buyPrices: getTickerHistory(input.buyTicker, input.startDate, input.endDate, input.buyPrice),
    },
    {
      ...meta,
      source: "sample",
      warnings: [...(meta.warnings ?? []), "Sample fallback is being used until live quote history is loaded."],
    },
  );
}
