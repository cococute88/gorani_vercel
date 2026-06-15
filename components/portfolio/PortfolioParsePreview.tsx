"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { formatWon, formatPercent } from "@/lib/format";
import type { ParseResult } from "@/lib/banksalad-parser";

interface Props {
  result: ParseResult | null;
}

const card = "h-full rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-[#11181a] px-3 py-2.5">
      <div className="text-[11.5px] text-slate-400">{label}</div>
      <div className={`num mt-1 text-[15px] font-bold ${tone ?? "text-white"}`}>{value}</div>
    </div>
  );
}

function RawTable({ header, rows }: { header: string[]; rows: string[][] }) {
  if (header.length === 0 && rows.length === 0) return null;
  return (
    <div className="scroll-dark mt-2 max-h-[240px] overflow-auto rounded-lg border border-[#1c2426]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[#11181a]">
          <tr className="text-left text-slate-400">
            {header.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-2.5 py-1.5 font-medium">{h || "—"}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-[#1c2426]">
              {r.map((c, ci) => (
                <td key={ci} className="whitespace-nowrap px-2.5 py-1.5 text-slate-300">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 파싱 결과 요약 + 원본 preview 테이블 + 경고/오류
export default function PortfolioParsePreview({ result }: Props) {
  if (!result) {
    return (
      <div className={card}>
        <h2 className="text-[15px] font-bold text-slate-300">파싱 결과 요약</h2>
        <p className="mt-2 text-[13px] text-slate-500">아직 파싱된 결과가 없습니다. 파일을 업로드하고 “파싱 실행”을 눌러주세요.</p>
      </div>
    );
  }

  const reviewCount = result.holdings.filter((h) => h.needsReview).length;
  const excludedTotal = result.excludedSmallCount + result.excludedBelowMinimumCount;
  const quantityCount = result.holdings.filter((h) => h.quantity != null).length;
  const currencyCount = result.holdings.filter((h) => h.currency).length;
  const tickerCount = result.holdings.filter((h) => h.ticker).length;
  const priceCount = result.holdings.filter((h) => h.currentPrice != null).length;

  return (
    <div className={card}>
      <div className="mb-3 flex items-center gap-2">
        {result.ok ? (
          <CheckCircle2 size={17} className="text-emerald-400" />
        ) : (
          <XCircle size={17} className="text-red-400" />
        )}
        <h2 className="text-[15px] font-bold text-slate-300">파싱 결과 요약</h2>
        <span className="num ml-auto text-[12px] text-slate-400">{result.sheetName} · {result.snapshotDate}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Metric label="총 금융자산" value={formatWon(result.totalAssetKRW)} />
        <Metric label="총 부채" value={formatWon(result.totalDebtKRW)} tone="text-red-400" />
        <Metric label="순자산" value={formatWon(result.netAssetKRW)} />
        <Metric label="투자원금 합계" value={formatWon(result.investmentPrincipalKRW)} />
        <Metric label="평가금액 합계" value={formatWon(result.investmentValueKRW)} />
        <Metric label="수익금" value={formatWon(result.returnAmountKRW)} tone={result.returnAmountKRW >= 0 ? "text-red-400" : "text-blue-400"} />
        <Metric label="수익률" value={formatPercent(result.returnPct, 1)} tone={result.returnPct >= 0 ? "text-red-400" : "text-blue-400"} />
        <Metric label="인식 보유종목" value={`${result.holdings.length}개 (확인필요 ${reviewCount})`} />
        <Metric label="제외 항목" value={`총 ${excludedTotal}개 (#소액 ${result.excludedSmallCount}개 · 1만원 미만 ${result.excludedBelowMinimumCount}개)`} />
        <Metric label="보강 필드" value={`수량 ${quantityCount} · 통화 ${currencyCount} · 티커 ${tickerCount} · 가격 ${priceCount}`} />
      </div>

      {(result.warnings.length > 0 || result.errors.length > 0) && (
        <div className="mt-4 flex flex-col gap-1.5">
          {result.errors.map((e, i) => (
            <div key={`er-${i}`} className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-[12.5px] text-red-300">
              <XCircle size={13} /> {e}
            </div>
          ))}
          {result.warnings.map((w, i) => (
            <div key={`wn-${i}`} className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-[12.5px] text-amber-300">
              <AlertTriangle size={13} /> {w}
            </div>
          ))}
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-[13px] font-medium text-slate-300">원본 데이터 미리보기 (3.재무현황 / 5.투자현황)</summary>
        <div className="mt-1 text-[12px] text-slate-400">3. 재무현황</div>
        <RawTable header={result.preview.financeHeader} rows={result.preview.financeRows} />
        <div className="mt-3 text-[12px] text-slate-400">5. 투자현황</div>
        <RawTable header={result.preview.investmentHeader} rows={result.preview.investmentRows} />
      </details>
    </div>
  );
}
