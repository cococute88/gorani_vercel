"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { fearGreedColor, fearGreedRating } from "@/lib/market-data";
import type { FearGreedData } from "@/lib/market-data";
import { TOOLTIP_STYLE } from "@/lib/chart-style";

interface Props {
  data: FearGreedData | null;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function FearGreedCard({ data }: Props) {
  if (!data) {
    return (
      <div className={card}>
        <h2 className="mb-3 text-[15px] font-bold text-slate-300">Fear &amp; Greed</h2>
        <div className="flex h-[160px] items-center justify-center text-[13px] text-slate-500">
          지수를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      </div>
    );
  }
  const rating = fearGreedRating(data.score);
  const color = fearGreedColor(data.score);

  return (
    <div className={card}>
      <h2 className="mb-3 text-[15px] font-bold text-slate-300">Fear &amp; Greed Index</h2>
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center">
          <div className="num text-[40px] font-black leading-none" style={scoreStyle(color)}>
            {data.score}
          </div>
          <div className="mt-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={ratingStyle(color)}>
            {rating}
          </div>
        </div>
        <div className="h-[120px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.history}>
              <YAxis domain={[0, 100]} hide />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function scoreStyle(color: string): { color: string } {
  return { color };
}
function ratingStyle(color: string): { background: string } {
  return { background: color };
}
