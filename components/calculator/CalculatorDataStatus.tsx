import { Loader2 } from "lucide-react";
import type { QuoteSource } from "@/lib/quote-types";

type Props = {
  source?: QuoteSource;
  loading?: boolean;
  updatedAt?: string;
  loadingText?: string;
  extra?: string;
};

function sourceLabel(source?: QuoteSource, loading?: boolean) {
  if (loading) return "LOADING";
  if (!source) return "loading";
  if (source === "sample") return "SAMPLE";
  return "LIVE";
}

export default function CalculatorDataStatus({ source, loading, updatedAt, loadingText = "loading", extra }: Props) {
  if (!source && !loading && !updatedAt && !extra) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
          loading
            ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
            : source === "sample"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : source
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-slate-500/40 bg-slate-500/10 text-slate-300"
        }`}
      >
        {sourceLabel(source, loading)}
      </span>
      {loading && (
        <span className="inline-flex items-center gap-1 text-blue-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          {loadingText}
        </span>
      )}
      {updatedAt && <span className="text-slate-500">{new Date(updatedAt).toLocaleString()}</span>}
      {extra && <span className="text-slate-500">{extra}</span>}
    </div>
  );
}
