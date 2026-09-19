"use client";

import { useEffect, useState } from "react";
import {
  isMoneyLevelMarketWeatherData,
  type MoneyLevelMarketWeatherData,
} from "./market-weather";
import { parseMoneyLevelPreviewOverrides, type MoneyLevelPreviewOverrides } from "./preview";
import type {
  MoneyLevelForestSpecialEvent,
  MoneyLevelSceneWeather,
  MoneyLevelSeason,
  MoneyLevelTimeOfDay,
  MoneyLevelWeather,
} from "./types";
import { resolveMoneyLevelSeededWeather, resolveMoneyLevelTimeOfDay } from "./weather";
import { resolveSeasonalBackgroundState } from "./forest/seasonal-backgrounds";
import { getSeoulCalendarDate, type SeoulCalendarDate } from "./forest/seoul-time";

const WEATHER_STORAGE_KEY = "gorani.money-level.weather.v1";

export type MoneyLevelWeatherFallback = false | "last-known" | "seeded" | "forced-preview";

export type MoneyLevelWeatherState = {
  weather: MoneyLevelSceneWeather;
  baseWeather: MoneyLevelWeather;
  season: MoneyLevelSeason;
  specialEvent: MoneyLevelForestSpecialEvent;
  calendarDate: SeoulCalendarDate;
  actualPayday: SeoulCalendarDate;
  isPayday: boolean;
  holidayDataQuality: "official" | "statutory-projection";
  market: MoneyLevelMarketWeatherData | null;
  fallback: MoneyLevelWeatherFallback;
  timeOfDay: MoneyLevelTimeOfDay;
  previewActive: boolean;
  debugEnabled: boolean;
  ambientEnabled: boolean;
};

declare global {
  interface Window {
    __MONEY_LEVEL_MARKET_WEATHER_DEBUG__?: () => MoneyLevelWeatherState;
  }
}

function readLastKnownWeather(): MoneyLevelMarketWeatherData | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WEATHER_STORAGE_KEY) ?? "null");
    return isMoneyLevelMarketWeatherData(value) ? value : null;
  } catch {
    return null;
  }
}

function buildDisplayState(
  now: Date,
  baseWeather: MoneyLevelWeather,
  market: MoneyLevelMarketWeatherData | null,
  fallback: MoneyLevelWeatherFallback,
  preview: MoneyLevelPreviewOverrides,
): MoneyLevelWeatherState {
  const calendarDate = preview.date ?? getSeoulCalendarDate(now);
  const seasonal = resolveSeasonalBackgroundState(calendarDate, baseWeather, {
    weather: preview.weather,
    specialEvent: preview.specialEvent,
  });
  const explicitPreview = Boolean(preview.weather || preview.specialEvent);
  return {
    weather: seasonal.weather,
    baseWeather,
    season: seasonal.season,
    specialEvent: seasonal.specialEvent,
    calendarDate,
    actualPayday: seasonal.actualPayday,
    isPayday: seasonal.isPayday,
    holidayDataQuality: seasonal.holidayDataQuality,
    market,
    fallback: explicitPreview ? "forced-preview" : fallback,
    timeOfDay: preview.time ?? resolveMoneyLevelTimeOfDay(now),
    previewActive: Boolean(preview.weather || preview.time || preview.date || preview.specialEvent || !preview.ambientEnabled),
    debugEnabled: preview.debug,
    ambientEnabled: preview.ambientEnabled,
  };
}

export function useMoneyLevelMarketWeather(
  now: Date,
  previewOverridesEnabled: boolean,
): MoneyLevelWeatherState {
  const [previewRevision, setPreviewRevision] = useState(0);
  const [state, setState] = useState<MoneyLevelWeatherState>(() => buildDisplayState(
    now,
    resolveMoneyLevelSeededWeather(now),
    null,
    "seeded",
    parseMoneyLevelPreviewOverrides("", false),
  ));

  useEffect(() => {
    if (!previewOverridesEnabled) return;
    const refresh = () => setPreviewRevision((revision) => revision + 1);
    window.addEventListener("popstate", refresh);
    return () => window.removeEventListener("popstate", refresh);
  }, [previewOverridesEnabled]);

  useEffect(() => {
    let cancelled = false;
    const preview = parseMoneyLevelPreviewOverrides(window.location.search, previewOverridesEnabled);
    const lastKnown = readLastKnownWeather();
    const seededWeather = resolveMoneyLevelSeededWeather(now);
    setState(buildDisplayState(
      now,
      lastKnown?.resolvedWeather ?? seededWeather,
      lastKnown,
      lastKnown ? "last-known" : "seeded",
      preview,
    ));

    void (async () => {
      try {
        const response = await fetch("/api/money-level/weather");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { data?: unknown };
        if (!isMoneyLevelMarketWeatherData(payload.data)) throw new Error("Invalid SPY weather payload");
        try {
          localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(payload.data));
        } catch (error) {
          if (process.env.NODE_ENV !== "production") console.warn("[Money Level] weather cache write failed", error);
        }
        if (!cancelled) setState(buildDisplayState(now, payload.data.resolvedWeather, payload.data, false, preview));
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[Money Level] using safe weather fallback", error);
      }
    })();

    return () => { cancelled = true; };
  }, [now, previewOverridesEnabled, previewRevision]);

  useEffect(() => {
    if (!previewOverridesEnabled) return;
    window.__MONEY_LEVEL_MARKET_WEATHER_DEBUG__ = () => state;
    return () => { delete window.__MONEY_LEVEL_MARKET_WEATHER_DEBUG__; };
  }, [previewOverridesEnabled, state]);

  return state;
}
