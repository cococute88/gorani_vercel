"use client";

import { useEffect, useState } from "react";
import {
  isMoneyLevelMarketWeatherData,
  type MoneyLevelMarketWeatherData,
} from "./market-weather";
import type { MoneyLevelWeather } from "./types";
import { resolveMoneyLevelSeededWeather } from "./weather";

const WEATHER_STORAGE_KEY = "gorani.money-level.weather.v1";
const PREVIEW_WEATHERS: readonly MoneyLevelWeather[] = ["sunny", "cloudy", "rain", "thunderstorm"];

export type MoneyLevelWeatherFallback = false | "last-known" | "seeded" | "forced-preview";

export type MoneyLevelWeatherState = {
  weather: MoneyLevelWeather;
  market: MoneyLevelMarketWeatherData | null;
  fallback: MoneyLevelWeatherFallback;
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

export function useMoneyLevelMarketWeather(fallbackDate: Date): MoneyLevelWeatherState {
  const [state, setState] = useState<MoneyLevelWeatherState>(() => ({
    weather: resolveMoneyLevelSeededWeather(fallbackDate),
    market: null,
    fallback: "seeded",
    debugEnabled: false,
  }));

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = process.env.NODE_ENV !== "production" && params.get("weatherdebug") === "1";
    const requestedPreview = params.get("weather") as MoneyLevelWeather | null;
    const forcedWeather = process.env.NODE_ENV !== "production" && requestedPreview && PREVIEW_WEATHERS.includes(requestedPreview)
      ? requestedPreview
      : null;
    const lastKnown = readLastKnownWeather();

    setState((current) => forcedWeather
      ? { weather: forcedWeather, market: lastKnown, fallback: "forced-preview", debugEnabled }
      : lastKnown
        ? { weather: lastKnown.resolvedWeather, market: lastKnown, fallback: "last-known", debugEnabled }
        : { ...current, debugEnabled });

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
            debugEnabled,
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[Money Level] using safe weather fallback", error);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__MONEY_LEVEL_MARKET_WEATHER_DEBUG__ = () => state;
    return () => { delete window.__MONEY_LEVEL_MARKET_WEATHER_DEBUG__; };
  }, [state]);

  return state;
}
