export default function PreviewNotice() {
  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-5 py-4 text-[13px] text-blue-100">
      <div className="font-bold text-white">Preview only</div>
      <p className="mt-1 leading-6 text-blue-100/85">
        이 계산기는 화면 구성과 계산 흐름을 확인하기 위한 목업입니다. 실제 가격, 배당 또는 계좌 데이터와 연결하지 않습니다.
      </p>
    </div>
  );
}
