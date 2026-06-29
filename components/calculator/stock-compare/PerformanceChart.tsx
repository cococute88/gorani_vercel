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
import { rebaseCompareSeries, resolveAnchorDate } from "@/lib/stock-compare/rebase";

// =============================================================
// TradingView 스타일 성과 비교 그래프(lightweight-charts).
// market/ReturnCompareChart 패턴을 4개 시리즈 + On/Off 범례로 일반화했다.
// - 휠 확대 / 드래그 패닝 / Crosshair / Hover Tooltip / fitContent
// - 범례 클릭으로 시리즈 On/Off, 부드러운 애니메이션(lightweight-charts 기본).
//
// TradingView Compare 스타일 기준점(0%) 재설정 (표시 레이어 전용)
//   - 사용자가 Zoom/Pan/Navigator/기간 변경으로 "보이는 첫 날짜"를 바꾸면,
//     그 날짜를 기준(0%)으로 모든 시리즈를 다시 계산해 표시한다.
//   - 원본 시리즈(props.series)는 변경하지 않고, lib/stock-compare/rebase 의
//     순수 함수로 "표시 데이터"만 선형 재기준화한다(추가 API 호출 없음).
//   - 보이는 영역의 왼쪽 끝 날짜를 anchor 로 잡으며, 확대를 해제(전체로 복귀)하면
//     anchor 가 다시 기간 시작점으로 돌아가 기간 기준 0% 로 정상 표시된다.
// =============================================================

interface Props {
  /**
   * 비교 시리즈의 "전체(MAX)" 누적수익률 시계열. 기간 버튼은 데이터를 다시
   * 만들지 않고 이 MAX 위에서 보이는 구간(viewDays)만 확대(Zoom)한다.
   */
  series: CompareSeries[];
  dark: boolean;
  hidden: Record<string, boolean>;
  /**
   * 보이는 기간(일). Infinity → MAX(전체). 기간 버튼 클릭 시 이 값만 바뀌며,
   * timeScale 의 보이는 범위만 [마지막일 − viewDays, 마지막일] 로 설정한다.
   */
  viewDays?: number;
}

const DAY_MS = 86_400_000;

function parseMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
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

