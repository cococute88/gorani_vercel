import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "../types";

type AmbientGrade = {
  brightness: number;
  saturation: number;
  sepia: number;
  hueRotateDeg: number;
  contrast: number;
  colorMatrix: string;
  filter: string;
};

// The painted backgrounds and character Spine layer are intentionally excluded.
// A shared time/weather grade gives houses, camps, and statues the same ambient
// direction; small category brightness differences keep tiny statue details legible.
const TIME_LIGHTING: Record<MoneyLevelTimeOfDay, {
  houseBrightness: number;
  statueBrightness: number;
  saturation: number;
  sepia: number;
  hueRotateDeg: number;
  contrast: number;
  rgb: readonly [number, number, number];
}> = {
  morning: { houseBrightness: .93, statueBrightness: .94, saturation: .96, sepia: .015, hueRotateDeg: 0, contrast: .98, rgb: [.98, 1, 1.035] },
  day: { houseBrightness: 1, statueBrightness: 1, saturation: 1, sepia: 0, hueRotateDeg: 0, contrast: 1, rgb: [1, 1, 1] },
  evening: { houseBrightness: .82, statueBrightness: .84, saturation: .9, sepia: .06, hueRotateDeg: 0, contrast: .96, rgb: [1.12, .95, .78] },
  night: { houseBrightness: .67, statueBrightness: .69, saturation: .84, sepia: 0, hueRotateDeg: 0, contrast: .94, rgb: [.73, .88, 1.08] },
};

const WEATHER_LIGHTING: Record<MoneyLevelWeather, {
  brightness: number;
  saturation: number;
  hueRotateDeg: number;
  rgb: readonly [number, number, number];
}> = {
  sunny: { brightness: 1, saturation: 1, hueRotateDeg: 0, rgb: [1, 1, 1] },
  cloudy: { brightness: .96, saturation: .96, hueRotateDeg: 0, rgb: [.98, 1, 1.015] },
  rain: { brightness: .91, saturation: .94, hueRotateDeg: 0, rgb: [.95, .99, 1.035] },
  thunderstorm: { brightness: .82, saturation: .9, hueRotateDeg: 0, rgb: [.91, .97, 1.045] },
};

function grade(brightness: number, saturation: number, sepia: number, hueRotateDeg: number, contrast: number, rgb: readonly number[]): AmbientGrade {
  const values = {
    brightness: Number(brightness.toFixed(3)),
    saturation: Number(saturation.toFixed(3)),
    sepia,
    hueRotateDeg,
    contrast,
    // Channel multiplication gives warm/cool ambient without replacing material hues or alpha.
    colorMatrix: `${rgb[0]} 0 0 0 0 0 ${rgb[1]} 0 0 0 0 0 ${rgb[2]} 0 0 0 0 0 1 0`,
  };
  return {
    ...values,
    filter: `brightness(${values.brightness}) saturate(${values.saturation}) contrast(${contrast}) sepia(${sepia}) hue-rotate(${hueRotateDeg}deg)`,
  };
}

export function getWorldObjectLighting(time: MoneyLevelTimeOfDay, weather: MoneyLevelWeather): {
  house: AmbientGrade;
  statue: AmbientGrade;
} {
  const day = TIME_LIGHTING[time];
  const sky = WEATHER_LIGHTING[weather];
  const saturation = day.saturation * sky.saturation;
  const hue = day.hueRotateDeg + sky.hueRotateDeg;
  const rgb = day.rgb.map((channel, index) => Number((channel * sky.rgb[index]).toFixed(3)));
  return {
    house: grade(day.houseBrightness * sky.brightness, saturation, day.sepia, hue, day.contrast, rgb),
    statue: grade(day.statueBrightness * sky.brightness, saturation, day.sepia, hue, day.contrast, rgb),
  };
}
