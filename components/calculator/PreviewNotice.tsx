export default function PreviewNotice() {
  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-5 py-4 text-[13px] text-blue-100">
      <div className="font-bold text-white">무료 데이터/입력값 기반 계산기</div>
      <p className="mt-1 leading-6 text-blue-100/85">
        현재는 입력값/샘플 데이터 기준으로 계산합니다. 입력값 변경 또는 계산 실행 시 결과가 즉시 갱신되며, 실시간 시세와 차이가 있을 수 있습니다.
      </p>
    </div>
  );
}
