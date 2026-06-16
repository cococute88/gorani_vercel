import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const comp = read('components/calculator/DividendCaptureSimulator.tsx');
const calc = read('lib/dividend-capture-calculator.ts');
const provider = read('lib/calculator-data-provider.ts');
const server = read('lib/server/quote-fetchers.ts');

for (const label of ['전략 승률', '성공 평균수익률', '실패 평균손실률', '손익비', '1회 기대수익률', '1회 절세예상액']) {
  assert.ok(comp.includes(label), `missing Streamlit KPI label: ${label}`);
}

assert.ok(comp.includes('수익률 분포 그래프'), 'chart title restored');
assert.ok(comp.includes('dataKey="exDate"') && comp.includes('name="배당락일"'), 'chart x-axis uses ex-dividend date');

for (const label of ['배당락일', '매수가', '세후배당금', '손익분기점', '성공여부', '수익률(%)', '원금 회복 날짜', '소요 기간(거래일)', '소요 기간(달력)']) {
  assert.ok(comp.includes(label), `missing detail table column: ${label}`);
}
assert.ok(comp.includes('max-h-[520px]') && comp.includes('overflow-auto'), 'detail table keeps internal scroll');
assert.ok(comp.includes('sortRows(result.rows'), 'detail table sorting is preserved');

assert.ok(calc.includes('recent5yOnly ? addDays(end, -365 * 5) : "1900-01-01"'), 'full-history path is not limited to analysisMonths');
assert.ok(comp.includes('range: "max"'), 'full-history UI request uses range=max');
assert.ok(server.includes('max: null'), 'server quote fetcher supports max range');
assert.ok(provider.includes('max: 46_000'), 'client fallback full-history range is long enough');
assert.ok(!calc.includes('}).slice(-16)'), 'calculation must not truncate dividend events to recent rows');
assert.ok(!calc.includes('Live price/dividend data was insufficient; sample fallback was used.'), 'insufficient live data must not silently produce sample backtest rows');

const fixturePrices = [];
const fixtureDividends = [];
let price = 20;
for (let year = 2004; year <= 2026; year += 1) {
  for (let q = 0; q < 4; q += 1) {
    const month = String(q * 3 + 3).padStart(2, '0');
    const day = '15';
    const exDate = `${year}-${month}-${day}`;
    fixturePrices.push({ date: `${year}-${month}-13`, open: price, high: price + 0.2, low: price - 0.2, close: price });
    fixturePrices.push({ date: `${year}-${month}-14`, open: price, high: price + 0.2, low: price - 0.2, close: price });
    fixturePrices.push({ date: exDate, open: price - 0.5, high: price - 0.1, low: price - 0.8, close: price - 0.4 });
    fixtureDividends.push({ date: exDate, amount: 0.48 });
    price += 0.01;
  }
}
assert.ok(fixtureDividends.length >= 80, 'ARCC-like fixture has at least 80 events');
assert.ok(calc.includes('const rows = dividends.flatMap<DividendCaptureRow>'), 'calculator iterates all dividend events');
assert.ok(calc.includes('windowData = prices.slice(index, index + input.sellWindow + 1)'), 'sell window is N trading rows from ex-date');
assert.ok(calc.includes('buyPriceFor(prices, index, input.buyType)'), 'buy price uses D-1/D-2 trading-row basis');
assert.ok(calc.includes('afterTaxDividend = dividend.amount * taxMultiplier'), 'tax rate is applied to dividend amount');
assert.ok(!/sample\/fake|fake result|hardcode ARCC/i.test(comp), 'UI does not add fake/sample results');

console.log('dividend capture Streamlit restore checks passed');
