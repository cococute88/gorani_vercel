"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { fearGreedColor, fearGreedRating } from "@/lib/market-data";
import type { BriefingItem, FearGreedData } from "@/lib/market-data";
import { TOOLTIP_STYLE } from "@/lib/chart-style";

interface Props {
  fearGreed: FearGreedData | null;
  briefing: BriefingItem[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-4";
const FNG_BANDS = ["극단적 공포", "공포", "중립", "탐욕", "극단적 탐욕"];
const FNG_GRADIENT =
  "linear-gradient(90deg, #ef4444 0%, #f97316 25%, #eab308 50%, #84cc16 70%, #22c55e 100%)";

// 원본 Streamlit 시장온도 상단 구조: 왼쪽 큰 공포&탐욕 카드 + 오른쪽 지수/매크로 카드.
export default function MarketTopBriefing({ fearGreed, briefing }: Props) {
  // 큰 카드로 대체되는 Fear & Greed 항목은 우측 카드 그리드에서 제외한다.
  const cards = briefing.filter((item) => item.key !== "fng");

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[15px] font-bold text-slate-300">시장 브리핑</h2>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
        <FngCard data={fearGreed} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.length === 0 && (
            <div className="col-span-full rounded-xl border border-[#2a3336] bg-[#191f20] p-4 text-center text-[13px] text-slate-500">
              시장 데이터를 불러오지 못했습니다.
            </div>
          )}
          {cards.map((it) => (
            <div key={it.key} className={card}>
              <div className="truncate text-[12px] text-slate-400">{it.label}</div>
              <div className="num mt-1.5 text-[18px] font-extrabold text-white">{it.value}</div>
              <div className={`num mt-1 text-[12.5px] font-semibold ${it.up ? "text-red-400" : "text-blue-400"}`}>
                {it.up ? "▲" : "▼"} {Math.abs(it.changePct).toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FngCard({ data }: { data: FearGreedData | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
        <h3 className="mb-3 text-[15px] font-bold text-slate-300">공포 &amp; 탐욕 지수</h3>
        <div className="flex h-[200px] items-center justify-center text-center text-[13px] text-slate-500">
          지수를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      </div>
    );
  }

  const rating = fearGreedRating(data.score);
  const color = fearGreedColor(data.score);
  const markerLeft = Math.max(0, Math.min(100, data.score));

  return (
    <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-slate-300">공포 &amp; 탐욕 지수</h3>
        <span className="shrink-0 text-[11px] text-slate-500">CNN Fear &amp; Greed</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="num text-[44px] font-black leading-none" style={{ color }}>
          {data.score}
        </span>
        <span className="text-[15px] font-bold" style={{ color }}>
          {rating}
        </span>
      </div>

      {/* 그라데이션 게이지 + 현재 점수 마커 */}
      <div className="relative mt-4 h-[14px] overflow-hidden rounded-full" style={{ background: FNG_GRADIENT }}>
        <div
          className="absolute top-[-3px] h-[20px] w-[4px] -translate-x-1/2 rounded-full bg-white shadow"
          style={{ left: `${markerLeft}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] leading-tight text-slate-500">
        {FNG_BANDS.map((band) => (
          <span key={band} className="break-keep">
            {band}
          </span>
        ))}
      </div>

      {/* 히스토리 추이 */}
      <div className="mt-4 h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.history}>
            <YAxis domain={[0, 100]} hide />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