export default function PerformanceChart({ series, dark, hidden, viewDays = Infinity }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesApiRef = useRef<Array<{ key: string; api: ISeriesApi<"Line"> }>>([]);
  const zeroLineRef = useRef<IPriceLine | null>(null);
  const latestRef = useRef<CompareSeries[]>(series);
  latestRef.current = series;
  const hiddenRef = useRef<Record<string, boolean>>(hidden);
  hiddenRef.current = hidden;
  // 현재 보이는 기간(일). Infinity → MAX. setVisibleRange 입력.
  const viewDaysRef = useRef<number>(viewDays);
  viewDaysRef.current = viewDays;
  // 현재 표시 기준점(0%) 날짜. null = 기간 시작점(원본) 기준.
  const anchorRef = useRef<string | null>(null);
  // 보이는 영역 변경 → 재기준화 처리 중 재진입(setData가 유발하는 추가 이벤트) 방지.
  const rebasingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [hover, setHover] = useState<HoverState>(null);

  // anchorDate 를 0% 로 재계산한 표시 데이터를 차트에 반영한다.
  //   fit=true  → 기간/옵션 변경·초기 진입 시 전체 화면에 맞춤(fitContent).
  //   fit=false → Zoom/Pan 중 재기준화: 보이는 시간 범위(x축)는 유지하고 값(y축)만 갱신.
  const applyData = useCallback(
    (data: CompareSeries[], hiddenMap: Record<string, boolean>, anchorDate: string | null, fit: boolean) => {
      const chart = chartRef.current;
      if (!chart) return;
      const display = rebaseCompareSeries(data, anchorDate);

      let zeroAnchor: ISeriesApi<"Line"> | null = null;
      let hasData = false;
      seriesApiRef.current.forEach(({ key, api }) => {
        const s = display.find((d) => d.key === key);
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
      if (fit && hasData) chart.timeScale().fitContent();
    },
    [dark],
  );

  // 보이는 영역(왼쪽 끝 날짜)이 바뀌면 그 날짜를 기준점으로 재계산한다.
  const handleVisibleRangeChange = useCallback(() => {
    if (rebasingRef.current) return;
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleRange();
    if (!range) return;
    const fromDate = timeToLabel(range.from);
    if (!fromDate) return;
    const nextAnchor = resolveAnchorDate(latestRef.current, fromDate);
    if (nextAnchor === anchorRef.current) return; // 기준점 변화 없음 → 재계산 생략.
    anchorRef.current = nextAnchor;
    rebasingRef.current = true;
    try {
      // 시간 범위(x축)는 유지하고 표시값(y축)만 anchor 기준으로 갱신.
      applyData(latestRef.current, hiddenRef.current, nextAnchor, false);
    } finally {
      rebasingRef.current = false;
    }
    setHover(null);
  }, [applyData]);

  // 이벤트 폭주(드래그/휠) 시 rAF 로 합쳐 한 프레임에 한 번만 재계산.
  const scheduleVisibleRangeCheck = useCallback(() => {
    if (rebasingRef.current) return;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      handleVisibleRangeChange();
    });
  }, [handleVisibleRangeChange]);

  // 보이는 구간(Zoom)을 viewDays 에 맞춘다. 데이터는 그대로 두고 timeScale 의
  // 보이는 범위만 [마지막일 − viewDays, 마지막일] 로 설정한다.
  //  - Infinity(MAX) 또는 기간이 전체보다 길면 → fitContent(전체 보기).
  //  - 그 외 → setVisibleRange 로 최근 구간만 확대. 발생하는 range 변경 이벤트가
  //    handleVisibleRangeChange 를 호출해 화면 좌측 첫 봉을 0% 로 재계산한다.
  const applyView = useCallback((days: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    let firstDate: string | null = null;
    let lastDate: string | null = null;
    for (const s of latestRef.current) {
      const ps = s.points;
      if (ps.length) {
        if (!firstDate || ps[0].date < firstDate) firstDate = ps[0].date;
        const ld = ps[ps.length - 1].date;
        if (!lastDate || ld > lastDate) lastDate = ld;
      }
    }
    if (!firstDate || !lastDate) return;
    if (!Number.isFinite(days)) {
      chart.timeScale().fitContent();
      return;
    }
    const fromMs = parseMs(lastDate) - days * DAY_MS;
    if (fromMs <= parseMs(firstDate)) {
      chart.timeScale().fitContent();
      return;
    }
    try {
      chart.timeScale().setVisibleRange({ from: toDateStr(fromMs) as Time, to: lastDate as Time });
    } catch {
      chart.timeScale().fitContent();
    }
  }, []);

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
    anchorRef.current = null;

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

    // Zoom/Pan/Navigator 등으로 보이는 영역이 바뀌면 기준점 재계산을 예약.
    chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleVisibleRangeCheck);

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) chart.applyOptions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(container);

    // 초기 렌더: MAX 데이터를 적용한 뒤 현재 viewDays 만큼 확대(Zoom).
    applyData(latestRef.current, hiddenRef.current, null, false);
    applyView(viewDaysRef.current);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleVisibleRangeCheck);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesApiRef.current = [];
      zeroLineRef.current = null;
    };
  }, [dark, applyData, applyView, scheduleVisibleRangeCheck]);

  // 기간/옵션/종목 변경(series) 시:
  //   기준점(anchor)을 초기화하고 MAX 데이터를 다시 적용한 뒤 현재 viewDays 로
  //   확대한다. setVisibleRange 가 유발하는 보이는 영역 변경 콜백이 anchor 를
  //   "보이는 첫 날짜(=기간 시작)"로 확정하여 항상 0% 에서 시작하게 한다.
  useEffect(() => {
    anchorRef.current = null;
    applyData(series, hiddenRef.current, null, false);
    applyView(viewDaysRef.current);
    setHover(null);
  }, [series, applyData, applyView]);

  // 기간 버튼(viewDays) 변경 시: 데이터는 그대로 두고 보이는 구간만 확대(Zoom).
  //   range 변경 이벤트가 anchor 를 다시 잡아 0% 기준을 갱신한다.
  useEffect(() => {
    applyView(viewDays);
  }, [viewDays, applyView]);

  // 범례 On/Off(hidden) 시: 현재 확대 상태와 기준점(anchor)을 유지한 채
  //   표시 여부만 갱신한다(zoom/0% 기준이 초기화되지 않도록 fit=false).
  useEffect(() => {
    applyData(latestRef.current, hidden, anchorRef.current, false);
    setHover(null);
  }, [hidden, applyData]);

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
