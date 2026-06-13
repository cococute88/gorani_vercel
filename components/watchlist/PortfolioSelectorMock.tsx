export default function PortfolioSelectorMock() {
  return (
    <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">포트폴리오</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-white">기본 포트폴리오</p>
          <p className="text-[12px] text-slate-400">저장/동기화 없이 미리보기 데이터만 사용합니다.</p>
        </div>
        <button type="button" className="min-w-fit shrink-0 whitespace-nowrap rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1.5 text-[12px] font-semibold text-blue-200">
          관리
        </button>
      </div>
    </div>
  );
}
