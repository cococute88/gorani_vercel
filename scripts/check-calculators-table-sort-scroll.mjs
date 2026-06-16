import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const files = {
  dividend: read('components/calculator/DividendCaptureSimulator.tsx'),
  conversion: read('components/calculator/ConversionCalculator.tsx'),
  mdd: read('components/calculator/MddCalculator.tsx'),
  helper: read('lib/calculator-table-sort.ts'),
  pkg: read('package.json'),
};

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

assert(!files.dividend.includes('dataKey="recoveryDays" name="회복일" unit="일"'), 'dividend distribution chart no longer uses recoveryDays with day unit on x-axis');
assert(files.dividend.includes('dataKey="exDate"') && files.dividend.includes('name="배당락일"'), 'dividend distribution chart uses ex-date x values');
assert(files.dividend.includes('name="성공"') && files.dividend.includes('name="실패"') && files.dividend.includes('<Legend'), 'dividend distribution chart has success/failure legend');
assert(files.dividend.includes('function DividendTooltip') && files.dividend.includes('원금 회복'), 'dividend distribution tooltip shows ex-date/profit/result/recovery details');

assert(files.dividend.includes('setDetailSort') && files.dividend.includes('sortArrow(detailSort'), 'dividend detail table has sortable headers and arrows');
assert(files.conversion.includes('setDetailSort') && files.conversion.includes('sortArrow(detailSort'), 'conversion ratio table has sortable headers and arrows');
assert(files.mdd.includes('setPriceSort') && files.mdd.includes('sortArrow(priceSort'), 'MDD recent price table has sortable headers and arrows');
assert(files.mdd.includes('setSegmentSort') && files.mdd.includes('sortArrow(segmentSort'), 'MDD drawdown segment table has sortable headers and arrows');

for (const [name, source] of Object.entries({ dividend: files.dividend, conversion: files.conversion, mdd: files.mdd })) {
  assert(source.includes('max-h-[520px]') && source.includes('overflow-auto') && source.includes('sticky top-0'), `${name} tables use internal scroll with sticky headers`);
}

assert(files.helper.includes('export function sortRows') && files.helper.includes('SortColumnType = "number" | "date" | "string"'), 'numeric/date/string sort helper exists');
assert(files.helper.includes('if (aEmpty) return 1') && files.helper.includes('if (bEmpty) return -1'), 'sort helper sends null/placeholder values to bottom');
assert(files.pkg.includes('check:calculators-table-sort-scroll'), 'package script is registered');

if (process.exitCode) process.exit(process.exitCode);
