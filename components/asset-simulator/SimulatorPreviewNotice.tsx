export default function SimulatorPreviewNotice() {
  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow-lg shadow-emerald-950/10">
      <div className="font-bold text-emerald-50">Streamlit 자산 시뮬레이터 포팅</div>
      <p className="mt-2 leading-6">
        기존 3A mock preview를 대체하고, Streamlit 원본의 입력 순서·연도별 계획표·절세계좌 인출·배당용 위탁계좌 흐름을 TypeScript 계산으로 재구성했습니다.
      </p>
    </section>
  );
}
