import { Ticker } from "@/lib/mockData";

// 미니 스파크라인을 실제 SVG path로 그린다 (이미지 사용 안 함).
function Sparkline({
  data,
  color,
  w = 90,
  h = 34,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((d, i) => {
    const x = i * step;
    const y = h - ((d - min) / range) * (h - 4) - 2;
    return [x, y] as [number, number];
  });
  const line = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = `g-${color.replace("#", "")}-${data[0]}-${data[data.length - 1]}-${w}`;
  const gradUrl = `url(#${id})`;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={gradUrl} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = { ticker: Ticker; theme?: "dark" | "light" };

export default function MiniTickerCard({ ticker, theme = "light" }: Props) {
  const isLight = theme === "light";
  // 국내 관습: 상승 빨강 / 하락 파랑
  const color = ticker.up ? "#e5484d" : "#3b82f6";
  const changeStyle = { color };

  if (isLight) {
    return (
      <div className="flex min-w-[150px] flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
        <span className="truncate text-[12px] font-medium text-slate-500">
          {ticker.name}
        </span>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="num text-[16px] font-bold text-slate-900">
              {ticker.value}
            </div>
            <div className="num text-[12px] font-semibold" style={changeStyle}>
              {ticker.change}
            </div>
          </div>
          <Sparkline data={ticker.spark} color={color} />
        </div>
      </div>
    );
  }

  // 다크: 작고 가로로 긴 카드 + 금색 border
  return (
    <div className="flex min-w-[150px] items-center gap-2 rounded-lg border border-[#5a4a22] bg-[#171c1d] px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10.5px] text-slate-400">
          {ticker.name}
        </div>
        <div className="num text-[12.5px] font-bold text-slate-100">
          {ticker.value}
        </div>
      </div>
      <Sparkline data={ticker.spark} color={color} w={46} h={20} />
      <div
        className="num w-12 shrink-0 text-right text-[11px] font-semibold"
        style={changeStyle}
      >
        {ticker.change}
      </div>
    </div>
  );
}
