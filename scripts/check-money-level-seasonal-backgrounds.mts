import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getActualPayday, getKoreanHolidayDataQuality, PAYDAY_HOLIDAY_SUPPORT } from "../lib/money-level/forest/payday-calendar";
import {
  FOREST_SEASONAL_BACKGROUND_MANIFEST,
  resolveForestBackground,
} from "../lib/money-level/forest/scene-config";
import {
  FOREST_SCENE_WEATHERS,
  FOREST_SEASONS,
  FOREST_TIMES,
  isSeasonWeatherAvailable,
  resolveMoneyLevelSeason,
  resolveSeasonalBackgroundState,
} from "../lib/money-level/forest/seasonal-backgrounds";
import { getSeoulCalendarDate, resolveSeoulTimeOfDay } from "../lib/money-level/forest/seoul-time";
import type { MoneyLevelSceneWeather } from "../lib/money-level/types";

const root = process.cwd();
const assetRoot = path.join(root, "public", "money-level", "art", "background", "seasonal");

for (const [month, season] of [
  [1, "winter"], [2, "winter"], [3, "spring"], [5, "spring"], [6, "summer"],
  [8, "summer"], [9, "fall"], [11, "fall"], [12, "winter"],
] as const) assert.equal(resolveMoneyLevelSeason(month), season, `${month}월 season mismatch`);

assert.deepEqual(getSeoulCalendarDate(new Date("2026-02-28T15:30:00.000Z")), { year: 2026, month: 3, day: 1 });
assert.equal(resolveSeoulTimeOfDay(new Date("2026-09-11T20:00:00.000Z")), "morning", "20:00Z must be 05:00 Asia/Seoul");
assert.equal(resolveSeoulTimeOfDay(new Date("2026-09-12T10:00:00.000Z")), "night", "10:00Z must be 19:00 Asia/Seoul");

assert.deepEqual(getActualPayday(2026, 4), { year: 2026, month: 4, day: 17 }, "normal weekday payday");
assert.deepEqual(getActualPayday(2027, 4), { year: 2027, month: 4, day: 16 }, "Saturday payday adjustment");
assert.deepEqual(getActualPayday(2026, 5), { year: 2026, month: 5, day: 15 }, "Sunday payday adjustment");
assert.deepEqual(getActualPayday(2026, 7), { year: 2026, month: 7, day: 16 }, "Constitution Day holiday adjustment");
assert.deepEqual(getActualPayday(2026, 2), { year: 2026, month: 2, day: 13 }, "Seollal plus weekend must walk back to Friday");

for (let year = 2028; year <= PAYDAY_HOLIDAY_SUPPORT.lastYear; year += 1) {
  assert.equal(getKoreanHolidayDataQuality(year), "statutory-projection");
  for (let month = 1; month <= 12; month += 1) {
    const payday = getActualPayday(year, month);
    assert(payday.day >= 12 && payday.day <= 17, `${year}-${month} payday projection is implausible`);
  }
}
assert.throws(() => getActualPayday(2036, 1), RangeError, "unsupported future years must fail explicitly");

const springPayday = getActualPayday(2026, 4);
assert.deepEqual(resolveSeasonalBackgroundState(springPayday, "sunny"), {
  season: "spring", weather: "snow", specialEvent: "none", actualPayday: springPayday,
  isPayday: true, holidayDataQuality: "official",
});
assert.equal(resolveSeasonalBackgroundState({ year: 2026, month: 4, day: 16 }, "rain").weather, "rain");

const summerPayday = getActualPayday(2026, 6);
const summerEvent = resolveSeasonalBackgroundState(summerPayday, "thunderstorm");
assert.equal(summerEvent.weather, "sunny");
assert.equal(summerEvent.specialEvent, "payday-leaf-shower");
const summerNormal = resolveSeasonalBackgroundState({ year: 2026, month: 6, day: 16 }, "rain");
assert.equal(summerNormal.weather, "rain");
assert.equal(summerNormal.specialEvent, "none");
assert.equal(resolveSeasonalBackgroundState({ year: 2026, month: 6, day: 16 }, "sunny", { weather: "snow" }).weather, "sunny", "summer snow must fail safe");

const fallPayday = getActualPayday(2026, 9);
assert.equal(resolveSeasonalBackgroundState(fallPayday, "cloudy").weather, "snow");
assert.equal(resolveSeasonalBackgroundState({ year: 2026, month: 9, day: 16 }, "thunderstorm").weather, "thunderstorm");
const winterPayday = getActualPayday(2026, 12);
const winter = resolveSeasonalBackgroundState(winterPayday, "rain");
assert.equal(winter.weather, "snow", "winter precipitation may resolve to snow");
assert.equal(winter.specialEvent, "none", "winter payday must not force a special event");
assert.equal(resolveSeasonalBackgroundState({ year: 2026, month: 4, day: 16 }, "sunny", { weather: "snow" }).weather, "snow", "Preview may explicitly inspect spring snow");
assert.equal(resolveSeasonalBackgroundState({ year: 2026, month: 4, day: 16 }, "sunny", { specialEvent: "normal-windy" }).specialEvent, "normal-windy");
assert.equal(resolveSeasonalBackgroundState({ year: 2026, month: 4, day: 16 }, "rain", { specialEvent: "payday-leaf-shower" }).weather, "sunny");

const manifestEntries = Object.entries(FOREST_SEASONAL_BACKGROUND_MANIFEST);
assert.equal(manifestEntries.length, 76, "Manifest must expose 76 valid combinations");
const counts = { spring: 0, summer: 0, fall: 0, winter: 0 };
const hashes = new Set<string>();
const actualNames = new Set(readdirSync(assetRoot));
for (const season of FOREST_SEASONS) {
  for (const time of FOREST_TIMES) {
    for (const weather of FOREST_SCENE_WEATHERS) {
      if (!isSeasonWeatherAvailable(season, weather)) continue;
      const url = resolveForestBackground(season, time, weather);
      const filename = path.basename(url);
      const expectedWeather = weather === "thunderstorm" ? "storm" : weather;
      assert.equal(filename, `forest-${season}-${time}-${expectedWeather}.webp`);
      assert(actualNames.has(filename), `Missing or case-mismatched Production asset: ${filename}`);
      const data = readFileSync(path.join(assetRoot, filename));
      assert.equal(data.toString("ascii", 0, 4), "RIFF", `${filename} is not a WebP RIFF file`);
      assert.equal(data.toString("ascii", 8, 12), "WEBP", `${filename} is not a WebP payload`);
      hashes.add(createHash("sha256").update(data).digest("hex"));
      counts[season] += 1;
    }
  }
}
assert.deepEqual(counts, { spring: 20, summer: 16, fall: 20, winter: 20 });
assert.equal(hashes.size, 76, "Production backgrounds must not contain duplicate files");
assert.equal(actualNames.size, 76, "Seasonal Production directory must not contain unexpected files");
assert(!actualNames.has("forest-summer-day-snow.webp"), "Summer snow asset must not exist");

const invalidSummerSnow = FOREST_SEASONAL_BACKGROUND_MANIFEST["summer/day/snow"];
assert.equal(invalidSummerSnow, undefined);
assert.equal(resolveForestBackground("summer", "day", "snow" as MoneyLevelSceneWeather), "/money-level/art/background/seasonal/forest-spring-day-sunny.webp");

console.log("Money Level seasonal backgrounds/payday checks passed: 76 assets, 2018-2035 calendar support");
