import { WATCHLIST } from "@/lib/mockData";
import { ChevronRight } from "lucide-react";

type Props = { theme?: "dark" | "light" };

// 관심종목 가로 나열 row (다크에서 조밀한 작은 카드).
export default function WatchlistRow({ theme = "light" }: Props) {
  const isLight = theme === "light";
  const cardCls = isLight
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-[#191f20] border border-[#2a3336]";
  const title = isLight ? "text-slate-800" : "text-slate-200";
  const sub = isLight ? "text-slate-500" : "text-slate-400";
  const itemCls = isLight
    ? "bg-slate-50 border border-slate-200"
    : "bg-[#171c1d] border border-[#2a3336]";
  const nameCls = isLight ? "text-slate-700" : "text-slate-300";
  const priceCls = isLight ? "text-slate-900" : "text-slate-100";

  return (
    <div className={`rounded-2xl p-4 ${cardCls}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className={`text-[14px] font-bold ${title}`}>관심종목</span>
        <button
          className={`flex items-center gap-0.5 text-[12px] ${sub} hover:text-blue-500`}
        >
          관리 <ChevronRight size={13} />
        </button>
      </div>
      <div
        className={`flex gap-2 overflow-x-auto pb-1 ${isLight ? "scroll-light" : "scroll-dark"}`}
      >
        {WATCHLIST.map((w) => {
          const chgStyle = { color: w.up ? "#e5484d" : "#3b82f6" };
          return (
            <div
              key={w.name}
              className={`flex min-w-[140px] flex-col gap-1 rounded-lg px-3 py-2 ${itemCls}`}
            >
              <span
                className={`line-clamp-2 text-[11px] font-semibold leading-snug ${nameCls}`}
              >
                {w.name}
              </span>
              <div className="flex items-center justify-between">
                <span className={`num text-[12px] font-bold ${priceCls}`}>
                  {w.price}
                </span>
                <span
                  className="num text-[11px] font-semibold"
                  style={chgStyle}
                >
                  {w.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
