#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const schd = read("lib/schd-attractiveness.ts");
assert.match(schd, /SCHD_TARGET_YIELDS\s*=\s*\[0\.034, 0\.035, 0\.036, 0\.037, 0\.038\]/);
assert.match(schd, /quarters\.size\s*>=\s*typicalQuarterCount/);
assert.doesNotMatch(schd, /complete\s*=\s*agg\.count\s*>=/);
const schdView = read("components/dividend/SchdAttractivenessSection.tsx");
assert.match(schdView, /row\.year === latestYear && !row\.complete/);

const calendarPage = read("components/watchlist/DividendCalendarPage.tsx");
const customDialog = read("components/watchlist/CustomEventDialog.tsx");
const calendarGrid = read("components/watchlist/CalendarGrid.tsx");
assert.match(customDialog, /await onSubmit\(/);
assert.match(customDialog, /catch\s*\{[\s\S]*일정을 저장하지 못했습니다/);
assert.match(calendarPage, /await saveCustom/);
assert.ok(calendarPage.indexOf("await saveCustom") < calendarPage.indexOf("setCustomDialogOpen(false)"));
assert.match(calendarPage, /변경사항이 있습니다\. 클라우드 저장해주세요\./);
assert.match(calendarPage, /setCloudSaveNeeded\(false\)/);
assert.doesNotMatch(calendarGrid, /flex-1 truncate pt-0\.5/);
assert.match(calendarGrid, /\[text-overflow:clip\]/);

const portfolio = read("components/portfolio/PortfolioPage.tsx");
assert.match(portfolio, /bg-emerald-50\/95[\s\S]*dark:bg-emerald-950\/80/);
assert.match(portfolio, /bg-amber-50\/95[\s\S]*dark:bg-\[#1c2426\]\/90/);
assert.match(portfolio, /text-amber-800[\s\S]*dark:text-amber-200/);

const marketCard = read("components/market/MarketIndexCard.tsx");
const chartMatch = marketCard.match(/\{\/\* Candlestick mini chart \*\/\}([\s\S]*?)\{\/\* Period toggle/);
const chartBlock = chartMatch ? chartMatch[1] : "";
assert.doesNotMatch(chartBlock, /stopPropagation/);
assert.match(marketCard, /Period toggle \(does not open the modal\)[\s\S]*stopPropagation/);

const fearGreed = read("components/market/MarketSnapshotSection.tsx");
assert.match(fearGreed, /href="https:\/\/edition\.cnn\.com\/markets\/fear-and-greed"/);
assert.match(fearGreed, /target="_blank"/);
assert.match(fearGreed, /rel="noopener noreferrer"/);
assert.match(fearGreed, /focus-visible:ring-2/);

console.log("SCHD/calendar/portfolio/market UX checks passed.");
