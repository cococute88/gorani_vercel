export default function SimulatorPreviewNotice() {
  return (
    <section className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-100 shadow-lg shadow-blue-950/10">
      <div className="font-bold text-blue-50">3A Preview 안내</div>
      <p className="mt-2 leading-6">
        현재는 미리보기 계산입니다. 기존 Streamlit 계산 로직과의 정밀 일치는 다음 단계에서 검증합니다.
      </p>
      <p className="mt-1 text-[13px] leading-6 text-blue-200/80">
        세부 세제/계좌별 인출 로직은 이후 단계에서 정밀 연결합니다.
      </p>
    </section>
  );
}
