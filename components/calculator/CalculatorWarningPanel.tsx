type Props = {
  warnings: string[];
  error?: string | null;
};

export default function CalculatorWarningPanel({ warnings, error }: Props) {
  if (!error && warnings.length === 0) return null;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-50 px-4 py-3 text-[12.5px] text-red-700 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800 dark:bg-amber-950/15 dark:text-amber-100/90">
          <p className="font-semibold text-amber-700 dark:text-amber-200">주의</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-amber-800 dark:text-amber-100/80">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
