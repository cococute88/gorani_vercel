import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const calc = readFileSync('lib/dividend-capture-calculator.ts', 'utf8');
const comp = readFileSync('components/calculator/DividendCaptureSimulator.tsx', 'utf8');

for (const snippet of [
  'export function buildDividendCaptureRowsFromStreamlitLogic',
  'export function summarizeDividendCaptureRows',
  'const index = dateToIndex.get(dividend.exDate)',
  'if (index === undefined)',
  'prices.slice(index, index + input.sellWindow + 1)',
  'const isSuccess = maxHigh >= breakevenPrice',
  '? (afterTaxDividend / buyPrice) * 100',
  ': ((sellPrice + afterTaxDividend - buyPrice) / buyPrice) * 100',
  'futureRecovery = isSuccess ? undefined : prices.slice(index).find',
  'rows.filter((row) => row.result === "성공")',
]) assert.ok(calc.includes(snippet), `missing row-parity implementation snippet: ${snippet}`);

assert.ok(comp.includes('[...result.rows]') && comp.includes('.sort((a, b) => a.exDate.localeCompare(b.exDate))'), 'chart rows must be sorted by exDate');
assert.ok(comp.includes('fill="#3b82f6"'), 'success scatter color must be blue');
assert.ok(comp.includes('fill="#93c5fd"'), 'failure scatter color must be sky blue');
assert.ok(comp.includes('font-bold text-slate-900 dark:text-emerald-50'), 'backtest-period text must be readable');

function round(value, digits = 2) { return Number(value.toFixed(digits)); }
function simulate(input, prices, dividends) {
  const byDate = new Map(prices.map((p, i) => [p.date, i]));
  const rows = [];
  for (const d of dividends) {
    const idx = byDate.get(d.date);
    if (idx === undefined) continue;
    if (idx < 1 || idx + input.sellWindow >= prices.length) continue;
    const buy = prices[idx - 1];
    const afterTaxDividend = d.amount * (1 - input.taxRate / 100);
    const breakeven = buy.close - afterTaxDividend;
    const window = prices.slice(idx, idx + input.sellWindow + 1);
    const maxHigh = Math.max(...window.map((p) => p.high));
    const success = maxHigh >= breakeven;
    const sell = window.at(-1);
    const returnPct = success ? (afterTaxDividend / buy.close) * 100 : ((sell.close + afterTaxDividend - buy.close) / buy.close) * 100;
    rows.push({ exDate: d.date, buyDate: buy.date, buyPrice: buy.close, dividendAmount: d.amount, afterTaxDividend, breakeven, sellPrice: sell.close, maxHigh, success, result: success ? '성공' : '실패', profitPct: round(returnPct, 2) });
  }
  const successRows = rows.filter((r) => r.success);
  const failureRows = rows.filter((r) => !r.success);
  return {
    rows,
    successRate: round(successRows.length / rows.length * 100, 1),
    successAverageReturnPct: round(successRows.reduce((s, r) => s + r.profitPct, 0) / successRows.length, 2),
    failureAverageLossPct: round(failureRows.reduce((s, r) => s + r.profitPct, 0) / failureRows.length, 2),
    expectedReturnPct: round(rows.reduce((s, r) => s + r.profitPct, 0) / rows.length, 2),
  };
}

const bcsf = simulate({ taxRate: 15, sellWindow: 0 }, [
  { date: '2020-03-27', open: 11.01, high: 11.29, low: 10.82, close: 11.14 },
  { date: '2020-03-30', open: 9.10, high: 9.45, low: 8.74, close: 9.31 },
  { date: '2020-03-31', open: 9.42, high: 9.90, low: 9.20, close: 9.74 },
], [{ date: '2020-03-30', amount: 0.48 }]);
const row = bcsf.rows[0];
assert.equal(row.buyDate, '2020-03-27');
assert.equal(row.success, false);
assert.ok(Math.abs(row.profitPct - (-12.76)) <= 0.05, `BCSF 2020-03-30 must be near -12.76%, got ${row.profitPct}%`);
assert.ok(Math.abs(row.profitPct - (-30.07)) > 10, 'BCSF 2020-03-30 regressed to old adjusted/mismatched -30.07% result');

const arccPrices = [];
const arccDivs = [];
let price = 20;
for (let i = 0; i < 87; i += 1) {
  const y = 2004 + Math.floor(i / 4);
  const m = ['03', '06', '09', '12'][i % 4];
  const day = i === 0 ? '22' : '15';
  const ex = `${y}-${m}-${day}`;
  const buyClose = price;
  const fail = i % 7 === 0;
  arccPrices.push({ date: `${y}-${m}-${String(Number(day) - 1).padStart(2, '0')}`, open: buyClose, high: buyClose + 0.1, low: buyClose - 0.1, close: buyClose });
  arccPrices.push({ date: ex, open: buyClose - 0.6, high: fail ? buyClose - 0.45 : buyClose - 0.30, low: buyClose - 0.9, close: fail ? buyClose - 0.75 : buyClose - 0.35 });
  arccDivs.push({ date: ex, amount: 0.48 });
  price += 0.01;
}
const arcc = simulate({ taxRate: 15, sellWindow: 0 }, arccPrices, arccDivs);
assert.equal(arcc.rows.length, 87);
assert.ok(arcc.successRate < 100 && arcc.successRate > 80, `ARCC full success rate should be near Streamlit, got ${arcc.successRate}`);
assert.ok(arcc.failureAverageLossPct < 0, 'ARCC failures must keep negative returnPct');
assert.ok(Number.isFinite(Math.abs(arcc.successAverageReturnPct / arcc.failureAverageLossPct)), 'ARCC reward/risk must be finite');

console.log('dividend capture Streamlit row parity checks passed');
