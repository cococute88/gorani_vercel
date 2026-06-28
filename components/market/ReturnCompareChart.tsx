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
import {
  formatReturnPct,
  rebasePricesToAnchor,
  type ReturnComparePriceSeries,
} from "@/lib/market-return-compare";

// 차트가 상위 컴포넌트(범례)로 통지하는 "현재 화면 기준" 수익률.
//  - anchorDate: 화면 좌측 첫 봉의 날짜(= 0% 기준일).
//  - byKey: 종목별 현재(화면 우측 끝) 누적 수익률(%).
export type ActiveReturns = {
  anchorDate: string | null;
  byKey: Record<string, number | null>;
};

interface Props {
  /** 종목별 일별 종가 시계열(기간 슬라이스 적용). 차트가 화면 기준 0% 로 재계산. */
  series: ReturnComparePriceSeries[];
  /** 다크 테마 여부. 변경 시 차트를 재생성한다. */
  dark: boolean;
  /** 차트 클릭 시(드래그 팬 제외) 호출. 인라인 차트에서 상세 모달을 연다. */
  onClick?: () => void;
  /** 0% 기준선 표시 여부(기본 true). */
  showZeroLine?: boolean;
  /** 확대/축소/드래그로 기준점이 바뀔 때마다 현재 화면 기준 수익률을 통지. */
  onActiveReturns?: (active: ActiveReturns) => void;
}

type Palette = { text: string; grid: string; border: string };

function palette(dark: boolean): Palette {
  return dark
    ? { text: "#94a3b8", grid: "rgba(148,163,184,0.12)", border: "#2a3336" }
    : { text: "#64748b", grid: "rgba(100,116,139,0.14)", border: "#e2e8f0" };
}

