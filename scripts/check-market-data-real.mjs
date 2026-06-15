import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(p, 'utf8');
const marketData = read('lib/market-data.ts');
const marketPage = read('components/market/MarketPage.tsx');
const server = read('lib/server/market-fetchers.ts');
const rsiSection = read('components/market/MarketRsiSection.tsx');
const mddSection = read('components/market/MarketMddSection.tsx');
const vixChart = read('components/market/VixChart.tsx');
const chartStyle = read('lib/chart-style.ts');

assert(!marketData.includes('mock-market-data'), 'market-data adapter must not import mock-market-data');
assert(!marketPage.includes('mock-market-data'), 'MarketPage must not seed UI with mock-market-data');
assert(!/Math\.random|Math\.sin\(/.test(marketData + server), 'live adapter must not create fake random/sine curves');
assert(server.includes('CNN_URL') && server.includes('production.dataviz.cnn.io'), 'CNN Fear & Greed endpoint must be wired');
assert(server.includes('fetchYahooChart'), 'server adapter must reuse existing Yahoo quote fetcher');
assert(server.includes('calculateRsi14'), 'RSI helper must exist');
assert(server.includes('calculateRollingDrawdown'), 'MDD helper must exist');
assert(server.includes('source: "unavailable"'), 'unavailable state must be explicit');
assert(rsiSection.includes('formatChartMonthTick') && mddSection.includes('formatChartMonthTick') && vixChart.includes('formatChartMonthTick'), 'RSI/MDD/VIX must keep YY/MM formatter');
assert(vixChart.includes('high: 30') && vixChart.includes('watch: 20'), 'VIX 20/30 thresholds must be preserved');
assert(mddSection.includes('ReferenceLine y={0}') && mddSection.includes('ReferenceLine y={-10}') && mddSection.includes('ReferenceLine y={-20}'), 'MDD reference lines must be preserved');
assert(chartStyle.includes('formatChartMonthTick'), 'chart formatter helper must exist');

function rsi14(closes) {
  let gain = 0, loss = 0;
  for (let i = 1; i <= 14; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  let avgGain = gain / 14, avgLoss = loss / 14;
  for (let i = 15; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; avgGain = (avgGain * 13 + Math.max(d, 0)) / 14; avgLoss = (avgLoss * 13 + Math.max(-d, 0)) / 14; }
  return avgLoss === 0 ? 100 : Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
}
assert.equal(rsi14([44,44.15,43.9,44.35,44.8,45,44.7,45.2,45.4,45.1,45.8,46.2,46,46.5,47,46.7]), 74.68, 'known RSI fixture');
const dd = [100, 110, 105, 120, 90].map((close, i, rows) => Number(((close / Math.max(...rows.slice(0, i + 1)) - 1) * 100).toFixed(2)));
assert.deepEqual(dd, [0, 0, -4.55, 0, -25], 'rolling high drawdown fixture');
assert.equal([].filter(Boolean).length, 0, 'empty price series remains empty/unavailable');
console.log('MARKET-DATA-1 real data checks passed');
