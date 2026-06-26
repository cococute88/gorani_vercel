"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import { calculateAssetSimulatorPreview, normalizeInputs, normalizeYearPlans } from "@/lib/asset-simulator";
import type { SimulatorInputs, YearPlanRow } from "@/lib/asset-simulator-types";
import {
  ASSET_SIMULATOR_STORAGE_KEY,
  DEFAULT_SIMULATOR_INPUTS,
  DEFAULT_YEAR_PLANS,
  buildDefaultYearPlans,
} from "@/lib/mock-asset-simulator-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { deleteAssetSimulatorConfig, loadAssetSimulatorConfig, saveAssetSimulatorConfig, warnFirestoreFallback } from "@/lib/firebase/firestore-repositories";
import {
  buildStoredSimulatorConfig,
  chooseLatestSimulatorConfig,
  formatSimulatorSavedAt,
  normalizePersistedSimulatorConfig,
  type ResolvedSimulatorConfig,
  type SimulatorHydrationSource,
} from "@/lib/asset-simulator-persistence";
import SimulatorInputPanel from "./SimulatorInputPanel";
import SimulatorMetricCards from "./SimulatorMetricCards";
import YearPlanTable from "./YearPlanTable";
import SimulatorResultTabs from "./SimulatorResultTabs";
import ExitSummaryModal from "./ExitSummaryModal";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import Image from "next/image";

