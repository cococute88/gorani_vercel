"use client";

import { Info, Layers } from "lucide-react";
import type { HoldingsStatus, OverlapResult, ReturnCorrelationResult } from "@/lib/stock-compare/types";

// =============================================================
// 구성종목 중복 분석.
//
// 카드 의미가 겹치지 않도록 두 묶음으로 단순화한다.
//  - 왼쪽: "얼마나 겹치나" → 종목 개수 기준 중복도 / 실제 비중 기준 중복도
//  - 오른쪽: "각 ETF 안에서 공통 종목이 차지하는 비중" → A / B 비중 막대
// 비중을 반드시 반영하며, 개수 기준 수치는 참고용임을 명확히 표기한다.
// =============================================================

interface Props {
  tickerA: string;
  tickerB: string;
  overlap: OverlapResult;
  correlation: ReturnCorrelationResult | null;
  correlationMode: "TR" | "PR";
  correlationState: "idle" | "loading" | "ready";
}

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const subCard = "rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2a3336] dark:bg-[#11171a]";

// 한 티커의 조회 상태를 사용자 안내 문구로 변환한다(원인 구분).
function describeUnavailable(ticker: string, status: HoldingsStatus): string | null {
  switch (status) {
    case "unsupported":
      return `${ticker} 는 아직 구성종목(Holdings) 데이터가 준비되지 않은 ETF 입니다.`;
    case "stock":
      return `${ticker} 는 개별 종목이거나 인식되지 않은 티커로, 구성종목 개념이 없습니다.`;
    default:
      return null;
  }
}

function buildUnavailableMessage(tickerA: string, tickerB: string, overlap: OverlapResult): string {
  const lines = [
    describeUnavailable(tickerA, overlap.statusA),
    describeUnavailable(tickerB, overlap.statusB),
  ].filter((v): v is string => Boolean(v));
  const detail = lines.length > 0 ? ` ${lines.join(" ")}` : "";
  return `${tickerA} 와 ${tickerB} 의 구성종목(Holdings) 중복 분석을 제공할 수 없습니다.${detail} 성과·위험지표 비교는 정상적으로 제공됩니다.`;
}

