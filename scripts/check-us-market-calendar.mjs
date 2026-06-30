#!/usr/bin/env node

// Regression coverage for the dividend-calendar fixes:
//   1. U.S. market holiday + trading-day calendar (generalized rules).
//   2. Buy-deadline never lands on a weekend OR market holiday.
//   3. Confirmed (declared) dividends suppress nearby ESTIMATED projections so a
//      single dividend never shows both a confirmed and a spurious estimated row.
//   4. The U.S. economic calendar rolls forward (this-week / next-week never
//      empty out as wall-clock time advances past a frozen snapshot).

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
  isUsMarketHolidayIso,
  isUsTradingDayIso,
  previousUsTradingDayIso,
  nextUsTradingDayAfterIso,
} = require("../lib/us-market-calendar.ts");
const { getPreviousDividendBuyDate } = require("../lib/calendar-event-provider.ts");
const { mergeDeclaredAndProjectedEvents } = require("../lib/calendar-dividend-live.ts");
const { splitEconomicEventsByWeek } = require("../lib/economic-calendar-data.ts");

function assertHolidayRules() {
  // 2026: Jul 4 is Saturday -> observed Friday Jul 3; markets closed.
  assert.equal(isUsMarketHolidayIso("2026-07-03"), true, "Independence Day observed (Fri 7/3 2026)");
  assert.equal(isUsTradingDayIso("2026-07-03"), false, "7/3 2026 is not a trading day");
  assert.equal(isUsMarketHolidayIso("2026-06-19"), true, "Juneteenth (Fri 6/19 2026)");
  assert.equal(isUsMarketHolidayIso("2026-12-25"), true, "Christmas (Fri 12/25 2026)");
  assert.equal(isUsMarketHolidayIso("2026-11-26"), true, "Thanksgiving (Thu 11/26 2026)");
  // Rule-derived across years.
  assert.equal(isUsMarketHolidayIso("2024-03-29"), true, "Good Friday 2024");
  assert.equal(isUsMarketHolidayIso("2024-05-27"), true, "Memorial Day 2024");
  assert.equal(isUsMarketHolidayIso("2025-01-20"), true, "MLK Day 2025");
  // A normal trading day is not a holiday.
  assert.equal(isUsTradingDayIso("2026-07-02"), true, "Thu 7/2 2026 is a trading day");

  return { jul3Holiday: true };
}

function assertBuyDeadlineSkipsHolidays() {
  // ex on Monday 2026-07-06: prior weekday is Fri 7/3 (observed holiday) -> must
  // skip back to Thu 7/2.
  assert.equal(getPreviousDividendBuyDate("2026-07-06"), "2026-07-02", "Mon ex after Jul-4 weekend -> Thu buy");
  // ex Thu 7/2 -> Wed 7/1.
  assert.equal(getPreviousDividendBuyDate("2026-07-02"), "2026-07-01", "Thu ex -> Wed buy");
  // ex Mon after Christmas/New-Year cluster: 2026-12-28 -> Thu 12-24 (12/25 holiday).
  assert.equal(getPreviousDividendBuyDate("2026-12-28"), "2026-12-24", "Mon ex after Christmas -> Thu buy");
  // The buy-deadline is always a trading day for every day of 2026.
  let cursor = "2026-01-02";
  while (cursor <= "2026-12-31") {
    const buy = getPreviousDividendBuyDate(cursor);
    assert.equal(isUsTradingDayIso(buy), true, `buy-deadline for ex ${cursor} (${buy}) must be a trading day`);
    cursor = nextUsTradingDayAfterIso(cursor);
  }
  return { holidayAwareBuyDeadline: true };
}

