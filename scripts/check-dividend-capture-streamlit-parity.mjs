import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const calc = readFileSync('lib/dividend-capture-calculator.ts', 'utf8');
const comp = readFileSync('components/calculator/DividendCaptureSimulator.tsx', 'utf8');

for (const snippet of [
  'const isSuccess = maxHigh >= breakevenPrice',
  'windowData = prices.slice(index, index + input.sellWindow + 1)',
  '? (afterTaxDividend / buyPrice) * 100',
  ': ((sellPrice + afterTaxDividend - buyPrice) / buyPrice) * 100',
  'failureRows.reduce((sum, row) => sum + row.profitPct, 0) / failureRows.length',
  'Math.abs(successAverageReturnPct / failureAverageLossPct)',
  'rows.reduce((sum, row) => sum + row.profitPct, 0) / rows.length',
  '(successAverageReturnPct / 100) * input.investmentAmount * 0.22',
]) assert.ok(calc.includes(snippet), `missing Streamlit parity formula: ${snippet}`);

assert.ok(comp.includes('fill="#3b82f6"'), 'success scatter/legend color must be blue, not black');
assert.ok(comp.includes('fill="#93c5fd"'), 'failure scatter/legend color must be sky blue, not black');
assert.ok(!/fill="#000|fill="black|#000000/.test(comp), 'dividend capture chart must not use black markers');
assert.ok(!/sample\/fake|fake result|hardcode ARCC/i.test(comp + calc), 'must not hardcode ARCC or use fake results');

function round(value, digits = 2) { return Number(value.toFixed(digits)); }
function simulateFixture(recent5yOnly = false) {
  const rows = [];
  const start = recent5yOnly ? '2021-06-16' : '1900-01-01';
  let index = 0;
  for (let y = 2004; y <= 2026; y += 1) {
    for (const mm of ['03', '06', '09', '12']) {
      const exDate = `${y}-${mm}-15`;
      if (exDate < start) { index += 1; continue; }
      const buyPrice = 20 + index * 0.01;
      const afterTaxDividend = 0.48 * 0.85;
      const breakevenPrice = buyPrice - afterTaxDividend;
      const fail = index % 7 === 0;
      const high = fail ? breakevenPrice - 0.1 : breakevenPrice + 0.1;
      const close = fail ? buyPrice - 0.75 : buyPrice - 0.2;
      const profitPct = fail ? ((close + afterTaxDividend - buyPrice) / buyPrice) * 100 : (afterTaxDividend / buyPrice) * 100;
      rows.push({ exDate, result: high >= breakevenPrice ? '성공' : '실패', profitPct: round(profitPct, 2) });
      index += 1;
    }
  }
  const success = rows.filter((r) => r.result === '성공');
  const failure = rows.filter((r) => r.result === '실패');
  const successRate = round(success.length / rows.length * 100, 1);
  const failureAverageLossPct = round(failure.reduce((s, r) => s + r.profitPct, 0) / failure.length, 2);
  const rewardRiskRatio = round(Math.abs((success.reduce((s, r) => s + r.profitPct, 0) / success.length) / failureAverageLossPct), 2);
  return { rows, successRate, failureAverageLossPct, rewardRiskRatio };
}

for (const result of [simulateFixture(false), simulateFixture(true)]) {
  assert.ok(result.rows.some((r) => r.result === '실패'), 'fixture must contain failure cases');
  assert.notEqual(result.successRate, 100, 'success rate regression: must not be 100%');
  assert.ok(result.failureAverageLossPct < 0, 'failure average loss must be negative');
  assert.notEqual(result.failureAverageLossPct, 0, 'failure average loss must not be 0');
  assert.ok(Number.isFinite(result.rewardRiskRatio), 'reward/risk must be finite when failures exist');
  assert.ok(result.rows.some((r) => r.result === '실패' && r.profitPct < 0), 'failed rows must plot negative returns');
}

console.log('dividend capture Streamlit parity checks passed');
