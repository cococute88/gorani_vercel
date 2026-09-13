import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "../types";

type AmbientGrade = {
  brightness: number;
  saturation: number;
  sepia: number;
  hueRotateDeg: number;
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
}> = {
  morning: { houseBrightness: .97, statueBrightness: .98, saturation: .98, sepia: .025, hueRotateDeg: 1 },
  day: { houseBrightness: 1, statueBrightness: 1, saturation: 1, sepia: 0, hueRotateDeg: 0 },
  evening: { houseBrightness: .86, statueBrightness: .90, saturation: .96, sepia: .14, hueRotateDeg: -2 },
  night: { houseBrightness: .64, statueBrightness: .74, saturation: .76, sepia: 0, hueRotateDeg: 12 },
};

const WEATHER_LIGHTING: Record<MoneyLevelWeather, {
  brightness: number;
  saturation: number;
  hueRotateDeg: number;
}> = {
  sunny: { brightness: 1, saturation: 1, hueRotateDeg: 0 },
  cloudy: { brightness: .98, saturation: .98, hueRotateDeg: 0 },
  rain: { brightness: .96, saturation: .97, hueRotateDeg: 1 },
  thunderstorm: { brightness: .92, saturation: .92, hueRotateDeg: 3 },
};

function grade(brightness: number, saturation: number, sepia: number, hueRotateDeg: number): AmbientGrade {
  const values = {
    brightness: Number(brightness.toFixed(3)),
    saturation: Number(saturation.toFixed(3)),
    sepia,
    hueRotateDeg,
  };
  return {
    ...values,
    filter: `brightness(${values.brightness}) saturate(${values.saturation}) sepia(${sepia}) hue-rotate(${hueRotateDeg}deg)`,
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
  return {
    house: grade(day.houseBrightness * sky.brightness, saturation, day.sepia, hue),
    statue: grade(day.statueBrightness * sky.brightness, saturation, day.sepia, hue),
  };
}
