"use client";

import { useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import PreviewNotice from "./PreviewNotice";
import DividendCaptureSimulator from "./DividendCaptureSimulator";
import ConversionCalculator from "./ConversionCalculator";
import MddCalculator from "./MddCalculator";
import CalculatorPresetControls from "./CalculatorPresetControls";
import { defaultConversionInput } from "@/lib/conversion-calculator";
import { defaultDividendCaptureInput } from "@/lib/dividend-capture-calculator";
import { defaultMddInput } from "@/lib/mdd-calculator";
import type { ConversionInput, DividendCaptureInput, MddInput } from "@/lib/calculator-types";

const tabs = [
  { key: "capture", label: "배당치기 시뮬", presetType: "dividend-capture" },
  { key: "conversion", label: "매도전환 계산기", presetType: "conversion" },
  { key: "mdd", label: "MDD 계산기", presetType: "mdd" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function CalculatorPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("capture");
  const [captureInput, setCaptureInput] = useState<DividendCaptureInput>(defaultDividendCaptureInput);
  const [conversionInput, setConversionInput] = useState<ConversionInput>(defaultConversionInput);
  const [mddInput, setMddInput] = useState<MddInput>(defaultMddInput);
  const activePreset = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const activeValues = activeTab === "capture" ? captureInput : activeTab === "conversion" ? conversionInput : mddInput;

  const handleLoadPreset = (values: Record<string, unknown>) => {
    if (activeTab === "capture") setCaptureInput({ ...defaultDividendCaptureInput, ...values } as DividendCaptureInput);
    if (activeTab === "conversion") setConversionInput({ ...defaultConversionInput, ...values } as ConversionInput);
    if (activeTab === "mdd") setMddInput({ ...defaultMddInput, ...values } as MddInput);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[22px] font-extrabold text-white">계산기</h1>
            <StorageModeBadge />
          </div>
          <p className="mt-2 text-[13.5px] text-slate-400">
            Streamlit 원본 계산 흐름을 TypeScript로 포팅한 배당치기, 매도전환, MDD 계산기입니다.
          </p>
        </div>

        <PreviewNotice />

        <div className="no-scrollbar my-5 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-[#273032] bg-[#171d1e] p-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold transition-colors ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <CalculatorPresetControls type={activePreset.presetType} values={activeValues as unknown as Record<string, unknown>} onLoad={handleLoadPreset} />

        {activeTab === "capture" && <DividendCaptureSimulator input={captureInput} onChange={setCaptureInput} />}
        {activeTab === "conversion" && <ConversionCalculator input={conversionInput} onChange={setConversionInput} />}
        {activeTab === "mdd" && <MddCalculator input={mddInput} onChange={setMddInput} />}
      </main>
    </div>
  );
}
