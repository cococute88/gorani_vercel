"use client";

import { useEffect, useRef, useState } from "react";

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// TradingView 미국주식 섹터 트리맵 위젯.
// 스크립트 주입이 실패하면 placeholder 카드로 대체해 페이지가 깨지지 않도록 함.
// TODO(codex): 필요 시 자체 섬네일 데이터로 교체.
export default function TradingViewTreemap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    try {
      el.innerHTML = "";
      const widget = document.createElement("div");
      widget.className = "tradingview-widget-container__widget";
      el.appendChild(widget);

      const script = document.createElement("script");
      script.src =
        "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        exchanges: [],
        dataSource: "SPX500",
        grouping: "sector",
        blockColor: "change",
        locale: "kr",
        symbolUrl: "",
        colorTheme: "dark",
        hasTopBar: false,
        isDataSetEnabled: false,
        isZoomEnabled: true,
        hasSymbolTooltip: true,
        width: "100%",
        height: 360,
      });
      script.onerror = () => {
        if (!cancelled) setFailed(true);
      };
      el.appendChild(script);
    } catch {
      if (!cancelled) setFailed(true);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mb-6">
      <div className={card}>
        <h2 className="mb-4 text-[15px] font-bold text-slate-300">미국주식 섹터 트리맵</h2>
        {failed ? (
          <div className="flex h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[#2a3336] text-center">
            <div className="text-[14px] font-semibold text-slate-300">TradingView treemap placeholder</div>
            <div className="mt-1 text-[12.5px] text-slate-500">
              위젯을 불러올 수 없습니다. 네트워크 환경을 확인해 주세요.
            </div>
          </div>
        ) : (
          <div className="tradingview-widget-container" ref={containerRef} style={TV_HEIGHT} />
        )}
      </div>
    </section>
  );
}

const TV_HEIGHT = { height: 360 };
