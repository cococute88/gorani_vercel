"use client";

import { useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import PreviewNotice from "./PreviewNotice";
import DividendCaptureSimulator from "./DividendCaptureSimulator";
import ConversionCalculator from "./ConversionCalculator";
import MddCalculator from "./MddCalculator";
import { defaultConversionInput } from "@/lib/conversion-calculator";
import { defaultDividendCaptureInput } from "@/lib/dividend-capture-calculator";
import { defaultMddInput } from "@/lib/mdd-calculator";
import type { ConversionInput, DividendCaptureInput, MddInput } from "@/lib/calculator-types";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

// PORTFOLIO-CALCULATOR-UX-FIX-2 #7: 원본 Streamlit 입력 흐름에 맞춰 입력칸을 간소화하고
// 프리셋 저장/선택/불러오기 UI는 메인 화면에서 제거했다.
const tabs = [
  { key: "capture", label: "배당치기 시뮬" },
  { key: "conversion", label: "매도전환 계산기" },
  { key: "mdd", label: "MDD 계산기" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function CalculatorPage() {
  const theme = useResolvedTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("capture");
  const [captureInput, setCaptureInput] = useState<DividendCaptureInput>(defaultDividendCaptureInput);
  const [conversionInput, setConversionInput] = useState<ConversionInput>(defaultConversionInput);
  const [mddInput, setMddInput] = useState<MddInput>(defaultMddInput);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[22px] font-extrabold text-slate-900 dark:text-white">계산기</h1>
            <StorageModeBadge />
          </div>
          <p className="mt-2 text-[13.5px] text-slate-500 dark:text-slate-400">
            Streamlit 원본 계산 흐름을 TypeScript로 포팅한 배당치기, 매도전환, MDD 계산기입니다.
          </p>
        </div>

        <PreviewNotice />

        <div className="no-scrollbar my-5 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#273032] dark:bg-[#171d1e] sm:gap-2 sm:p-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[12.5px] font-bold transition-colors sm:px-4 sm:text-[13px] ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "capture" && <DividendCaptureSimulator input={captureInput} onChange={setCaptureInput} />}
        {activeTab === "conversion" && <ConversionCalculator input={conversionInput} onChange={setConversionInput} />}
        {activeTab === "mdd" && <MddCalculator input={mddInput} onChange={setMddInput} />}
      </main>
    </div>
  );
}
