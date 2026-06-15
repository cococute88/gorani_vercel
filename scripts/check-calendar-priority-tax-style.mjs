import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const sortHelper = read("lib/calendar-event-sort.ts");
const grid = read("components/watchlist/CalendarGrid.tsx");
const page = read("components/watchlist/DividendCalendarPage.tsx");
const tax = read("components/watchlist/TaxSavingTable.tsx");
const schedule = read("components/watchlist/DividendSchedulePreview.tsx");

assert.match(sortHelper, /getCalendarEventPriority/, "calendar priority helper exists");
assert.match(sortHelper, /favorite === "💗"[\s\S]*return 0/, "heart events have first priority");
assert.match(sortHelper, /favorite === "⭐"[\s\S]*return 1/, "star events have second priority");
assert.match(sortHelper, /status === "confirmed"[\s\S]*return 2/, "confirmed events precede other ordinary events");
assert.match(sortHelper, /TYPE_PRIORITY/, "type priority participates after favorite/status priority");
assert.match(grid, /sortCalendarEventsByPriority\(eventsByDate\.get\(cell\.isoDate\) \?\? \[\]\)/, "monthly cell chips sort by priority");
assert.match(page, /sortCalendarEventsByPriority\(filteredEvents\.filter\(\(event\) => event\.date === selectedDate\)\)/, "selected date list sorts by priority");
assert.match(page, /setEventMetas\(next\)/, "star/heart local state updates immediately before remote persistence");

assert.match(tax, /useState<TaxSortDirection>\("desc"\)/, "tax sort defaults to descending");
assert.match(tax, /Number\.isFinite\(row\.taxSavingUsd\)/, "tax sort uses numeric finite value");
assert.match(tax, /if \(aMissing\) return 1;/, "missing tax values sink to bottom");
assert.match(tax, /if \(bMissing\) return -1;/, "missing tax values sink to bottom against valid rows");
assert.match(tax, /setTaxSortDirection\(\(current\) => \(current === "desc" \? "asc" : "desc"\)\)/, "tax header toggles direction");
assert.match(tax, /절세액[\s\S]*taxSortDirection === "desc" \? "↓" : "↑"/, "tax header displays direction arrow");

assert.match(schedule, /const isEstimated = row\.status === "estimated";/, "estimated schedule rows are detected from status");
assert.match(schedule, /bg-slate-50 dark:bg-slate-800\/40/, "estimated schedule rows use subtle gray light/dark backgrounds");
assert.match(schedule, /isEstimated \? "bg-slate-50 dark:bg-slate-800\/40" : ""/, "confirmed schedule rows keep default row background");

console.log("calendar priority/tax/style checks passed");
