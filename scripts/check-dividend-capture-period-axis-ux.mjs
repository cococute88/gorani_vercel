import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const comp = readFileSync('components/calculator/DividendCaptureSimulator.tsx', 'utf8');
const types = readFileSync('lib/calculator-types.ts', 'utf8');
const calc = readFileSync('lib/dividend-capture-calculator.ts', 'utf8');

assert.ok(comp.includes('label="조회 기간"'), 'UI label must be 조회 기간');
assert.ok(!comp.includes('최근 5년 데이터만 보기'), 'legacy recent-5y boolean label must be removed from UI component');
assert.ok(comp.includes('<option value="all">전체기간</option>'), '전체기간 option must exist');
assert.ok(comp.includes('<option value="recent5y">최근5년</option>'), '최근5년 option must exist');
assert.ok(calc.includes('lookbackPeriod: "all"'), 'default lookback period must be 전체기간/all');
assert.ok(comp.includes('return input.recent5yOnly ? "recent5y" : "all"'), 'legacy boolean fallback must map false to all and true to recent5y');
assert.ok(comp.includes('recent5yOnly: lookbackPeriod === "recent5y"'), 'period state must continue to drive the existing boolean filter');
assert.ok(types.includes('lookbackPeriod?: "all" | "recent5y"'), 'DividendCaptureInput must allow the new period state while preserving older values');
assert.ok(comp.includes('exDateMs: new Date(`${row.exDate}T00:00:00Z`).getTime()'), 'chart rows must include a stable timestamp key');
assert.ok(comp.includes('.sort((a, b) => a.exDate.localeCompare(b.exDate))'), 'chart rows must be sorted by exDate ascending before timestamp mapping');
assert.ok(comp.includes('domain={["dataMin", "dataMax"]}') && comp.includes('ticks={chartTicks}') && comp.includes('ticks[ticks.length - 1] = end'), 'XAxis must use dataMin/dataMax and force an end-date tick');
assert.ok(comp.includes('interval={0}'), 'XAxis must not auto-hide the final provided tick');
assert.ok(comp.includes('tickFormatter={formatChartDate}'), 'XAxis must use the year-month formatter');
assert.ok(comp.includes('slice(2)}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`'), 'tick formatter must emit YY.MM labels');
assert.ok(comp.includes('배당락일: {row.exDate}'), 'tooltip must show the real ex-dividend date');
assert.ok(calc.includes('const index = dateToIndex.get(dividend.exDate)') && calc.includes('const isSuccess = maxHigh >= breakevenPrice'), 'success/failure calculation logic guard is missing');

const fixture = ['2020-06-15', '2024-06-14', '2026-06-16']
  .map((exDate) => ({ exDate, exDateMs: new Date(`${exDate}T00:00:00Z`).getTime() }))
  .sort((a, b) => a.exDate.localeCompare(b.exDate));
const start = fixture[0].exDateMs;
const end = fixture.at(-1).exDateMs;
const ticks = Array.from({ length: 6 }, (_, index) => Math.round(start + ((end - start) * index) / 5));
ticks[0] = start;
ticks[ticks.length - 1] = end;
const latest = new Date(ticks.at(-1)).toISOString().slice(0, 7);
assert.equal(latest, '2026-06', 'generated ticks must include the latest chart month');

console.log('dividend capture period axis UX checks passed:', { min: fixture[0].exDate, max: fixture.at(-1).exDate, latestTickMonth: latest });
