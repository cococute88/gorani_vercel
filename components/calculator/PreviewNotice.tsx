export default function PreviewNotice() {
  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-5 py-4 text-[13px] text-blue-100">
      <div className="font-bold text-white">Free quote API foundation is enabled</div>
      <p className="mt-1 leading-6 text-blue-100/85">
        The MDD and conversion calculators now use quote history data with sample fallback. Dividend capture still uses the existing
        local sample provider until its own live-data step.
      </p>
    </div>
  );
}
