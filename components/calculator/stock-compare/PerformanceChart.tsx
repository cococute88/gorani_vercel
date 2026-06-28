"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { CompareSeries } from "@/lib/stock-compare/types";
import { formatSignedPct } from "@/lib/stock-compare/constants";

// =============================================================
// TradingView 스타일 성과 비교 그래프(lightweight-charts).
// market/ReturnCompareChart 패턴을 4개 시리즈 + On/Off 범례로 일반화했다.
// - 휠 확대 / 드래그 패닝 / Crosshair / Hover Tooltip / fitContent
// - 범례 클릭으로 시리즈 On/Off, 부드러운 애니메이션(lightweight-charts 기본).
// =============================================================

interface Props {
  series: CompareSeries[];
  dark: boolean;
  hidden: Record<string, boolean>;
}

function palette(dark: boolean) {
  return dark
    ? { text: "#94a3b8", grid: "rgba(148,163,184,0.12)", border: "#2a3336" }
    : { text: "#64748b", grid: "rgba(100,116,139,0.14)", border: "#e2e8f0" };
}

function timeToLabel(time: Time | undefined): string {
  if (time == null) return "";
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  if (typeof time === "object" && "year" in time) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${time.year}-${pad(time.month)}-${pad(time.day)}`;
  }
  return String(time);
}

type HoverRow = { key: string; label: string; color: string; value: number | null };
type HoverState = { x: number; y: number; date: string; rows: HoverRow[] } | null;

export default function PerformanceChart({ series, dark, hidden }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesApiRef = useRef<Array<{ key: string; api: ISeriesApi<"Line"> }>>([]);
  const zeroLineRef = useRef<IPriceLine | null>(null);
  const latestRef = useRef<CompareSeries[]>(series);
  latestRef.current = series;
  const hiddenRef = useRef<Record<string, boolean>>(hidden);
  hiddenRef.current = hidden;

  const [hover, setHover] = useState<HoverState>(null);

  const applyData = useCallback(
    (data: CompareSeries[], hiddenMap: Record<string, boolean>) => {
      const chart = chartRef.current;
      if (!chart) return;
      let zeroAnchor: ISeriesApi<"Line"> | null = null;
      let hasData = false;
      seriesApiRef.current.forEach(({ key, api }) => {
        const s = data.find((d) => d.key === key);
        const isHidden = hiddenMap[key];
        const points = !isHidden && s ? s.points : [];
        api.applyOptions({ color: s?.color ?? "#3b82f6", visible: !isHidden });
        api.setData(points.map((p) => ({ time: p.date as Time, value: p.value })));
        if (points.length > 0) {
          hasData = true;
          if (!zeroAnchor) zeroAnchor = api;
        }
      });

      if (zeroLineRef.current) {
        try {
          seriesApiRef.current[0]?.api.removePriceLine(zeroLineRef.current);
        } catch {
          /* 이미 제거됨 */
        }
        zeroLineRef.current = null;
      }
      if (zeroAnchor) {
        zeroLineRef.current = (zeroAnchor as ISeriesApi<"Line">).createPriceLine({
          price: 0,
          color: dark ? "#64748b" : "#94a3b8",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "0%",
        });
      }
      if (hasData) chart.timeScale().fitContent();
    },
    [dark],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const colors = palette(dark);

    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: container.clientHeight || 360,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.12, bottom: 0.1 } },
      timeScale: { borderColor: colors.border, rightOffset: 4, timeVisible: false, secondsVisible: false },
      localization: { priceFormatter: (price: number) => formatSignedPct(price, 1) },
      handleScroll: true,
      handleScale: true,
    });

    const apis: Array<{ key: string; api: ISeriesApi<"Line"> }> = [];
    // 시리즈 생성 순서를 고정(a,b,aEx,bEx). 누락 시 빈 라인으로 보유.
    (["a", "b", "aEx", "bEx"] as const).forEach((key) => {
      const s = latestRef.current.find((d) => d.key === key);
      const api = chart.addLineSeries({
        color: s?.color ?? "#3b82f6",
        lineWidth: 2,
        lineStyle: key === "aEx" || key === "bEx" ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
      });
      apis.push({ key, api });
    });

    chartRef.current = chart;
    seriesApiRef.current = apis;
    zeroLineRef.current = null;

    chart.subscribeCrosshairMove((param) => {
      if (param.time === undefined || !param.point) {
        setHover(null);
        return;
      }
      const rows: HoverRow[] = seriesApiRef.current
        .filter(({ key }) => !hiddenRef.current[key] && latestRef.current.some((d) => d.key === key))
        .map(({ key, api }) => {
          const s = latestRef.current.find((d) => d.key === key);
          const bar = param.seriesData.get(api) as { value?: number } | undefined;
          return {
            key,
            label: s?.label ?? key,
            color: s?.color ?? "#3b82f6",
            value: bar && typeof bar.value === "number" ? bar.value : null,
          };
        });
      if (rows.length === 0 || rows.every((r) => r.value === null)) {
        setHover(null);
        return;
      }
      setHover({ x: param.point.x, y: param.point.y, date: timeToLabel(param.time), rows });
    });

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) chart.applyOptions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(container);

    applyData(latestRef.current, hiddenRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesApiRef.current = [];
      zeroLineRef.current = null;
    };
  }, [dark, applyData]);

  useEffect(() => {
    applyData(series, hidden);
    setHover(null);
  }, [series, hidden, applyData]);

  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const tooltipOnLeft = hover ? hover.x > containerWidth * 0.6 : false;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-[168px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur dark:border-[#2a3336] dark:bg-[#1e2324]/95"
          style={{
            left: tooltipOnLeft ? undefined : Math.max(0, hover.x + 14),
            right: tooltipOnLeft ? Math.max(0, containerWidth - hover.x + 14) : undefined,
            top: 8,
          }}
        >
          <div className="mb-1 font-semibold text-slate-500 dark:text-slate-400">{hover.date}</div>
          <div className="space-y-0.5">
            {hover.rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{row.label}</span>
                </span>
                <span
                  className="num font-bold"
                  style={{ color: row.value != null && row.value < 0 ? "#dc2626" : "#16a34a" }}
                >
                  {formatSignedPct(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
