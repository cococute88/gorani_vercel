import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getWorldObjectLighting, HOUSE_WEATHER_LIGHTING } from "../lib/money-level/forest/world-object-lighting";

const times = {
  morning: [.94, .96, .015, .98, [.98, 1, 1.035]],
  day: [1, 1, 0, 1, [1, 1, 1]],
  evening: [.84, .9, .06, .96, [1.12, .95, .78]],
  night: [.69, .84, 0, .94, [.73, .88, 1.08]],
} as const;
const skies = { sunny: [1, 1, [1, 1, 1]], cloudy: [.96, .96, [.98, 1, 1.015]],
  rain: [.91, .94, [.95, .99, 1.035]], thunderstorm: [.82, .9, [.91, .97, 1.045]] } as const;
const round = (n: number) => Number(n.toFixed(3));
for (const time of Object.keys(times) as Array<keyof typeof times>) {
  const sunny = getWorldObjectLighting(time, "sunny").house;
  for (const weather of Object.keys(skies) as Array<keyof typeof skies>) {
    const { house, statue } = getWorldObjectLighting(time, weather);
    const [brightness, saturation, sepia, contrast, rgb] = times[time];
    const [skyBrightness, skySaturation, skyRgb] = skies[weather];
    assert.equal(statue.filter, `brightness(${round(brightness * skyBrightness)}) saturate(${round(saturation * skySaturation)}) contrast(${contrast}) sepia(${sepia}) hue-rotate(0deg)`, "approved statue CSS unchanged");
    const channels = rgb.map((n, i) => round(n * skyRgb[i]));
    assert.equal(statue.colorMatrix, `${channels[0]} 0 0 0 0 0 ${channels[1]} 0 0 0 0 0 ${channels[2]} 0 0 0 0 0 1 0`, "approved statue matrix unchanged");
    assert.equal(house.saturation, round(sunny.saturation * HOUSE_WEATHER_LIGHTING[weather].saturation));
    if (weather !== "sunny") assert.ok(house.saturation < sunny.saturation && house.saturation >= sunny.saturation * .78 - .0005, "weather stays desaturated without stacking into gray");
    assert.ok(house.colorMatrix.endsWith("0 0 0 1 0"), "alpha preserved");
  }
}
assert.equal(getWorldObjectLighting("day", "sunny").house.filter, "brightness(1) saturate(1) contrast(1) sepia(0) hue-rotate(0deg)");
assert.equal(getWorldObjectLighting("morning", "sunny").house.filter, "brightness(0.93) saturate(0.96) contrast(0.98) sepia(0.015) hue-rotate(0deg)");
assert.equal(getWorldObjectLighting("evening", "sunny").house.sepia, 0);
assert.notEqual(getWorldObjectLighting("night", "sunny").house.colorMatrix, getWorldObjectLighting("night", "sunny").statue.colorMatrix);
const scene = readFileSync("components/money-level/MoneyLevelScene.tsx", "utf8");
assert.ok(scene.includes('objectLighting.statue.colorMatrix'));
assert.ok(scene.includes('url(#${lightingFilterId}-statue)'));
assert.ok(scene.includes('className="house-art-image"'), "house and camp share HouseVisual source of truth");
console.log("House time + weather calibration, crisp weather desaturation, alpha, Day/Morning and all 16 approved statue grades PASS");
