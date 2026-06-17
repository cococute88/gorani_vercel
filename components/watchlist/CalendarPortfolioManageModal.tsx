"use client";

import { useMemo, useState } from "react";
import { normalizeCalendarPortfolioName, sanitizeCalendarPortfolioId, type CalendarPortfolio } from "@/lib/calendar-portfolio";

interface Props {
  open: boolean;
  portfolios: CalendarPortfolio[];
  activePortfolioId: string;
  onSave: (portfolioId: string, portfolios: CalendarPortfolio[]) => void;
  onClose: () => void;
}

export default function CalendarPortfolioManageModal({ open, portfolios, activePortfolioId, onSave, onClose }: Props) {
  const [draftSelectedId, setDraftSelectedId] = useState(activePortfolioId);
  const [draftName, setDraftName] = useState("");
  const [draftPortfolios, setDraftPortfolios] = useState(portfolios);
  const active = useMemo(() => draftPortfolios.find((item) => item.id === draftSelectedId) ?? draftPortfolios[0], [draftPortfolios, draftSelectedId]);
  if (!open) return null;

  const addPortfolio = () => {
    const name = normalizeCalendarPortfolioName(draftName);
    if (!name) return;
    let id = sanitizeCalendarPortfolioId(name);
    if (draftPortfolios.some((item) => item.id === id)) id = `${id}-${Date.now().toString(36)}`;
    const next = [...draftPortfolios, { id, name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    setDraftPortfolios(next);
    setDraftSelectedId(id);
    setDraftName("");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#2a3336] bg-[#151b1d] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-extrabold text-white">캘린더 포트폴리오 관리</h2>
            <p className="mt-1 text-[12px] text-slate-400">새 포트폴리오는 빈 티커/cache/custom/meta namespace에서 시작합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-bold text-slate-300 hover:bg-white/10">닫기</button>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-900/60 p-3 text-sm text-slate-200">
            <div className="text-[12px] font-bold text-slate-400">현재 포트폴리오</div>
            <div className="mt-1 font-extrabold">{active?.name ?? "default"}</div>
          </div>
          <label className="block text-[13px] font-bold text-slate-200">
            포트폴리오 선택
            <select value={draftSelectedId} onChange={(event) => setDraftSelectedId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-white">
              {draftPortfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}
            </select>
          </label>
          <div>
            <div className="mb-2 text-[13px] font-bold text-slate-200">새 포트폴리오 추가</div>
            <div className="flex gap-2">
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="포트폴리오 이름 입력" className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500" />
              <button type="button" onClick={addPortfolio} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-500">+ 추가</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftPortfolios.map((portfolio) => <span key={portfolio.id} className="rounded-full bg-blue-500/10 px-3 py-1 text-[12px] font-bold text-blue-200">{portfolio.name}{portfolio.id === "default" ? " · 삭제 불가" : ""}</span>)}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">닫기</button>
            <button type="button" onClick={() => onSave(draftSelectedId, draftPortfolios)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-500">저장 / 닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
