export default function PreviewNotice() {
  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-[13px] text-blue-100/90">
      <div className="font-bold text-white">Live quote data enabled</div>
      <p className="mt-1 leading-relaxed text-blue-100/70">
        모든 계산기가 무료 quote API를 통해 실시간 데이터를 사용합니다. API 요청 실패 시 sample 데이터로 자동 전환됩니다.
        상단 badge에서 현재 데이터 소스를 확인하세요.
      </p>
    </div>
  );
}
