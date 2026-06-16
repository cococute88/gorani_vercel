import assert from 'node:assert/strict';
import fs from 'node:fs';

const account = fs.readFileSync('components/dividend/DividendAccountPerformanceSection.tsx', 'utf8');
const total = fs.readFileSync('components/dividend/DividendPerformanceSection.tsx', 'utf8');
const ledger = fs.readFileSync('lib/dividend-ledger-performance.ts', 'utf8');

assert.match(account, /const SP500_TICKER = "SPY"/);
assert.match(account, /const KOSPI_TICKER = "\^KS11"/);
assert.match(account, /startPrincipalKRW: base\.points\[0\]\?\.depositKRW/);
assert.match(ledger, /startPrincipalKRW\?: number/);
assert.match(ledger, /return lastValue > 0 \? lastValue : null/);
assert.doesNotMatch(ledger, /values\.some\(\(value\) => value != null\)/);
assert.match(account, /unavailable \? "비교 불가" : won\(value\)/);
assert.doesNotMatch(account, /sp500\?\.latestValue \?\? 0|kospi\?\.latestValue \?\? 0|latestValue: series\.latestValue \?\? 0/);
assert.doesNotMatch(total, /kospiValueKRW \?\? 0|sp500ValueKRW \?\? 0/);
assert.doesNotMatch(account, /Math\.max\(0, min - range \* 0\.08\)/);
assert.doesNotMatch(total, /Math\.max\(0, min - range \* 0\.08\)/);
assert.match(account, /tickFormatter=\{manFmt\} label=\{\{ value: "월별 손익\(만원\)"/);
assert.match(total, /tickFormatter=\{manFmt\} label=\{\{ value: "월별 손익\(만원\)"/);
assert.match(account, /<Bar yAxisId="profit" dataKey="monthlyProfit"/);
assert.match(account, /<Line\s+yAxisId="asset"[\s\S]*dataKey="totalAssets"/);
assert.match(total, /<Bar yAxisId="profit" dataKey="monthlyProfit"/);
assert.match(total, /<Line yAxisId="asset"[\s\S]*dataKey="totalAssets"/);
assert.match(account, /date: `\$\{month\}월`, deposit: null/);
assert.match(total, /deposit: null, portfolio: null, kospi: null, sp500: null, monthlyProfit: null/);
console.log('dividends performance benchmark/axis checks passed');
