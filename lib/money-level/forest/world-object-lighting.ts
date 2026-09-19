import type { MoneyLevelSceneWeather, MoneyLevelTimeOfDay } from "../types";

type AmbientGrade = {
  brightness: number;
  saturation: number;
  sepia: number;
  hueRotateDeg: number;
  contrast: number;
  colorMatrix: string;
  filter: string;
};

export const HOUSE_AMBIENT_TIME = {
  day: { color: "#87979d", opacity: 0 },
  morning: { color: "#91a7b9", opacity: 0 },
  evening: { color: "#946d85", opacity: .035 },
  night: { color: "#486a87", opacity: .05 },
} as const;
export const HOUSE_AMBIENT_WEATHER = {
  sunny: { color: "#87979d", opacity: 0 },
  cloudy: { color: "#7d8a98", opacity: .015 },
  rain: { color: "#607d96", opacity: .02 },
  thunderstorm: { color: "#465b79", opacity: .025 },
  snow: { color: "#d8e6ed", opacity: .018 },
} as const;

// Night weather is a complete material grade: do not multiply another weather
// saturation into it. Color remains readable under stronger environmental light.
export const HOUSE_NIGHT_LIGHTING = {
  sunny: { saturation: .88, shadowColor: "#103a62", shadowOpacity: .18, lightColor: "#336dac" },
  cloudy: { saturation: .84, shadowColor: "#193951", shadowOpacity: .20, lightColor: "#446b9e" },
  rain: { saturation: .82, shadowColor: "#103e59", shadowOpacity: .20, lightColor: "#2e789d" },
  thunderstorm: { saturation: .80, shadowColor: "#132b49", shadowOpacity: .22, lightColor: "#3b6397" },
  snow: { saturation: .82, shadowColor: "#1d405d", shadowOpacity: .19, lightColor: "#7396b8" },
} as const;

type HouseAmbientLighting = {
  color: string;
  opacity: number;
  blendMode: "multiply";
  night: null | { color: string; opacity: number; blendMode: "hard-light"; contrast: number; practicalLightProtection: number };
};

/** Material-independent Brokerage/Tax lighting. Approved non-Night grades keep
 * their single subtle tint; Night adds a stronger shadow + moonlight composite. */
export function getHouseAmbientLighting(time: MoneyLevelTimeOfDay, weather: MoneyLevelSceneWeather): HouseAmbientLighting {
  if (time === "night") {
    const night = HOUSE_NIGHT_LIGHTING[weather];
    return { color: night.shadowColor, opacity: night.shadowOpacity, blendMode: "multiply",
      night: { color: night.lightColor, opacity: .15, blendMode: "hard-light", contrast: 1.12, practicalLightProtection: .55 } };
  }
  const base = HOUSE_AMBIENT_TIME[time];
  const sky = HOUSE_AMBIENT_WEATHER[weather];
  const opacity = Math.min(.075, base.opacity + sky.opacity);
  const rgb = (color: string) => [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
  const a = rgb(base.color), b = rgb(sky.color);
  const color = "#" + a.map((channel, i) => Math.round(opacity ? (channel * base.opacity + b[i] * sky.opacity) / (base.opacity + sky.opacity) : channel).toString(16).padStart(2, "0")).join("");
  return { color, opacity: Number(opacity.toFixed(3)), blendMode: "multiply", night: null };
}

// The painted backgrounds and character Spine layer are intentionally excluded.
// Preserve the approved statue grade. House/camp material calibration below
// has a separate time base and weather modifier, with unchanged exposure.
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

const WEATHER_LIGHTING: Record<MoneyLevelSceneWeather, {
  brightness: number;
  saturation: number;
  hueRotateDeg: number;
  rgb: readonly [number, number, number];
}> = {
  sunny: { brightness: 1, saturation: 1, hueRotateDeg: 0, rgb: [1, 1, 1] },
  cloudy: { brightness: .96, saturation: .96, hueRotateDeg: 0, rgb: [.98, 1, 1.015] },
  rain: { brightness: .91, saturation: .94, hueRotateDeg: 0, rgb: [.95, .99, 1.035] },
  thunderstorm: { brightness: .82, saturation: .9, hueRotateDeg: 0, rgb: [.91, .97, 1.045] },
  snow: { brightness: .95, saturation: .92, hueRotateDeg: 0, rgb: [.96, 1.01, 1.045] },
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

export function getWorldObjectLighting(time: MoneyLevelTimeOfDay, weather: MoneyLevelSceneWeather): {
  house: AmbientGrade;
  statue: AmbientGrade;
} {
  const day = TIME_LIGHTING[time];
  const sky = WEATHER_LIGHTING[weather];
  const saturation = day.saturation * sky.saturation;
  const hue = day.hueRotateDeg + sky.hueRotateDeg;
  const rgb = day.rgb.map((channel, index) => Number((channel * sky.rgb[index]).toFixed(3)));
  // House art needs its own material calibration. Keep the approved statue
  // resolver byte-for-byte equivalent to the previous time/weather grade.
  const houseTime = HOUSE_TIME_LIGHTING[time];
  const houseSky = HOUSE_WEATHER_LIGHTING[weather];
  return {
    house: grade(day.houseBrightness * sky.brightness,
      time === "night" ? HOUSE_NIGHT_LIGHTING[weather].saturation : houseTime.saturation * houseSky.saturation, houseTime.sepia,
      houseTime.hueRotateDeg, time === "evening" || time === "night" ? 1 : day.contrast,
      houseTime.rgb.map((channel, index) => Number((channel * houseSky.rgb[index]).toFixed(3)))),
    statue: grade(day.statueBrightness * sky.brightness, saturation, day.sepia, hue, day.contrast, rgb),
  };
}

const HOUSE_TIME_LIGHTING = {
  morning: { saturation: .96, sepia: .015, hueRotateDeg: 0, rgb: [.98, 1, 1.035] },
  day: { saturation: 1, sepia: 0, hueRotateDeg: 0, rgb: [1, 1, 1] },
  // Remove the former yellow sepia/blue suppression; a small red shift puts
  // timber in sunset while keeping the roof green.
  evening: { saturation: .86, sepia: 0, hueRotateDeg: -12, rgb: [1.08, .94, .97] },
  // Cool the yellow-green daylight paint without recoloring warm windows.
  night: { saturation: .88, sepia: 0, hueRotateDeg: 8, rgb: [.70, .88, 1.16] },
} satisfies Record<MoneyLevelTimeOfDay, { saturation: number; sepia: number; hueRotateDeg: number; rgb: number[] }>;

export const HOUSE_WEATHER_LIGHTING = {
  sunny: { saturation: 1, rgb: [1, 1, 1] },
  cloudy: { saturation: .86, rgb: [.98, 1, 1.015] },
  rain: { saturation: .84, rgb: [.95, .99, 1.035] },
  thunderstorm: { saturation: .82, rgb: [.91, .97, 1.045] },
  snow: { saturation: .86, rgb: [.96, 1.01, 1.045] },
} satisfies Record<MoneyLevelSceneWeather, { saturation: number; rgb: number[] }>;
