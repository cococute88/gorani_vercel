#!/usr/bin/env node
import assert from 'node:assert/strict';

function norm(ts, tz) { const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ts * 1000)); const g = (t) => parts.find((p) => p.type === t)?.value; return `${g('year')}-${g('month')}-${g('day')}`; }
function round(v, d = 2) { return Number(v.toFixed(d)); }
async function adapter(ticker, recent5yOnly = false) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=div,splits&includeAdjustedClose=false`;
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 dividend-capture-yfinance-parity' } });
  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
  const payload = await response.json();
  const r = payload.chart?.result?.[0];
  if (!r) throw new Error('Yahoo chart returned no result');
  const tz = r.meta?.exchangeTimezoneName || 'America/New_York';
  const cutoff = recent5yOnly ? norm(Math.floor(Date.now() / 1000) - 365 * 5 * 86400, tz) : null;
  const q = r.indicators.quote[0];
  const prices = r.timestamp.flatMap((ts, i) => { const close = q.close[i]; const date = norm(ts, tz); if (!(close > 0) || (cutoff && date < cutoff)) return []; return [{ date, open: q.open[i], high: q.high[i], low: q.low[i], close }]; }).sort((a,b)=>a.date.localeCompare(b.date));
  const dates = new Set(prices.map(p => p.date));
  const dividends = Object.values(r.events?.dividends ?? {}).flatMap((e) => { const date = norm(e.date, tz); return e.amount > 0 && (!cutoff || date >= cutoff) ? [{ date, amount: e.amount }] : []; }).sort((a,b)=>a.date.localeCompare(b.date));
  const skipped = dividends.filter(d => !dates.has(d.date));
  return { prices, dividends, exchangeTimezoneName: tz, diagnostics: { dividendEventsLength: dividends.length, priceRowsLength: prices.length, matchedEvents: dividends.length - skipped.length, skippedEvents: skipped.length, skippedExDatesFirst10: skipped.slice(0,10).map(d=>d.date), priceDateSampleFirst10: prices.slice(0,10).map(p=>p.date), priceDateSampleLast10: prices.slice(-10).map(p=>p.date), mixedSources: false } };
}
function simulate(prices, dividends) {
  const byDate = new Map(prices.map((p, i) => [p.date, i])); const rows = [];
  for (const d of dividends) { const idx = byDate.get(d.date); if (idx === undefined || idx < 1) continue; const buy = prices[idx - 1]; const ex = prices[idx]; const after = d.amount * 0.85; const breakeven = buy.close - after; const success = ex.high >= breakeven; const returnPct = success ? after / buy.close * 100 : (ex.close + after - buy.close) / buy.close * 100; rows.push({ exDate: d.date, buyDate: buy.date, buyPrice: round(buy.close, 2), exClose: round(ex.close, 2), exHigh: round(ex.high, 2), dividendAmount: round(d.amount, 6), returnPct: round(returnPct, 2), result: success ? '성공' : '실패' }); }
  const success = rows.filter(r=>r.result==='성공'), fail = rows.filter(r=>r.result==='실패');
  return { rows, successRate: round(success.length / rows.length * 100, 1), successAverageReturnPct: round(success.reduce((s,r)=>s+r.returnPct,0)/success.length,2), failureAverageLossPct: round(fail.reduce((s,r)=>s+r.returnPct,0)/fail.length,2), rewardRiskRatio: round(Math.abs((success.reduce((s,r)=>s+r.returnPct,0)/success.length)/(fail.reduce((s,r)=>s+r.returnPct,0)/fail.length)),2), expectedReturnPct: round(rows.reduce((s,r)=>s+r.returnPct,0)/rows.length,2) };
}
try {
  const arccData = await adapter('ARCC', false); const arcc = simulate(arccData.prices, arccData.dividends);
  console.log('ARCC live run:', JSON.stringify({ ...arccData.diagnostics, result: { rows: arcc.rows.length, successRate: arcc.successRate, successAverageReturnPct: arcc.successAverageReturnPct, failureAverageLossPct: arcc.failureAverageLossPct, rewardRiskRatio: arcc.rewardRiskRatio, expectedReturnPct: arcc.expectedReturnPct } }, null, 2));
  assert.ok(arcc.rows.length >= 80 && arcc.rows.length <= 95); assert.ok(arcc.successRate >= 80 && arcc.successRate <= 90); assert.notEqual(arcc.successRate, 100); assert.ok(arcc.successAverageReturnPct >= 1.5 && arcc.successAverageReturnPct <= 3.0); assert.ok(arcc.failureAverageLossPct < 0); assert.ok(Number.isFinite(arcc.rewardRiskRatio)); assert.ok(arcc.expectedReturnPct > 0); assert.ok(arccData.diagnostics.skippedEvents < 50);
  const bcsfData = await adapter('BCSF', false); const bcsf = simulate(bcsfData.prices, bcsfData.dividends); const row = bcsf.rows.find(r => r.exDate === '2020-03-30');
  console.log('BCSF 2020-03-30 live row:', JSON.stringify(row, null, 2)); assert.ok(row); assert.ok(Math.abs(row.returnPct - (-12.76)) <= 3); assert.ok(row.returnPct > -20);
  console.log('dividend capture live Yahoo parity checks passed');
} catch (error) { console.error('live parity not verified:', error.message); process.exit(1); }
