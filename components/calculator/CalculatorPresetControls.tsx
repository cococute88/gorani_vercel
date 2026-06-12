"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  loadCalculatorPresets,
  saveCalculatorPreset,
  warnFirestoreFallback,
  type CalculatorPreset,
  type CalculatorPresetType,
} from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const STORAGE_KEY = STORAGE_KEYS.calculatorPresets;

function readLocalPresets(): CalculatorPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CalculatorPreset[]) : [];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function writeLocalPresets(presets: CalculatorPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage 사용 불가 환경에서는 화면 상태만 유지한다.
  }
}

type Props = {
  type: CalculatorPresetType;
  values: Record<string, unknown>;
  onLoad?: (values: Record<string, unknown>) => void;
};

export default function CalculatorPresetControls({ type, values, onLoad }: Props) {
  const { user } = useFirebaseAuth();
  const [presets, setPresets] = useState<CalculatorPreset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [notice, setNotice] = useState("프리셋은 현재 입력값 전체를 저장합니다.");

  useEffect(() => {
    setPresets(readLocalPresets());
  }, []);

  useEffect(() => {
    if (!user) return;
    loadCalculatorPresets(user.uid)
      .then((cloudPresets) => {
        if (cloudPresets.length > 0) setPresets(cloudPresets);
      })
      .catch((err) => warnFirestoreFallback("calculatorPresets.load", err));
  }, [user]);

  useEffect(() => {
    setSelectedId("");
    setPresetName("");
  }, [type]);

  const filteredPresets = useMemo(() => presets.filter((preset) => preset.type === type), [presets, type]);

  const handleSave = async () => {
    const now = new Date().toISOString();
    const preset: CalculatorPreset = {
      id: `${type}-${Date.now().toString(36)}`,
      type,
      name: presetName.trim() || `${type} preset ${filteredPresets.length + 1}`,
      values,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...presets, preset];
    setPresets(next);
    writeLocalPresets(next);
    if (user) {
      await saveCalculatorPreset(user.uid, preset).catch((err) => warnFirestoreFallback("calculatorPresets.save", err));
    }
    setSelectedId(preset.id);
    setNotice(user ? "Firestore 프리셋을 저장했어요." : "localStorage 프리셋을 저장했어요.");
  };

  const handleLoad = () => {
    const preset = presets.find((item) => item.id === selectedId);
    if (!preset) {
      setNotice("불러올 프리셋을 선택해 주세요.");
      return;
    }
    onLoad?.(preset.values);
    setNotice(`${preset.name} 프리셋을 입력폼에 반영했어요.`);
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#273032] bg-[#171d1e] p-3 text-[12.5px] text-slate-300">
      <input
        value={presetName}
        onChange={(event) => setPresetName(event.target.value)}
        placeholder="프리셋 이름"
        className="min-w-[150px] rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-slate-200 outline-none placeholder:text-slate-600"
      />
      <button type="button" onClick={handleSave} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700">프리셋 저장</button>
      <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-w-[180px] rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-slate-200 outline-none">
        <option value="">프리셋 선택</option>
        {filteredPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>{preset.name}</option>
        ))}
      </select>
      <button type="button" onClick={handleLoad} className="rounded-lg bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20">프리셋 불러오기</button>
      <span className="text-slate-500">{notice}</span>
    </div>
  );
}
