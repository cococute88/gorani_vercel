"use client";

import { useEffect, useState } from "react";
import {
  isMoneyLevelMarketWeatherData,
  type MoneyLevelMarketWeatherData,
} from "./market-weather";
import { parseMoneyLevelPreviewOverrides } from "./preview";
import type { MoneyLevelTimeOfDay, MoneyLevelWeather } from "./types";
import { resolveMoneyLevelSeededWeather, resolveMoneyLevelTimeOfDay } from "./weather";

const WEATHER_STORAGE_KEY = "gorani.money-level.weather.v1";

export type MoneyLevelWeatherFallback = false | "last-known" | "seeded" | "forced-preview";

export type MoneyLevelWeatherState = {
  weather: MoneyLevelWeather;
  market: MoneyLevelMarketWeatherData | null;
  fallback: MoneyLevelWeatherFallback;
  timeOfDay: MoneyLevelTimeOfDay;
  previewActive: boolean;
  debugEnabled: boolean;
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

export function useMoneyLevelMarketWeather(
  fallbackDate: Date,
  previewOverridesEnabled: boolean,
): MoneyLevelWeatherState {
  const fallbackTime = resolveMoneyLevelTimeOfDay(fallbackDate);
  const [state, setState] = useState<MoneyLevelWeatherState>(() => ({
    weather: resolveMoneyLevelSeededWeather(fallbackDate),
    market: null,
    fallback: "seeded",
    timeOfDay: fallbackTime,
    previewActive: false,
    debugEnabled: false,
  }));

  useEffect(() => {
    let cancelled = false;
    const preview = parseMoneyLevelPreviewOverrides(window.location.search, previewOverridesEnabled);
    const forcedWeather = preview.weather;
    const previewActive = Boolean(preview.weather || preview.time);
    const lastKnown = readLastKnownWeather();

    setState((current) => forcedWeather
      ? {
        weather: forcedWeather,
        market: lastKnown,
        fallback: "forced-preview",
        timeOfDay: preview.time ?? fallbackTime,
        previewActive,
        debugEnabled: preview.debug,
      }
      : lastKnown
        ? {
          weather: lastKnown.resolvedWeather,
          market: lastKnown,
          fallback: "last-known",
          timeOfDay: preview.time ?? fallbackTime,
          previewActive,
          debugEnabled: preview.debug,
        }
        : {
          ...current,
          timeOfDay: preview.time ?? fallbackTime,
          previewActive,
          debugEnabled: preview.debug,
        });

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
        if (!cancelled) {
          setState({
            weather: forcedWeather ?? payload.data.resolvedWeather,
            market: payload.data,
            fallback: forcedWeather ? "forced-preview" : false,
            timeOfDay: preview.time ?? fallbackTime,
            previewActive,
            debugEnabled: preview.debug,
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[Money Level] using safe weather fallback", error);
      }
    })();

    return () => { cancelled = true; };
  }, [fallbackTime, previewOverridesEnabled]);

  useEffect(() => {
    if (!previewOverridesEnabled) return;
    window.__MONEY_LEVEL_MARKET_WEATHER_DEBUG__ = () => state;
    return () => { delete window.__MONEY_LEVEL_MARKET_WEATHER_DEBUG__; };
  }, [previewOverridesEnabled, state]);

  return state;
}