function MetricLine({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="num mt-0.5 text-[22px] font-extrabold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-slate-400">{hint}</div>
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        <span className="num font-bold text-slate-900 dark:text-white">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#222a2c]">
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function CorrelationMetric({
  result,
  mode,
  state,
}: {
  result: ReturnCorrelationResult | null;
  mode: "TR" | "PR";
  state: Props["correlationState"];
}) {
  const calculating = state === "loading";
  const idle = state === "idle";
  const correlationValue = state === "ready" && result?.status === "ok" ? result.correlation : null;
  const available = correlationValue != null;
  const value = calculating
    ? "계산 중…"
    : idle
      ? "비교 후 계산"
      : available
        ? correlationValue.toFixed(3)
        : "계산 불가";
  const reason = result?.status === "zero-variance"
    ? "일별 수익률의 변동이 없어 계산할 수 없습니다."
    : result?.status === "invalid-result"
      ? "상관계수를 계산할 수 없습니다."
      : "공통 거래일 데이터가 부족합니다.";

  return (
    <div className={`${subCard} mb-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <details className="group">
            <summary
              className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="수익률 상관계수 도움말"
            >
              <h3 className="text-[12.5px] font-bold text-slate-700 dark:text-slate-200">수익률 상관계수</h3>
              <Info className="h-3.5 w-3.5" />
            </summary>
            <div className="mt-2 max-w-2xl rounded-lg border border-slate-200 bg-white p-3 text-[11.5px] leading-relaxed text-slate-500 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20] dark:text-slate-400">
              <p>+1에 가까울수록 같은 방향과 비슷한 폭으로, -1에 가까울수록 반대 방향으로 움직이는 경향이 강합니다. 0에 가까우면 일별 움직임의 선형 관계가 약합니다.</p>
              <p className="mt-1.5">상관계수는 수익률 수준이나 미래 성과를 뜻하지 않으며, 구성종목 중복도와는 별개의 지표입니다.</p>
            </div>
          </details>
          <div className="num mt-1 text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</div>
        </div>
        <div className="min-w-0 basis-full text-left sm:basis-auto sm:text-right">
          <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">선택 기간의 일별 {mode} 수익률 기준</p>
          {state === "ready" && result && (
            <p className="mt-1 text-[11.5px] text-slate-400">공통 거래일 {result.observations}일</p>
          )}
        </div>
      </div>
      {!calculating && !idle && !available && <p className="mt-2 text-[11.5px] text-slate-400">{reason}</p>}
      {idle && <p className="mt-2 text-[11.5px] text-slate-400">변경한 티커로 비교를 실행하면 다시 계산합니다.</p>}
      <div className="mt-3 border-t border-slate-200 pt-3 text-[11.5px] leading-relaxed text-slate-500 dark:border-[#2a3336] dark:text-slate-400">
        <p>두 종목이 일별로 얼마나 비슷하게 움직였는지 나타냅니다.</p>
        <p className="mt-0.5 font-semibold">구성종목 중복도와는 별개의 지표입니다.</p>
      </div>
    </div>
  );
}

export default function OverlapSummary({ tickerA, tickerB, overlap, correlation, correlationMode, correlationState }: Props) {
  // proxy(동일 지수 별칭)로 해석된 티커가 있으면 근거를 명시한다.
  const proxyNotes = [
    overlap.statusA === "proxy" && overlap.proxyOfA
      ? `${tickerA} 는 동일 지수 대표 ETF ${overlap.proxyOfA} 의 구성종목으로 분석했습니다.`
      : null,
    overlap.statusB === "proxy" && overlap.proxyOfB
      ? `${tickerB} 는 동일 지수 대표 ETF ${overlap.proxyOfB} 의 구성종목으로 분석했습니다.`
      : null,
  ].filter((v): v is string => Boolean(v));

  // 개수 기준 중복도: A·B 가 다르면 둘 다, 같으면 하나로 표기.
  const countA = overlap.countOverlapPctA;
  const countB = overlap.countOverlapPctB;
  const countValue =
    Math.round(countA) === Math.round(countB)
      ? `${countA.toFixed(0)}% (${overlap.commonCount}개)`
      : `${countA.toFixed(0)} / ${countB.toFixed(0)}% (${overlap.commonCount}개)`;
  const countHint =
    Math.round(countA) === Math.round(countB)
      ? "공통 종목 수 ÷ 상위 보유 종목 수 (참고용)"
      : `${tickerA} / ${tickerB} 각각의 상위 보유 종목 수 대비 (참고용)`;

  return (
    <section className={panel}>
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
        <Layers className="h-4 w-4 text-blue-500" /> 구성종목 중복 분석
      </h2>

      <CorrelationMetric result={correlation} mode={correlationMode} state={correlationState} />

      {!overlap.hasHoldings ? (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          {buildUnavailableMessage(tickerA, tickerB, overlap)}
        </p>
      ) : (
        <>
          {proxyNotes.length > 0 && (
            <p className="mb-3 text-[11.5px] text-slate-400">{proxyNotes.join(" ")}</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* 왼쪽: 얼마나 겹치나 */}
            <div className={subCard}>
              <div className="mb-3 text-[12.5px] font-bold text-slate-700 dark:text-slate-200">두 종목이 얼마나 겹치나</div>
              <div className="space-y-4">
                <MetricLine label="종목 개수 기준 중복도" value={countValue} hint={countHint} />
                <MetricLine
                  label="실제 비중 중복도"
                  value={`${overlap.mutualWeightPct.toFixed(1)}%`}
                  hint="양쪽이 공통으로 보유한 비중 · Σ min(비중A, 비중B)"
                />
              </div>
            </div>

            {/* 오른쪽: 각 ETF 안에서 공통 종목 비중 */}
            <div className={subCard}>
              <div className="mb-3 text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
                각 ETF 안에서 공통 종목이 차지하는 비중
              </div>
              <div className="space-y-4">
                <Bar label={`${tickerA} 내 공통 종목 비중`} pct={overlap.weightOverlapPctA} color="#3b82f6" />
                <Bar label={`${tickerB} 내 공통 종목 비중`} pct={overlap.weightOverlapPctB} color="#ec4899" />
                <p className="text-[11.5px] text-slate-400">
                  같은 공통 종목이라도 ETF 별 비중이 다르면 성과 기여가 달라집니다.
                </p>
              </div>
            </div>
          </div>

          {overlap.commonTickers.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                공통 종목 ({overlap.commonCount}개)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overlap.commonTickers.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-blue-50 px-2 py-0.5 text-[11.5px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
