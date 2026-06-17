"use client";

import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import type { IndexCandle } from "@/lib/market-index";

interface Props {
  candles: IndexCandle[];
  up: boolean;
  height?: number;
}

// Minimal area sparkline (no axes/grid) used inside each index card.
// Green when the period is up, red when down — matching the requirement.
export default function IndexSparkline({ candles, up, height = 72 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const color = up ? "#16a34a" : "#dc2626";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      height,
      width: container.clientWidth || 240,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "transparent", attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false, borderVisible: false },
      crosshair: { horzLine: { visible: false, labelVisible: false }, vertLine: { visible: false, labelVisible: false } },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addAreaSeries({
      lineColor: color,
      lineWidth: 2,
      topColor: up ? "rgba(22,163,74,0.28)" : "rgba(220,38,38,0.28)",
      bottomColor: up ? "rgba(22,163,74,0.01)" : "rgba(220,38,38,0.01)",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width: Math.floor(width) });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // height is stable per mount; color handled in the data effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.applyOptions({
      lineColor: color,
      topColor: up ? "rgba(22,163,74,0.28)" : "rgba(220,38,38,0.28)",
      bottomColor: up ? "rgba(22,163,74,0.01)" : "rgba(220,38,38,0.01)",
    });
    series.setData(
      candles.map((candle) => ({ time: candle.time as never, value: candle.close })),
    );
    chart.timeScale().fitContent();
  }, [candles, color, up]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