export default function AssetSimulatorPage() {
  const theme = useResolvedTheme();
  const { user, configured } = useFirebaseAuth();
  const [inputs, setInputs] = useState<SimulatorInputs>(DEFAULT_SIMULATOR_INPUTS);
  const [yearPlans, setYearPlans] = useState<YearPlanRow[]>(DEFAULT_YEAR_PLANS);
  // "지금 EXIT?" 모드는 로컬 UI 상태로만 관리한다. Firebase/로컬 저장 금지, 새로고침 시 초기화.
  const [exitMode, setExitMode] = useState(false);
  // 연도별 투자 계획표 펼침/접힘 상태. 일반 모드 기본값은 열림.
  const [planTableOpen, setPlanTableOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAtMs, setLastSavedAtMs] = useState(0);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const lastLocalWriteAtRef = useRef(0);

  const readLocalConfig = () => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(ASSET_SIMULATOR_STORAGE_KEY);
      if (!stored) return null;
      return normalizePersistedSimulatorConfig(JSON.parse(stored), "local");
    } catch {
      window.localStorage.removeItem(ASSET_SIMULATOR_STORAGE_KEY);
      return null;
    }
  };

  const writeLocalConfig = (nextInputs: SimulatorInputs, nextYearPlans: YearPlanRow[], updatedAt = new Date().toISOString()) => {
    const config = buildStoredSimulatorConfig(nextInputs, nextYearPlans, updatedAt);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ASSET_SIMULATOR_STORAGE_KEY, JSON.stringify(config));
    }
    lastLocalWriteAtRef.current = Date.parse(updatedAt);
    setLastSavedAtMs(lastLocalWriteAtRef.current);
    return config;
  };

  useEffect(() => {
    let active = true;

    const applyConfig = (config: ReturnType<typeof normalizePersistedSimulatorConfig>, source: SimulatorHydrationSource) => {
      if (!config || !active) return;
      if (lastLocalWriteAtRef.current > 0 && config.updatedAtMs < lastLocalWriteAtRef.current) return;
      setInputs(config.inputs);
      setYearPlans(config.yearPlans);
      setLastSavedAtMs(config.updatedAtMs);
      if (source === "cloud" && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            ASSET_SIMULATOR_STORAGE_KEY,
            JSON.stringify(buildStoredSimulatorConfig(config.inputs, config.yearPlans, new Date(config.updatedAtMs || Date.now()).toISOString())),
          );
        } catch {
          // local cache write failure must not block cloud hydration.
        }
      }
    };

    const loadStoredConfig = async () => {
      const localConfig = readLocalConfig();
      let cloudConfig: ResolvedSimulatorConfig | null = null;

      if (user) {
        try {
          cloudConfig = normalizePersistedSimulatorConfig(await loadAssetSimulatorConfig(user.uid), "cloud");
        } catch (err) {
          warnFirestoreFallback("assetSimulator.load", err);
          setSaveError("클라우드 저장값을 불러오지 못해 로컬 저장값을 사용합니다.");
        }
      }

      const selected = chooseLatestSimulatorConfig(cloudConfig, localConfig);
      applyConfig(selected, selected?.source ?? "default");
    };

    void loadStoredConfig();
    return () => {
      active = false;
    };
  }, [user]);

  const projection = useMemo(
    () => calculateAssetSimulatorPreview(inputs, yearPlans, exitMode),
    [inputs, yearPlans, exitMode],
  );

  // "지금탈출" 모달 전용 계산 결과.
  // 사용자가 "지금 EXIT?" 토글을 켜지 않았더라도, 모달은 항상 EXIT 모드(=ON) 기준으로
  // 계산한 결과를 보여준다. (화면의 토글/계획표 상태는 변경하지 않는다.)
  const exitProjection = useMemo(
    () => calculateAssetSimulatorPreview(inputs, yearPlans, true),
    [inputs, yearPlans],
  );

  // 연도별 투자 계획표는 EXIT 모드 여부와 무관하게 사용자가 입력한 실제 계획표를 표시한다.
  // (EXIT 모드는 계산에서만 무시할 뿐, 입력 데이터를 시각적으로 지우지 않는다.)
  const tablePlans = useMemo(
    () => normalizeYearPlans(normalizeInputs(inputs), yearPlans),
    [inputs, yearPlans],
  );

  // "지금 EXIT?" 토글 시 계획표를 자동으로 접고/펼친다.
  // ON → 계산에 쓰이지 않으므로 즉시 접기, OFF → 기본 상태(열림) 복원.
  // 토글 사이에는 사용자가 직접 펼치기/접기 버튼으로 제어할 수 있다.
  const handleExitModeChange = (next: boolean) => {
    setExitMode(next);
    setPlanTableOpen(!next);
  };

  const handleInputsChange = (nextInputs: SimulatorInputs) => {
    const normalizedInputs = normalizeInputs(nextInputs);
    setInputs(normalizedInputs);
    setYearPlans((currentPlans) => normalizeYearPlans(normalizedInputs, currentPlans));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    const updatedAt = new Date().toISOString();
    const normalizedInputs = normalizeInputs(inputs);
    const normalizedPlans = normalizeYearPlans(normalizedInputs, yearPlans);

    try {
      const storedConfig = writeLocalConfig(normalizedInputs, normalizedPlans, updatedAt);
      setInputs(normalizedInputs);
      setYearPlans(normalizedPlans);

      if (user) {
        await saveAssetSimulatorConfig(user.uid, storedConfig);
        setSaveMessage("저장 완료 · 클라우드에 동기화됨");
      } else {
        setSaveMessage(configured ? "로컬에 저장됨 · 로그인하면 클라우드 동기화 가능" : "로컬에 저장됨");
      }
    } catch (err) {
      warnFirestoreFallback("assetSimulator.save", err);
      const message = err instanceof Error ? err.message : "";
      setSaveError(
        user && message.includes("Firestore payload is not serializable")
          ? "저장 실패: 저장 데이터 형식을 정리하지 못했습니다."
          : user
            ? "저장 실패: 클라우드 저장 중 오류가 발생했습니다."
            : "저장 실패: 브라우저 로컬 저장소를 사용할 수 없습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const plans = buildDefaultYearPlans();
    setInputs(DEFAULT_SIMULATOR_INPUTS);
    setYearPlans(plans);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(ASSET_SIMULATOR_STORAGE_KEY);
      } catch {
        // 저장소 접근이 제한된 환경에서는 상태 초기화만 수행한다.
      }
    }
    if (user) {
      void deleteAssetSimulatorConfig(user.uid).catch((err) => warnFirestoreFallback("assetSimulator.delete", err));
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[22px] font-extrabold text-slate-900 dark:text-white">자산 시뮬레이터</h1>
              <StorageModeBadge />
            </div>
            <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-slate-500 dark:text-slate-400">
              장기 투자·인출 계획을 계산합니다.
            </p>
          </div>

          {/*
            대표 CTA: "당장탈출" 앱 아이콘형 버튼.
            카드/테두리/그라데이션/텍스트 없이 exit.png 이미지 자체가 버튼 역할을 한다.
            "지금 EXIT?" 토글 상태와 무관하게 항상 EXIT 모드 기준 요약 모달을 연다.
            헤더 우측(데스크톱) / 타이틀 아래(모바일)에 배치해 입력폼 버튼과 분리한다.
          */}
          <button
            type="button"
            onClick={() => setExitModalOpen(true)}
            aria-haspopup="dialog"
            aria-label="🚪 당장탈출"
            title="🚪 당장탈출 — 지금 바로 은퇴할 경우의 요약 보기"
            className="group relative aspect-square w-28 shrink-0 self-start rounded-2xl transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 active:translate-y-0 active:scale-100 sm:w-32"
          >
            <Image
              src="/exit.png"
              alt=""
              width={1254}
              height={1254}
              className="h-full w-full object-contain drop-shadow-md transition-[filter] duration-200 ease-out group-hover:drop-shadow-xl"
            />
          </button>
        </div>

        <div className="space-y-5">
          <SimulatorInputPanel inputs={inputs} onChange={handleInputsChange} onReset={handleReset} onSave={handleSave} saving={saving} saveMessage={saveMessage} saveError={saveError} exitMode={exitMode} onExitModeChange={handleExitModeChange} />
          <YearPlanTable plans={tablePlans} onChange={setYearPlans} open={planTableOpen} onToggleOpen={() => setPlanTableOpen((prev) => !prev)} exitMode={exitMode} />
          <SimulatorMetricCards summary={projection.summary} />
          <SimulatorResultTabs projection={projection} />
          <p className="rounded-2xl border border-[#273032] bg-[#171d1e] px-4 py-3 text-[13px] text-slate-400">
            {lastSavedAtMs ? `마지막 저장: ${formatSimulatorSavedAt(lastSavedAtMs) ?? "확인 중"} · ` : ""}{user
              ? "로그인 상태에서는 Save 시 계정 클라우드에 저장돼요."
              : configured
                ? "로그아웃 상태에서는 이 브라우저에만 임시 저장돼요."
                : "Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다."} 입력값과 계획표는 금융 API 없이 저장됩니다.
          </p>
        </div>
      </main>
      <ExitSummaryModal
        open={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        projection={exitProjection}
        inputs={inputs}
      />
    </div>
  );
}
