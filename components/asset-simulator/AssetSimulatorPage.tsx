"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import { calculateAssetSimulatorPreview, normalizeYearPlans } from "@/lib/asset-simulator";
import type { SimulatorInputs, StoredSimulatorPreview, YearPlanRow } from "@/lib/asset-simulator-types";
import {
  ASSET_SIMULATOR_STORAGE_KEY,
  DEFAULT_SIMULATOR_INPUTS,
  DEFAULT_YEAR_PLANS,
  buildDefaultYearPlans,
} from "@/lib/mock-asset-simulator-data";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { deleteAssetSimulatorConfig, loadAssetSimulatorConfig, saveAssetSimulatorConfig, warnFirestoreFallback } from "@/lib/firebase/firestore-repositories";
import SimulatorBalanceChart from "./SimulatorBalanceChart";
import SimulatorCashflowChart from "./SimulatorCashflowChart";
import SimulatorInputPanel from "./SimulatorInputPanel";
import SimulatorMetricCards from "./SimulatorMetricCards";
import SimulatorPreviewNotice from "./SimulatorPreviewNotice";
import YearPlanTable from "./YearPlanTable";

export default function AssetSimulatorPage() {
  const { user, configured } = useFirebaseAuth();
  const [inputs, setInputs] = useState<SimulatorInputs>(DEFAULT_SIMULATOR_INPUTS);
  const [yearPlans, setYearPlans] = useState<YearPlanRow[]>(DEFAULT_YEAR_PLANS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    const loadStoredConfig = async () => {
      if (user) {
        try {
          const cloudConfig = await loadAssetSimulatorConfig(user.uid);
          if (cloudConfig?.inputs && active) {
            const nextInputs = { ...DEFAULT_SIMULATOR_INPUTS, ...cloudConfig.inputs };
            setInputs(nextInputs);
            setYearPlans(normalizeYearPlans(nextInputs, cloudConfig.yearPlans ?? []));
            setHydrated(true);
            return;
          }
        } catch (err) {
          warnFirestoreFallback("assetSimulator.load", err);
        }
      }

      if (typeof window === "undefined") {
        setHydrated(true);
        return;
      }

      try {
        const stored = window.localStorage.getItem(ASSET_SIMULATOR_STORAGE_KEY);
        if (!stored) return;

        const parsed = JSON.parse(stored) as Partial<StoredSimulatorPreview>;
        if (parsed.inputs) {
          const nextInputs = { ...DEFAULT_SIMULATOR_INPUTS, ...parsed.inputs };
          setInputs(nextInputs);
          setYearPlans(normalizeYearPlans(nextInputs, parsed.yearPlans ?? []));
        }
      } catch {
        window.localStorage.removeItem(ASSET_SIMULATOR_STORAGE_KEY);
      } finally {
        if (active) setHydrated(true);
      }
    };

    setHydrated(false);
    void loadStoredConfig();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        ASSET_SIMULATOR_STORAGE_KEY,
        JSON.stringify({ inputs, yearPlans }),
      );
    } catch {
      // 브라우저 저장소 제한이 있으면 화면 계산만 유지한다.
    }
    if (user) {
      void saveAssetSimulatorConfig(user.uid, { inputs, yearPlans }).catch((err) =>
        warnFirestoreFallback("assetSimulator.save", err),
      );
    }
  }, [hydrated, inputs, yearPlans, user]);

  const projection = useMemo(
    () => calculateAssetSimulatorPreview(inputs, yearPlans),
    [inputs, yearPlans],
  );

  const handleInputsChange = (nextInputs: SimulatorInputs) => {
    const normalizedInputs = {
      ...nextInputs,
      startYear: Math.round(nextInputs.startYear),
      years: Math.max(1, Math.min(60, Math.round(nextInputs.years))),
      withdrawalDelayYears: Math.max(0, Math.round(nextInputs.withdrawalDelayYears)),
    };
    setInputs(normalizedInputs);
    setYearPlans((currentPlans) => normalizeYearPlans(normalizedInputs, currentPlans));
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
    <div className="min-h-screen overflow-x-hidden bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[22px] font-extrabold text-white">자산 시뮬레이터</h1>
            <StorageModeBadge />
          </div>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-slate-400">
            적립, 수익률, 인출률을 바탕으로 장기 자산 흐름을 미리 가늠하는 시뮬레이터입니다.
          </p>
        </div>

        <div className="space-y-5">
          <SimulatorPreviewNotice />
          <SimulatorInputPanel inputs={inputs} onChange={handleInputsChange} onReset={handleReset} />
          <SimulatorMetricCards summary={projection.summary} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SimulatorBalanceChart data={projection.results} retirementYear={projection.summary.expectedRetirementYear} />
            <SimulatorCashflowChart data={projection.results} />
          </div>
          <YearPlanTable plans={projection.yearPlans} onChange={setYearPlans} />
          <p className="rounded-2xl border border-[#273032] bg-[#171d1e] px-4 py-3 text-[13px] text-slate-400">
            {user
              ? "로그인 상태에서는 계정에 저장돼요."
              : configured
                ? "로그아웃 상태에서는 이 브라우저에만 임시 저장돼요."
                : "Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다."} Preview 입력값과 계획표는 금융 API 없이 저장됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
