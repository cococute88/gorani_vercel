"use client";

// 비교표 아래 "다음 조정 후보" 칩 목록.
// 문구는 deriveAdjustmentCandidates 에서 warnings/metrics 를 근거로 만든 점검 항목이며,
// 새 투자 조언이 아니라 참고용 점검 제안이다.
export default function SafetyAdjustmentCandidates({ candidates }: { candidates: string[] }) {
  if (candidates.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">다음 조정 후보</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {candidates.map((candidate, index) => (
          <li
            key={index}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-medium text-slate-700 dark:border-[#2c3638] dark:bg-white/[0.03] dark:text-slate-200"
          >
            {candidate}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
        참고용 점검 항목이며 투자 권유가 아닙니다.
      </p>
    </div>
  );
}
