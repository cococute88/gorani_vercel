import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);

assert.ok(exists("lib/csv-download.ts"), "lib/csv-download.ts exists");
const util = read("lib/csv-download.ts");
assert.match(util, /\\uFEFF/, "CSV includes UTF-8 BOM");
assert.match(util, /replace\(\/"\/g, '\"\"'\)/, "quotes are escaped as doubled quotes");
assert.match(util, /\[",\\n\\r\]/, "comma/quote/newline values are quoted");
assert.ok(exists("components/ui/TableCsvMenu.tsx"), "TableCsvMenu exists");
const menu = read("components/ui/TableCsvMenu.tsx");
assert.match(menu, /Download as CSV \/ CSV 다운로드|CSV 다운로드/, "CSV aria/label exists");
assert.match(menu, /rows\.length === 0/, "empty rows are disabled");

const expected = [
  "components/calculator/DividendCaptureSimulator.tsx",
  "components/calculator/ConversionCalculator.tsx",
  "components/calculator/MddCalculator.tsx",
  "components/dividend/DividendHoldingsTable.tsx",
  "components/watchlist/DividendEventTable.tsx",
  "components/watchlist/TaxSavingTable.tsx",
  "components/portfolio/HoldingsTable.tsx",
  "components/portfolio/PortfolioParsePreview.tsx",
  "components/qld/QldHoldingsRankTable.tsx",
];
for (const file of expected) {
  const source = read(file);
  assert.match(source, /TableCsvMenu/, `${file} uses TableCsvMenu`);
  assert.doesNotMatch(source, /<th[^>]*>\s*CSV\s*<\/th>/, `${file} does not add a CSV table column`);
}
assert.match(read("components/calculator/DividendCaptureSimulator.tsx"), /rows=\{sortedRows\}/, "dividend capture CSV uses sorted rows");
assert.match(read("components/calculator/ConversionCalculator.tsx"), /rows=\{sortedRows\}/, "conversion CSV uses sorted rows");
assert.match(read("components/calculator/MddCalculator.tsx"), /rows=\{sortedEpisodes\}/, "MDD episodes CSV uses sorted rows");
assert.match(read("components/calculator/MddCalculator.tsx"), /rows=\{sortedRecent\}/, "MDD recent CSV uses sorted rows");
assert.match(read("components/watchlist/TaxSavingTable.tsx"), /rows=\{sortedRows\}/, "tax saving CSV uses sorted rows");
assert.match(read("components/qld/QldHoldingsRankTable.tsx"), /rows=\{rows\}/, "performance CSV uses filtered/sorted rows");

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.scripts["check:table-csv-download-menu"], "node scripts/check-table-csv-download-menu.mjs");
assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["firebase", "lucide-react", "next", "react", "react-dom", "recharts", "xlsx"].sort(), "no new dependency added");
console.log("TABLE-CSV-DOWNLOAD-MENU-1 checks passed");