// lightweight-charts 의 Time(문자열/숫자/BusinessDay) 을 "YYYY-MM-DD" 로 변환.
function timeToLabel(time: Time | undefined | null): string {
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
// - 휠 확대 / 드래그 패닝 / Crosshair / Hover Tooltip 지원.
// - 핵심: 확대/축소/이동 시 "화면 좌측 첫 봉"을 0% 기준일로 다시 잡아 세 종목을
//   동일 기준으로 재계산한다. 기준점이 바뀌면 우측 범례 수익률도 즉시 갱신된다.
//   재계산은 이미 로드된 종가만 사용하므로 추가 API 호출이 없다.
export default function ReturnCompareChart({
  series,
  dark,
  onClick,
  showZeroLine = true,
  onActiveReturns,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // 종목 key -> 라인 시리즈 api (생성 순서 고정).
  const seriesApiRef = useRef<Array<{ key: string; api: ISeriesApi<"Line"> }>>([]);
  const zeroLineRef = useRef<{ api: ISeriesApi<"Line">; line: IPriceLine } | null>(null);
  // 현재 기간의 종목별 종가(차트가 화면 기준으로 % 재계산할 원본).
  const pricesRef = useRef<Record<string, ReturnComparePriceSeries["prices"]>>({});
  // 마지막으로 적용한 기준일/우측끝(중복 재계산 방지).
  const lastAnchorRef = useRef<string | null>(null);
  const lastRightRef = useRef<string | null>(null);
  // 우리가 setData 로 유발한 range 이벤트를 무시하기 위한 가드.
  const applyingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const showZeroLineRef = useRef(showZeroLine);
  showZeroLineRef.current = showZeroLine;
  const darkRef = useRef(dark);
  darkRef.current = dark;
  const onClickRef = useRef<(() => void) | undefined>(onClick);
  onClickRef.current = onClick;
  const onActiveReturnsRef = useRef<Props["onActiveReturns"]>(onActiveReturns);
  onActiveReturnsRef.current = onActiveReturns;
  // 최신 series prop 을 ref 로 보관(차트 재생성 시 즉시 재적용).
  const latestSeriesRef = useRef<ReturnComparePriceSeries[]>(series);
  latestSeriesRef.current = series;

  const [hover, setHover] = useState<HoverState>(null);

  // 0% 기준선(점선)을 데이터가 있는 첫 시리즈에 부착/재부착한다.
  const attachZeroLine = useCallback((anchorApi: ISeriesApi<"Line"> | null) => {
    if (zeroLineRef.current) {
      try {
        zeroLineRef.current.api.removePriceLine(zeroLineRef.current.line);
      } catch {
        /* 이미 제거된 경우 무시 */
      }
      zeroLineRef.current = null;
    }
    if (showZeroLineRef.current && anchorApi) {
      const line = anchorApi.createPriceLine({
        price: 0,
        color: darkRef.current ? "#64748b" : "#94a3b8",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "0%",
      });
      zeroLineRef.current = { api: anchorApi, line };
    }
  }, []);

  // 화면 우측 끝 기준 각 종목의 현재 수익률(%)을 상위로 통지.
  const emitActive = useCallback((anchorDate: string | null, rightDate: string | null) => {
    const byKey: Record<string, number | null> = {};
    seriesApiRef.current.forEach(({ key }) => {
      const prices = pricesRef.current[key] ?? [];
      if (!prices.length) {
        byKey[key] = null;
        return;
      }
      const baseIdx = anchorDate
        ? Math.max(0, prices.findIndex((p) => p.date >= anchorDate))
        : 0;
      const base = prices[baseIdx]?.close ?? null;
      if (!base || base <= 0) {
        byKey[key] = null;
        return;
      }
      let latest: number | null = null;
      if (rightDate) {
        for (let i = prices.length - 1; i >= 0; i -= 1) {
          if (prices[i].date <= rightDate) {
            latest = prices[i].close;
            break;
          }
        }
      }
      if (latest == null) latest = prices[prices.length - 1]?.close ?? null;
      byKey[key] = latest != null ? Number(((latest / base - 1) * 100).toFixed(4)) : null;
    });
    onActiveReturnsRef.current?.({ anchorDate, byKey });
  }, []);

  // 현재 보이는 구간의 좌측 첫 봉을 기준일(0%)로 모든 종목을 다시 그린다.
  const rebaseToVisible = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const items = seriesApiRef.current;
    if (!items.length) return;

    // 보이는 시간 범위(없으면 전체 데이터 경계로 폴백).
    let anchorDate: string | null = null;
    let rightDate: string | null = null;
    const range = chart.timeScale().getVisibleRange();
    if (range) {
      anchorDate = timeToLabel(range.from) || null;
      rightDate = timeToLabel(range.to) || null;
    }
    if (!anchorDate || !rightDate) {
      for (const { key } of items) {
        const prices = pricesRef.current[key] ?? [];
        if (prices.length) {
          if (!anchorDate) anchorDate = prices[0].date;
          if (!rightDate) rightDate = prices[prices.length - 1].date;
          break;
        }
      }
    }

    const anchorChanged = anchorDate !== lastAnchorRef.current;
    const rightChanged = rightDate !== lastRightRef.current;
    if (!anchorChanged && !rightChanged) return;

    // 기준일이 바뀐 경우에만 라인 데이터를 다시 계산/적용(성능 최적화).
    if (anchorChanged) {
      applyingRef.current = true;
      let zeroAnchorApi: ISeriesApi<"Line"> | null = null;
      items.forEach(({ key, api }) => {
        const prices = pricesRef.current[key] ?? [];
        const pts = rebasePricesToAnchor(prices, anchorDate);
        api.setData(pts.map((p) => ({ time: p.date as Time, value: p.value })));
        if (pts.length && !zeroAnchorApi) zeroAnchorApi = api;
      });
      attachZeroLine(zeroAnchorApi);
      lastAnchorRef.current = anchorDate;
      // 다음 프레임에 가드 해제(setData 가 유발한 range 이벤트 무시).
      requestAnimationFrame(() => {
        applyingRef.current = false;
      });
    }

    lastRightRef.current = rightDate;
    emitActive(anchorDate, rightDate);
  }, [attachZeroLine, emitActive]);

  // range 변경(확대/축소/드래그) → rAF 로 합쳐 한 번만 재계산.
  const scheduleRebase = useCallback(() => {
    if (applyingRef.current) return;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      rebaseToVisible();
    });
  }, [rebaseToVisible]);

  // 새 기간 데이터 적용: 종가 저장 → 기간 시작=0% 로 초기 렌더 → 전체 맞춤(fitContent).
  const applyData = useCallback(
    (data: ReturnComparePriceSeries[]) => {
      const chart = chartRef.current;
      if (!chart) return;

      const map: Record<string, ReturnComparePriceSeries["prices"]> = {};
      data.forEach((s) => {
        map[s.key] = s.prices;
      });
      pricesRef.current = map;

      applyingRef.current = true;
      let zeroAnchorApi: ISeriesApi<"Line"> | null = null;
      let hasData = false;
      let globalFirst: string | null = null;
      seriesApiRef.current.forEach(({ key, api }) => {
        const s = data.find((d) => d.key === key);
        const prices = s?.prices ?? [];
        api.applyOptions({ color: s?.color ?? "#3b82f6" });
        const firstDate = prices[0]?.date ?? null;
        const pts = rebasePricesToAnchor(prices, firstDate);
        api.setData(pts.map((p) => ({ time: p.date as Time, value: p.value })));
        if (pts.length) {
          hasData = true;
          if (!zeroAnchorApi) zeroAnchorApi = api;
          if (!globalFirst) globalFirst = firstDate;
        }
      });
      attachZeroLine(zeroAnchorApi);

      // 기준일은 기간 시작으로 초기화(fitContent 후 좌측 첫 봉과 일치).
      lastAnchorRef.current = globalFirst;
      lastRightRef.current = null;

      if (hasData) chart.timeScale().fitContent();

      // fitContent 반영 후 우측 범례 동기화 + 가드 해제.
      requestAnimationFrame(() => {
        applyingRef.current = false;
        rebaseToVisible();
      });
    },
    [attachZeroLine, rebaseToVisible],
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
      timeScale: { borderColor: colors.border, rightOffset: 2, timeVisible: false, secondsVisible: false },
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
    lastAnchorRef.current = null;
    lastRightRef.current = null;

    // Crosshair 이동 → 동일 날짜의 세 종목 수익률을 모아 tooltip 에 반영.
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

    // 확대/축소/드래그 → 화면 좌측 첫 봉 기준으로 재계산.
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      scheduleRebase();
    });

    // 클릭(드래그 팬과 구분됨) → 상세 모달 열기.
    chart.subscribeClick(() => {
      onClickRef.current?.();
    });

    let resizeRaf: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      chart.applyOptions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      // 리사이즈 후에는 좌측에 빈 공간이 생기지 않도록 다시 전체를 맞춘다.
      // (lightweight-charts 는 리사이즈 시 우측 끝을 고정하므로 폭이 넓어지면
      //  좌측에 빈 구간이 노출된다 → 6M 등에서 "시작 구간이 비어 보이는" 원인.)
      if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        const hasData = seriesApiRef.current.some(
          ({ key }) => (pricesRef.current[key]?.length ?? 0) > 0,
        );
        if (hasData) chart.timeScale().fitContent();
      });
    });
    observer.observe(container);

    applyData(latestSeriesRef.current);

    return () => {
      observer.disconnect();
      if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesApiRef.current = [];
      zeroLineRef.current = null;
    };
  }, [dark, applyData, scheduleRebase]);

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
