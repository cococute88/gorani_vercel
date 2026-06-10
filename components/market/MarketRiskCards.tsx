import MetricCard from "@/components/MetricCard";
import { MARKET_RISK_CARDS } from "@/lib/mock-market-data";

export default function MarketRiskCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {MARKET_RISK_CARDS.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}