function assertConfirmedSuppressesEstimated() {
  const today = new Date("2026-06-30T00:00:00Z");
  const declaredRows = [
    { exDate: "2026-07-02", amount: 0.25, payDate: "2026-07-31" },
    { exDate: "2026-04-01", amount: 0.25, payDate: "2026-04-30" },
  ];
  const history = [
    { date: "2025-04-02", amount: 0.25 },
    { date: "2025-07-02", amount: 0.25 },
    { date: "2025-10-01", amount: 0.25 },
    { date: "2026-01-02", amount: 0.25 },
    { date: "2026-04-01", amount: 0.25 },
  ];
  const events = mergeDeclaredAndProjectedEvents("RITM", declaredRows, history, today);

  const confirmedEx = events.filter((e) => e.type === "ex_div" && e.exDivDate === "2026-07-02");
  assert.equal(confirmedEx.length, 1, "exactly one ex_div for the confirmed 7/2 dividend");
  assert.equal(confirmedEx[0].status, "confirmed", "confirmed Polygon ex stays confirmed");

  const buy = events.find((e) => e.type === "buy_by" && e.exDivDate === "2026-07-02");
  assert.equal(buy.date, "2026-07-01", "confirmed buy-deadline = prior trading day");
  assert.equal(buy.status, "confirmed", "confirmed buy-deadline stays confirmed");

  const pay = events.find((e) => e.type === "pay" && e.exDivDate === "2026-07-02");
  assert.equal(pay.date, "2026-07-31", "declared payment date is preserved verbatim");

  // No estimated event within ~3 weeks of the confirmed ex (spurious duplicate gone).
  const spurious = events.filter(
    (e) => e.status === "estimated" && Math.abs(new Date(e.exDivDate).getTime() - new Date("2026-07-02").getTime()) <= 20 * 86_400_000,
  );
  assert.equal(spurious.length, 0, "no spurious estimated row beside the confirmed dividend");

  // Estimated projection still rolls forward for genuinely-future periods.
  assert.ok(events.some((e) => e.status === "estimated" && e.exDivDate > "2026-09-01"), "future estimates still projected");

  // No buy-deadline lands on a holiday/non-trading day.
  for (const e of events.filter((e) => e.type === "buy_by")) {
    assert.equal(isUsTradingDayIso(e.date), true, `buy_by ${e.date} must be a trading day`);
  }
  return { confirmedWins: true, spuriousRemoved: true };
}

function assertEconomicCalendarRolls() {
  // Today is past the old frozen snapshot's last event (2026-07-02); next week
  // must still be populated.
  const today = new Date("2026-06-30T00:00:00");
  const weeks = splitEconomicEventsByWeek(today);
  assert.equal(weeks.source, "generated", "default economic calendar is generated (rolling)");
  assert.ok(weeks.thisWeek.events.length > 0, "this week populated");
  assert.ok(weeks.nextWeek.events.length > 0, "next week populated (regression: was empty with static snapshot)");

  // No week in a full forward year is empty (rolls forward forever).
  let emptyWeeks = 0;
  for (let i = 0; i < 60; i += 1) {
    const probe = new Date(2026, 5, 1);
    probe.setDate(probe.getDate() + i * 7);
    const w = splitEconomicEventsByWeek(probe);
    if (w.thisWeek.events.length === 0) emptyWeeks += 1;
  }
  assert.equal(emptyWeeks, 0, "no empty week across a forward year");

  // Generated events never fall on a market holiday after the holiday snap.
  for (const e of [...weeks.thisWeek.events, ...weeks.nextWeek.events]) {
    assert.equal(isUsMarketHolidayIso(e.date), false, `economic event ${e.date} ${e.name} must not be on a market holiday`);
  }
  return { nextWeek: weeks.nextWeek.events.length, source: weeks.source };
}

function main() {
  const holidays = assertHolidayRules();
  const buy = assertBuyDeadlineSkipsHolidays();
  const dedup = assertConfirmedSuppressesEstimated();
  const econ = assertEconomicCalendarRolls();
  console.log("US market calendar + dividend confirmation + economic rolling checks passed.");
  console.table([{ ...holidays, ...buy, ...dedup, ...econ }]);
}

main();
