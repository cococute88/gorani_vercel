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
import { formatReturnPct, type ReturnCompareSeries } from "@/lib/market-return-compare";

interface Props {
  /** 종목별 누적 수익률 시계열(기준일 0%). */
  series: ReturnCompareSeries[];
  /** 다크 테마 여부. 변경 시 차트를 재생성한다. */
  dark: boolean;
  /** 차트 클릭 시(드래그 팬 제외) 호출. 인라인 차트에서 상세 모달을 연다. */
  onClick?: () => void;
  /** 0% 기준선 표시 여부(기본 true). */
  showZeroLine?: boolean;
}

type Palette = { text: string; grid: string; border: string };

function palette(dark: boolean): Palette {
  return dark
    ? { text: "#94a3b8", grid: "rgba(148,163,184,0.12)", border: "#2a3336" }
    : { text: "#64748b", grid: "rgba(100,116,139,0.14)", border: "#e2e8f0" };
}

// lightweight-charts 의 Time(문자열/숫자/BusinessDay) 을 "YYYY-MM-DD" 로 변환.
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

// TradingView 스타일 누적 수익률 비교 라인 차트.
// - 휠 확대 / 드래그 패닝 / Crosshair / Hover Tooltip 지원(lightweight-charts 기본).
// - 좌상단 범례에 현재(또는 hover 중인) 수익률을 종목 색상과 함께 표시.
export default function ReturnCompareChart({ series, dark, onClick, showZeroLine = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // 종목 key -> 라인 시리즈 api (생성 순서 고정).
  const seriesApiRef = useRef<Array<{ key: string; api: ISeriesApi<"Line"> }>>([]);
  const zeroLineRef = useRef<IPriceLine | null>(null);
  // 최신 series prop 을 ref 로 보관(차트 재생성 시 즉시 재적용).
  const latestSeriesRef = useRef<ReturnCompareSeries[]>(series);
  latestSeriesRef.current = series;
  const onClickRef = useRef<(() => void) | undefined>(onClick);
  onClickRef.current = onClick;

  const [hover, setHover] = useState<HoverState>(null);

  // 현재 종목별 데이터를 차트에 반영하고 X축을 선택 구간에 맞춘다.
  const applyData = useCallback(
    (data: ReturnCompareSeries[]) => {
      const chart = chartRef.current;
      if (!chart) return;
      let zeroAnchor: ISeriesApi<"Line"> | null = null;
      let hasData = false;
      seriesApiRef.current.forEach(({ key, api }) => {
        const s = data.find((d) => d.key === key);
        const points = s?.points ?? [];
        api.applyOptions({ color: s?.color ?? "#3b82f6" });
        api.setData(points.map((p) => ({ time: p.date as Time, value: p.value })));
        if (points.length > 0) {
          hasData = true;
          if (!zeroAnchor) zeroAnchor = api;
        }
      });

      // 0% 기준선(점선)을 데이터가 있는 첫 시리즈에 부착한다.
      if (zeroLineRef.current) {
        const prevAnchor = seriesApiRef.current[0]?.api;
        try {
          prevAnchor?.removePriceLine(zeroLineRef.current);
        } catch {
          /* 이미 제거된 경우 무시 */
        }
        zeroLineRef.current = null;
      }
      if (showZeroLine && zeroAnchor) {
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
    [dark, showZeroLine],
  );

  // 차트 생성(테마 변경 시 재생성).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const colors = palette(dark);

    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: container.clientHeight || 320,
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
      localization: { priceFormatter: (price: number) => formatReturnPct(price, 1) },
      handleScroll: true,
      handleScale: true,
    });

    const apis: Array<{ key: string; api: ISeriesApi<"Line"> }> = [];
    latestSeriesRef.current.forEach((s) => {
      const api = chart.addLineSeries({
        color: s.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
      });
      apis.push({ key: s.key, api });
    });

    chartRef.current = chart;
    seriesApiRef.current = apis;
    zeroLineRef.current = null;

    // Crosshair 이동 → 동일 날짜의 세 종목 수익률을 모아 tooltip/범례에 반영.
    chart.subscribeCrosshairMove((param) => {
      if (param.time === undefined || !param.point) {
        setHover(null);
        return;
      }
      const rows: HoverRow[] = seriesApiRef.current.map(({ key, api }) => {
        const s = latestSeriesRef.current.find((d) => d.key === key);
        const bar = param.seriesData.get(api) as { value?: number } | undefined;
        return {
          key,
          label: s?.label ?? key,
          color: s?.color ?? "#3b82f6",
          value: bar && typeof bar.value === "number" ? bar.value : null,
        };
      });
      if (rows.every((r) => r.value === null)) {
        setHover(null);
        return;
      }
      setHover({ x: param.point.x, y: param.point.y, date: timeToLabel(param.time), rows });
    });

    // 클릭(드래그 팬과 구분됨) → 상세 모달 열기.
    chart.subscribeClick(() => {
      onClickRef.current?.();
    });

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) chart.applyOptions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(container);

    applyData(latestSeriesRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesApiRef.current = [];
      zeroLineRef.current = null;
    };
  }, [dark, applyData]);

  // series prop 변경 시 데이터 갱신(기간 변경 등).
  useEffect(() => {
    applyData(series);
    setHover(null);
  }, [series, applyData]);

  // tooltip 위치: 커서 오른쪽이 잘리면 왼쪽으로 띄운다.
  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const tooltipOnLeft = hover ? hover.x > containerWidth * 0.6 : false;

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className={`absolute inset-0 ${onClick ? "cursor-pointer" : ""}`}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-[148px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur dark:border-[#2a3336] dark:bg-[#1e2324]/95"
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
                  {formatReturnPct(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
