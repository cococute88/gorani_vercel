"use client";

import { useState } from "react";
import { Plus, X, Save } from "lucide-react";

interface Props {
  tickers: string[];
  portfolioName: string;
  portfolioOptions: string[];
  onSelectPortfolio: (name: string) => void;
  onAdd: (raw: string) => void;
  onRemove: (ticker: string) => void;
  onSave: () => void;
  fromPortfolio: boolean;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 워치리스트/포트폴리오 선택 + 티커 관리 카드
export default function TickerManager({
  tickers,
  portfolioName,
  portfolioOptions,
  onSelectPortfolio,
  onAdd,
  onRemove,
  onSave,
  fromPortfolio,
}: Props) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input);
      setInput("");
    }
  };

  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-300">워치리스트</h2>
        {fromPortfolio && (
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11.5px] text-emerald-400">
            포트폴리오 보유종목 연동됨
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12.5px] text-slate-400">포트폴리오 / 워치리스트명</span>
          <select
            value={portfolioName}
            onChange={(e) => onSelectPortfolio(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
          >
            {portfolioOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="__new__">+ 새 워치리스트 생성</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[12.5px] text-slate-400">티커 추가 (공백/콤마/줄바꿈 구분)</span>
          <div className="mt-1 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="예: SCHD, QQQ TQQQ"
              className="flex-1 rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={15} /> 추가
            </button>
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tickers.length === 0 && (
          <span className="text-[13px] text-slate-500">등록된 티커가 없습니다.</span>
        )}
        {tickers.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1.5 rounded-full border border-[#2a3336] bg-[#11181a] px-3 py-1 text-[13px] font-medium text-white"
          >
            {t}
            <button onClick={() => onRemove(t)} className="text-slate-500 hover:text-red-400" aria-label="삭제">
              <X size={13} />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/20"
        >
          <Save size={15} /> Save / Update
        </button>
      </div>
    </div>
  );
}
