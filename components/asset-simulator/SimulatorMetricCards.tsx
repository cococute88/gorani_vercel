import MetricCard from "@/components/MetricCard";
import type { SimulatorSummary } from "@/lib/asset-simulator-types";
import { formatKoreanMoney } from "@/lib/format";

type Props = { summary: SimulatorSummary };

export default function SimulatorMetricCards({ summary }: Props) {
  const cards = [
    { label: "최종 명목 자산", value: formatKoreanMoney(summary.finalNominalAssets), sub: "Preview nominal", tone: "blue" as const },
    { label: "최종 실질 자산", value: formatKoreanMoney(summary.finalRealAssets), sub: "물가 반영", tone: "green" as const },
    { label: "은퇴 예상 연도", value: `${summary.expectedRetirementYear}년`, sub: "8년 적립 + 지연", tone: "orange" as const },
    { label: "월 예상 인출액", value: formatKoreanMoney(summary.monthlyWithdrawal), sub: "첫 인출 연도 기준", tone: "gray" as const },
    { label: "총 적립액", value: formatKoreanMoney(summary.totalContribution), sub: "계획표 합산", tone: "green" as const },
    { label: "총 인출액", value: formatKoreanMoney(summary.totalWithdrawal), sub: "Preview 합산", tone: "orange" as const },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </section>
  );
}
