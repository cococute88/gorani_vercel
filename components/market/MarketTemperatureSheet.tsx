"use client";

// 원본 Streamlit '시장온도 참고 시트'를 재현한다.
// 구글 시트 '웹에 게시(Embed)' URL 을 iframe 으로 보기만 한다 (Google API/secret 미사용).
// 외부 시트 로딩 실패는 iframe 내부 문제로 한정되며, 페이지 다른 섹션에는 영향이 없다.
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRQsjM2Yp05NyPTnXEeUuHrO8oiOJhuRmtDqIFQHOrsAGNnxVHDvs8eg0_qS-6CR5mnAG29v02j-fJ7/pubhtml?gid=331043462&single=true&widget=true&headers=false";

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function MarketTemperatureSheet() {
  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-slate-300">시장온도 참고 시트</h2>
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[12px] font-medium text-blue-400 hover:text-blue-300"
          >
            새 탭에서 열기 ↗
          </a>
        </div>
        <p className="mb-3 text-[12.5px] text-slate-500">
          구글 시트가 보이지 않으면 위 ‘새 탭에서 열기’ 링크로 확인하거나, 시트의 ‘웹에 게시’ 설정을 확인해주세요.
        </p>
        <div className="overflow-hidden rounded-xl border border-[#2a3336] bg-white">
          <iframe src={SHEET_URL} title="시장온도 참고 시트" className="h-[640px] w-full" loading="lazy" />
        </div>
      </div>
    </section>
  );
}
