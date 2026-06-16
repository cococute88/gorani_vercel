"use client";

import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatWon, formatWonCompact, formatPercent } from "@/lib/format";
import type { ParseSummaryModel } from "@/lib/portfolio-parse-summary";

interface Props {
  model: ParseSummaryModel | null;
  // 비어 있을 때(엑셀 미업로드 등) 안내 문구.
  emptyMessage?: string;
  // 카드 하단에 붙일 추가 내용(경고/오류/원본 미리보기 등).
  children?: ReactNode;
}

const card = "h-full min-w-0 rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 요약 타일. min-w-0 + truncate 로 카드 밖으로 텍스트가 절대 넘치지 않게 한다.
// 큰 금액은 축약(₩ 6.79억) 표기하고, 정확한 값은 title(tooltip) 로 보존한다.
function Metric({
  label,
  value,
  sub,
  tone,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[#11181a] px-3 py-2.5">
      <div className="truncate break-keep text-[11.5px] text-slate-400" title={label}>
        {label}
      </div>
      <div
        className={`num mt-1 truncate whitespace-nowrap text-[14px] font-bold sm:text-[15px] ${tone ?? "text-white"}`}
        title={title ?? value}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 truncate whitespace-nowrap text-[10.5px] text-slate-500" title={sub}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

// 파싱 결과 요약 카드(3x3 그리드). 파싱 직후와 스냅샷 상세에서 공유한다.
export default function ParseSummaryCard({ model, emptyMessage, children }: Props) {
  if (!model) {
    return (
      <div className={card}>
        <h2 className="text-[15px] font-bold text-slate-300">파싱 결과 요약</h2>
        <p className="mt-2 break-keep text-[13px] text-slate-500">
          {emptyMessage ?? "아직 파싱된 결과가 없습니다. 파일을 업로드하고 “파싱 실행”을 눌러주세요."}
        </p>
      </div>
    );
  }

  const cashValue = model.cashAssetKRW;
  return (
    <div className={card}>
      <div className="mb-3 flex min-w-0 items-center gap-2">
        {model.ok ? (
          <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />
        ) : (
          <XCircle size={17} className="shrink-0 text-red-400" />
        )}
        <h2 className="shrink-0 text-[15px] font-bold text-slate-300">파싱 결과 요약</h2>
        <span className="num ml-auto min-w-0 truncate text-[12px] text-slate-400" title={model.caption}>
          {model.caption}
        </span>
      </div>

      {/* 3x3 그리드: desktop(md+) 3열 x 3행 · mobile 2열로 자연 wrap. */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <Metric
          label="총 금융자산"
          value={formatWonCompact(model.totalAssetKRW)}
          title={formatWon(model.totalAssetKRW)}
        />
        <Metric
          label="투자자산 합계"
          value={formatWonCompact(model.investmentValueKRW)}
          title={formatWon(model.investmentValueKRW)}
        />
        <Metric
          label="현금자산"
          value={cashValue == null ? "—" : formatWonCompact(cashValue)}
          title={cashValue == null ? "현금성 자산 정보 없음" : formatWon(cashValue)}
        />

        <Metric
          label="투자원금 합계"
          value={formatWonCompact(model.investmentPrincipalKRW)}
          title={formatWon(model.investmentPrincipalKRW)}
        />
        <Metric
          label="수익금"
          value={formatWonCompact(model.returnAmountKRW)}
          title={formatWon(model.returnAmountKRW)}
          tone={model.returnAmountKRW >= 0 ? "text-red-400" : "text-blue-400"}
        />
        <Metric
          label="수익률"
          value={formatPercent(model.returnPct, 1)}
          tone={model.returnPct >= 0 ? "text-red-400" : "text-blue-400"}
        />

        <Metric
          label="인식 보유종목"
          value={`${model.recognizedCount}개`}
          sub={`확인필요 ${model.reviewCount}`}
        />
        <Metric
          label="제외 항목"
          value={`총 ${model.excludedTotal}개`}
          sub={`#소액 ${model.excludedSmallCount} · 최소금액미만 ${model.excludedBelowMinimumCount}`}
        />
        <Metric
          label="보강 필드"
          value={`티커 ${model.tickerCount} · 가격 ${model.priceCount}`}
          sub={`수량 ${model.quantityCount} · 통화 ${model.currencyCount}`}
        />
      </div>

      {children}
    </div>
  );
}
