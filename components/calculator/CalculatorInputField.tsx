import { ReactNode } from "react";

const fieldBase = "rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3";

export function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={fieldBase}>
      <span className="block text-[11.5px] text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-transparent text-[13px] font-bold text-slate-100 outline-none" />
    </label>
  );
}

export function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className={fieldBase}>
      <span className="block text-[11.5px] text-slate-500">{label}</span>
      <input type="number" step="any" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full bg-transparent text-[13px] font-bold text-slate-100 outline-none" />
    </label>
  );
}

export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={fieldBase}>
      <span className="block text-[11.5px] text-slate-500">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-transparent text-[13px] font-bold text-slate-100 outline-none" />
    </label>
  );
}

export function SelectInput({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className={fieldBase}>
      <span className="block text-[11.5px] text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-transparent text-[13px] font-bold text-slate-100 outline-none">
        {children}
      </select>
    </label>
  );
}
