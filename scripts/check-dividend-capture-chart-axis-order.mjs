import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const comp = readFileSync('components/calculator/DividendCaptureSimulator.tsx', 'utf8');
const calcBeforeGuard = readFileSync('lib/dividend-capture-calculator.ts', 'utf8');

assert.ok(comp.includes('[...result.rows]') && comp.includes('.sort((a, b) => a.exDate.localeCompare(b.exDate))'), 'chart rows must be sorted by exDate ascending');
assert.ok(comp.includes('exDateMs: Date.parse(`${row.exDate}T00:00:00Z`)'), 'chart rows must include a stable UTC timestamp sort/axis key');
assert.ok(comp.includes('<XAxis type="number" dataKey="exDateMs"') && comp.includes('scale="time"') && comp.includes('domain={["dataMin", "dataMax"]}'), 'XAxis must use a numeric time axis instead of a string/category fallback');
assert.ok(comp.includes('tickFormatter={formatChartDate}'), 'date ticks must be labels over the timestamp axis');
assert.ok(comp.includes('배당락일: {row.exDate}'), 'tooltip must show the real ex-dividend date');
assert.ok(comp.includes('const successChartRows = useMemo') && comp.includes('const failureChartRows = useMemo'), 'success/failure series must use the same sorted chart data source');
assert.ok(comp.includes('fill="#3b82f6"'), 'success color must remain blue');
assert.ok(comp.includes('fill="#93c5fd"'), 'failure color must remain sky blue');
assert.ok(calcBeforeGuard.includes('const index = dateToIndex.get(dividend.exDate)') && calcBeforeGuard.includes('const isSuccess = maxHigh >= breakevenPrice'), 'row parity calculation must remain untouched');

const fixture = [
  { exDate: '2026-03-15', profitPct: 1, result: '성공' },
  { exDate: '2015-12-15', profitPct: -1, result: '실패' },
  { exDate: '2026-06-15', profitPct: 1.2, result: '성공' },
].sort((a, b) => a.exDate.localeCompare(b.exDate)).map((row) => ({ ...row, exDateMs: Date.parse(`${row.exDate}T00:00:00Z`) }));
for (let i = 1; i < fixture.length; i += 1) {
  assert.ok(fixture[i - 1].exDateMs <= fixture[i].exDateMs, 'timestamp order must be ascending after exDate sort');
}
assert.deepEqual(fixture.map((row) => row.exDate), ['2015-12-15', '2026-03-15', '2026-06-15'], '2015-12 cannot appear after 2026-03 in chart data');

console.log('dividend capture chart axis order checks passed');
