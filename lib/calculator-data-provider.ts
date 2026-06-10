import type { DividendPoint, PricePoint } from "@/lib/calculator-types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stableSeed(text: string) {
  return text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getTickerHistory(ticker: string, start: string, end: string, basePrice?: number): PricePoint[] {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return [];

  const seed = stableSeed(ticker.toUpperCase());
  const points: PricePoint[] = [];
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));
  const step = totalDays > 420 ? 7 : totalDays > 160 ? 3 : 1;
  const anchor = basePrice && basePrice > 0 ? basePrice : 60 + (seed % 90);

  for (let day = 0; day <= totalDays; day += step) {
    const progress = day / totalDays;
    const cycle = Math.sin(progress * Math.PI * 4 + seed / 17) * 0.09;
    const shorterCycle = Math.sin(progress * Math.PI * 13 + seed / 9) * 0.035;
    const trend = (progress - 0.45) * (((seed % 19) - 7) / 100);
    const shock = Math.sin(progress * Math.PI * 2 + 1.2) < -0.92 ? -0.08 : 0;
    const close = anchor * (1 + cycle + shorterCycle + trend + shock);
    points.push({ date: formatDate(addDays(startDate, day)), close: Number(Math.max(1, close).toFixed(2)) });
  }

  const finalDate = formatDate(endDate);
  if (points.at(-1)?.date !== finalDate) {
    const previous = points.at(-1)?.close ?? anchor;
    points.push({ date: finalDate, close: Number(previous.toFixed(2)) });
  }
  return points;
}

export function getTickerDividends(ticker: string, start: string, end: string, amount = 0.8): DividendPoint[] {
  const seed = stableSeed(ticker.toUpperCase());
  const startDate = new Date(start);
  const endDate = new Date(end);
  const rows: DividendPoint[] = [];
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return rows;

  const current = new Date(startDate);
  current.setDate(15 + (seed % 10));
  while (current <= endDate) {
    rows.push({ exDate: formatDate(current), amount: Number((amount * (0.94 + (seed % 9) / 100)).toFixed(3)) });
    current.setMonth(current.getMonth() + 3);
  }
  return rows;
}

export function getLatestPrice(ticker: string, fallback = 100) {
  return Number(clamp(fallback + (stableSeed(ticker) % 11) - 5, 1, 10_000).toFixed(2));
}
