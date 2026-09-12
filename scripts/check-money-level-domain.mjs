#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  calculateMoneyLevelIncome,
  calculateMoneyLevelMp,
  houseDisplayLevel,
  hpHeartEquivalent,
  toHpHearts,
  toTenthHearts,
} = require("../lib/money-level/finance.ts");
const {
  resolveMoneyLevelHouseStage,
  resolveMoneyLevelPortfolioHouses,
} = require("../lib/money-level/house-stages.ts");
const { calculateRetirementProgress } = require("../lib/money-level/retirement.ts");
const {
  DEFAULT_MONEY_LEVEL_SETTINGS,
  isValidMoneyLevelDate,
  isValidMoneyLevelSettings,
  normalizeMoneyLevelSettings,
} = require("../lib/money-level/settings.ts");
const { resolveMoneyLevelWeather } = require("../lib/money-level/weather.ts");

const example = {
  brokerageValue: 427_486_959,
  isaPrincipal: 32_833_192,
  pensionPrincipal: 108_946_382,
  updatedAt: "2026-09-12T01:02:03.000Z",
};

const income = calculateMoneyLevelIncome(example, DEFAULT_MONEY_LEVEL_SETTINGS);
assert.equal(Math.round(income.brokerageMonthlyIncome), 1_054_824);
assert.equal(Math.round(income.isaMonthlyIncome), 90_291);
assert.equal(Math.round(income.pensionMonthlyIncome), 299_603);
assert.equal(Math.round(income.totalMonthlyIncome), 1_444_718);
assert.equal(calculateMoneyLevelMp(example), 569_266_533);

const brokerageHp = toHpHearts(income.brokerageMonthlyIncome);
const isaHp = toHpHearts(income.isaMonthlyIncome);
const pensionHp = toHpHearts(income.pensionMonthlyIncome);
assert.deepEqual(brokerageHp, {
  special: 1,
  full: 0,
  fraction: 0.5,
  value: income.brokerageMonthlyIncome,
});
assert.equal(hpHeartEquivalent(brokerageHp), 10.5);
assert.equal(houseDisplayLevel(brokerageHp), 10);
assert.equal(hpHeartEquivalent(isaHp), 0.5);
assert.equal(hpHeartEquivalent(pensionHp), 2.5);
assert.equal(houseDisplayLevel(isaHp, pensionHp), 3);
assert.deepEqual(toTenthHearts(calculateMoneyLevelMp(example)), {
  full: 5,
  fraction: 0.6,
  value: 569_266_533,
});

assert.deepEqual(toHpHearts(1_054_824), {
  special: 1,
  full: 0,
  fraction: 0.5,
  value: 1_054_824,
});
assert.equal(hpHeartEquivalent(toHpHearts(1_000_000)), 10);

const houses = resolveMoneyLevelPortfolioHouses(example);
assert.equal(houses.brokerage.level, 8);
assert.equal(houses.brokerage.art, "cabin-expanded");
assert.equal(houses.taxAdvantaged.level, 2);
assert.equal(houses.taxAdvantaged.art, "camp-plus");
assert.equal(resolveMoneyLevelHouseStage(499_999_999).art, "house");
assert.equal(resolveMoneyLevelHouseStage(500_000_000).art, "workshop-house");
assert.equal(resolveMoneyLevelHouseStage(1_000_000_000).label, "대저택 확장 1단계");
assert.equal(resolveMoneyLevelHouseStage(1_050_000_000).label, "대저택 확장 2단계");

assert.deepEqual(
  calculateRetirementProgress(new Date(2026, 8, 12), DEFAULT_MONEY_LEVEL_SETTINGS.retirementDate),
  { currentMonth: 90, totalMonths: 131, remainingMonths: 41, progress: 90 / 131 },
);

assert.equal(isValidMoneyLevelDate("2030-02-28"), true);
assert.equal(isValidMoneyLevelDate("2030-02-30"), false);
assert.equal(isValidMoneyLevelSettings(DEFAULT_MONEY_LEVEL_SETTINGS), true);
assert.equal(isValidMoneyLevelSettings({ ...DEFAULT_MONEY_LEVEL_SETTINGS, brokerageTaxRate: -0.1 }), false);
assert.deepEqual(normalizeMoneyLevelSettings(undefined), DEFAULT_MONEY_LEVEL_SETTINGS);
assert.equal(normalizeMoneyLevelSettings({ brokerageYield: 2 }).brokerageYield, 0.035);
assert.equal(
  normalizeMoneyLevelSettings({ brokerageDividendRate: 0.99 }).brokerageYield,
  0.035,
);

const weatherDate = new Date(2026, 8, 12, 8);
assert.equal(resolveMoneyLevelWeather(weatherDate), resolveMoneyLevelWeather(new Date(2026, 8, 12, 22)));

console.log("money level domain checks passed");
