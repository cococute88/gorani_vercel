import { MARKET_TEMPERATURE_SUMMARY } from "@/lib/mock-market-data";
import MarketRiskCards from "./MarketRiskCards";
import MarketRsiChart from "./MarketRsiChart";

export default function MarketTemperatureSection() {
  const activeIndex = 2;

  return (
    <section className="mb-6 space-y-5">
      <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-blue-300">Market Temperature</p>
            <h2 className="mt-2 text-[20px] font-extrabold text-white">시장온도</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-400">
              {MARKET_TEMPERATURE_SUMMARY.description} 아래 RSI/VIX와 참고 시트를 함께 확인하세요.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-5 py-4 text-right">
            <div className="text-[13px] text-blue-100">온도 점수</div>
            <div className="mt-1 text-[30px] font-black text-white">{MARKET_TEMPERATURE_SUMMARY.score} / 100</div>
            <div className="text-[13px] font-bold text-blue-200">{MARKET_TEMPERATURE_SUMMARY.status}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2">
          {MARKET_TEMPERATURE_SUMMARY.bands.map((band, index) => (
            <div
              key={band}
              className={`flex items-center justify-center break-keep rounded-xl border px-1 py-2.5 text-center text-[10px] font-bold leading-tight sm:px-2 sm:py-3 sm:text-[11.5px] ${
                index === activeIndex
                  ? "border-blue-400 bg-blue-500 text-white"
                  : "border-[#2a3336] bg-[#151a1b] text-slate-500"
              }`}
            >
              {band}
            </div>
          ))}
        </div>
      </div>

      <MarketRiskCards />
      <MarketRsiChart />
    </section>
  );
}
