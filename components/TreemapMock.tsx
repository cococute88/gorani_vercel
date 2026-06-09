import { TREEMAP_DATA, TreemapItem } from "@/lib/mockData";

// CSS flex 기반 MOCK 트리맵. 항목 value에 비례해 면적을 나눈다.
function rateColor(rate: number): string {
  if (rate >= 50) return "#b91c1c";
  if (rate >= 20) return "#dc2626";
  if (rate >= 5) return "#ef4444";
  if (rate >= 0) return "#7f1d1d";
  if (rate >= -5) return "#1e3a8a";
  return "#1d4ed8";
}

function Group({ title, items }: { title: string; items: TreemapItem[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col box-border">
      <div className="mb-1.5 text-[12px] font-semibold text-slate-400">
        {title}
      </div>
      <div className="flex min-w-0 w-full max-w-full flex-wrap gap-1 overflow-hidden">
        {items.map((it) => {
          const pct = (it.value / total) * 100;
          const tileStyle = {
            backgroundColor: rateColor(it.rate),
            flex: `${it.value} 1 clamp(96px, ${pct.toFixed(1)}%, 100%)`,
            minHeight: it.value >= 8 ? 78 : 58,
          };

          return (
            <div
              key={it.name}
              className="box-border flex min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-md p-2 text-white"
              style={tileStyle}
            >
              <span className="truncate text-[12px] font-bold leading-tight">
                {it.name}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="num truncate text-[12px] font-extrabold">
                  {it.rate > 0 ? "+" : ""}
                  {it.rate.toFixed(1)}%
                </div>
                <div className="num truncate text-[10px] text-white/80">
                  {it.amount}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TreemapMock() {
  const dividend = TREEMAP_DATA.filter((d) => d.group === "배당");
  const growth = TREEMAP_DATA.filter((d) => d.group === "성장");

  return (
    <div className="box-border min-h-[300px] w-full max-w-full min-w-0 overflow-x-hidden rounded-2xl border border-[#2a3336] bg-[#191f20] p-4 sm:min-h-[320px]">
      <div className="mb-3 text-[14px] font-bold text-slate-100">
        배당 / 성장 트리맵
      </div>
      <div className="flex min-w-0 w-full max-w-full flex-col gap-4">
        <Group title="배당" items={dividend} />
        <Group title="성장" items={growth} />
      </div>
    </div>
  );
}
