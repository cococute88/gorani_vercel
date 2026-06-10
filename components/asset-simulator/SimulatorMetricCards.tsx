import MetricCard from "@/components/MetricCard";
import type { SimulatorSummary } from "@/lib/asset-simulator-types";
import { formatManwonMoney } from "@/lib/format";

type Props = { summary: SimulatorSummary };

export default function SimulatorMetricCards({ summary }: Props) {
  const cards = [
    { label: "최종 명목 잔고(인출X)", value: formatManwonMoney(summary.finalNominalWithoutWithdrawal), sub: "절세계좌 기준", tone: "blue" as const },
    { label: "최종 실질 잔고(인출X)", value: formatManwonMoney(summary.finalRealWithoutWithdrawal), sub: "물가 반영", tone: "green" as const },
    { label: "합산 명목 잔고(절세+배당위탁)", value: formatManwonMoney(summary.combinedNominalBalance), sub: "절세계좌 + 위탁", tone: "orange" as const },
    { label: "합산 실질 잔고(절세+배당위탁)", value: formatManwonMoney(summary.combinedRealBalance), sub: "물가 반영", tone: "green" as const },
    { label: "은퇴년도", value: summary.retirementYear ? `${summary.retirementYear}년` : "-", sub: summary.actualWithdrawalStartYear ? `인출 ${summary.actualWithdrawalStartYear}년~` : "계획표 기준", tone: "gray" as const },
    { label: "연금저축 한도", value: formatManwonMoney(summary.pensionLimit), sub: "연간 납입 한도", tone: "blue" as const },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </section>
  );
}
