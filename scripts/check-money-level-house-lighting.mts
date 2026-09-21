import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getWorldObjectLighting, getHouseAmbientLighting, HOUSE_WEATHER_LIGHTING, HOUSE_NIGHT_LIGHTING } from "../lib/money-level/forest/world-object-lighting";

const times = {
  morning: [.94, .96, .015, .98, [.98, 1, 1.035]],
  day: [1, 1, 0, 1, [1, 1, 1]],
  evening: [.84, .9, .06, .96, [1.12, .95, .78]],
  night: [.69, .84, 0, .94, [.73, .88, 1.08]],
} as const;
const skies = { sunny: [1, 1, [1, 1, 1]], cloudy: [.96, .96, [.98, 1, 1.015]],
  rain: [.91, .94, [.95, .99, 1.035]], thunderstorm: [.82, .9, [.91, .97, 1.045]] } as const;
const round = (n: number) => Number(n.toFixed(3));
const approvedHouseTimes = {
  morning: [.965, .98, .008, 0, .99, [.99, 1, 1.018]],
  day: [1, 1, 0, 0, 1, [1, 1, 1]],
  evening: [.91, .93, 0, -6, 1, [1.04, .97, .985]],
} as const;
const approvedHouseWeather = { sunny: [1,[1,1,1]], cloudy: [.86,[.98,1,1.015]], rain: [.84,[.95,.99,1.035]], thunderstorm: [.82,[.91,.97,1.045]] } as const;
for (const time of Object.keys(times) as Array<keyof typeof times>) {
  const sunny = getWorldObjectLighting(time, "sunny").house;
  for (const weather of Object.keys(skies) as Array<keyof typeof skies>) {
    const { house, statue } = getWorldObjectLighting(time, weather);
    const [brightness, saturation, sepia, contrast, rgb] = times[time];
    const [skyBrightness, skySaturation, skyRgb] = skies[weather];
    assert.equal(statue.filter, `brightness(${round(brightness * skyBrightness)}) saturate(${round(saturation * skySaturation)}) contrast(${contrast}) sepia(${sepia}) hue-rotate(0deg)`, "approved statue CSS unchanged");
    const channels = rgb.map((n, i) => round(n * skyRgb[i]));
    assert.equal(statue.colorMatrix, `${channels[0]} 0 0 0 0 0 ${channels[1]} 0 0 0 0 0 ${channels[2]} 0 0 0 0 0 1 0`, "approved statue matrix unchanged");
    assert.equal(house.saturation, time === "night" ? HOUSE_NIGHT_LIGHTING[weather].saturation : round(sunny.saturation * HOUSE_WEATHER_LIGHTING[weather].saturation));
    if (weather !== "sunny") assert.ok(house.saturation < sunny.saturation && house.saturation >= sunny.saturation * .78 - .0005, "weather stays desaturated without stacking into gray");
    assert.ok(house.colorMatrix.endsWith("0 0 0 1 0"), "alpha preserved");
    if (time !== "night") {
      const [exposure,sat,houseSepia,houseHue,houseContrast,houseRgb] = approvedHouseTimes[time];
      const [weatherSat,weatherRgb] = approvedHouseWeather[weather];
      assert.equal(house.filter, `brightness(${round(exposure*skyBrightness)}) saturate(${round(sat*weatherSat)}) contrast(${houseContrast}) sepia(${houseSepia}) hue-rotate(${houseHue}deg)`, "all approved non-Night house filters unchanged");
      const c = houseRgb.map((v,i)=>round(v*weatherRgb[i]));
      assert.equal(house.colorMatrix, `${c[0]} 0 0 0 0 0 ${c[1]} 0 0 0 0 0 ${c[2]} 0 0 0 0 0 1 0`);
      assert.equal(getHouseAmbientLighting(time,weather).night,null);
    }
  }
}
for (const [weather,expected] of Object.entries({ sunny:.94,cloudy:.92,rain:.91,thunderstorm:.90 })) {
  const key=weather as keyof typeof skies, ambient=getHouseAmbientLighting("night",key);
  assert.equal(getWorldObjectLighting("night",key).house.saturation,expected,"Night weather is not desaturated twice");
  assert.equal(ambient.night?.blendMode,"hard-light");assert.equal(ambient.night.opacity,.075);assert.equal(ambient.night.contrast,1.06);
  assert.ok(ambient.opacity>=.09&&ambient.opacity<=.11);
}
assert.equal(getWorldObjectLighting("day", "sunny").house.filter, "brightness(1) saturate(1) contrast(1) sepia(0) hue-rotate(0deg)");
assert.equal(getWorldObjectLighting("morning", "sunny").house.filter, "brightness(0.965) saturate(0.98) contrast(0.99) sepia(0.008) hue-rotate(0deg)");
assert.equal(getWorldObjectLighting("evening", "sunny").house.filter, "brightness(0.91) saturate(0.93) contrast(1) sepia(0) hue-rotate(-6deg)");
assert.equal(getWorldObjectLighting("night", "sunny").house.filter, "brightness(0.835) saturate(0.94) contrast(1) sepia(0) hue-rotate(4deg)");
assert.equal(getHouseAmbientLighting("evening", "sunny").opacity, .018);
assert.equal(getWorldObjectLighting("evening", "sunny").house.sepia, 0);
assert.notEqual(getWorldObjectLighting("night", "sunny").house.colorMatrix, getWorldObjectLighting("night", "sunny").statue.colorMatrix);
const scene = readFileSync("components/money-level/MoneyLevelScene.tsx", "utf8");
assert.ok(scene.includes('objectLighting.statue.colorMatrix'));
assert.ok(scene.includes('url(#${lightingFilterId}-statue)'));
assert.ok(scene.includes('className="house-art-image"'), "house and camp share HouseVisual source of truth");
console.log("House time + weather calibration, crisp weather desaturation, alpha, Day/Morning and all 16 approved statue grades PASS");
