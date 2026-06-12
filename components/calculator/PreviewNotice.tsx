export default function PreviewNotice() {
  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-5 py-4 text-[13px] text-blue-100">
      <div className="font-bold text-white">Free quote API foundation is enabled</div>
      <p className="mt-1 leading-6 text-blue-100/85">
        The MDD, conversion, and dividend capture calculators now use free quote API data with sample fallback. Dividend capture combines
        quote history and historical dividend events.
      </p>
    </div>
  );
}
