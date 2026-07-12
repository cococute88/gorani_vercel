"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import { calculateAssetSimulatorPreview, normalizeInputs, normalizeYearPlans } from "@/lib/asset-simulator";
import type {
  AppliedPortfolioAssumptionsV1,
  AssetSimulatorPortfolioConfigV1,
  SimulatorInputs,
  YearPlanRow,
} from "@/lib/asset-simulator-types";
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
import { ASSET_SIMULATOR_SAVED_EVENT } from "@/lib/tax-account-principal";
import AssetSimulatorMemo from "./AssetSimulatorMemo";
import SimulatorInputPanel from "./SimulatorInputPanel";
import SimulatorMetricCards from "./SimulatorMetricCards";
import YearPlanTable from "./YearPlanTable";
import SimulatorResultTabs from "./SimulatorResultTabs";
import ExitSummaryModal from "./ExitSummaryModal";
import PortfolioConfigSection from "./PortfolioConfigSection";
import RetirementSafetySection from "./RetirementSafetySection";
import SafetyCheckDashboard from "./SafetyCheckDashboard";
import {
  doPortfolioAssumptionsMatchConfig,
  isPortfolioAssumptionsStale,
} from "@/lib/asset-simulator-portfolio-assumptions";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import Image from "next/image";

// 계산기 페이지와 동일한 URL query parameter 기반 서브탭 구조.
// 기본 시뮬레이터(basic)와 안정성 체크(safety) 두 탭으로 분리한다.
const SIMULATOR_TABS = [
  { key: "basic", label: "기본 시뮬레이터" },
  { key: "safety", label: "안정성 체크" },
] as const;

type SimulatorTabKey = (typeof SIMULATOR_TABS)[number]["key"];

// 잘못된 tab 값은 basic 으로 fallback 한다.
function resolveSimulatorTab(tabParam: string | null): SimulatorTabKey {
  return tabParam === "safety" ? "safety" : "basic";
}

// 안정성 체크 탭 상태 도트 색상.
// - 적용 가정 없음: 회색 / 있으나 config 불일치 또는 stale: 호박 / 적용·일치·최신: 초록
type SafetyDotState = "none" | "attention" | "ready";

export default function AssetSimulatorPage() {
  const theme = useResolvedTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SimulatorTabKey>(() => resolveSimulatorTab(tabParam));
  const { user, configured } = useFirebaseAuth();
  const [inputs, setInputs] = useState<SimulatorInputs>(DEFAULT_SIMULATOR_INPUTS);
  const [yearPlans, setYearPlans] = useState<YearPlanRow[]>(DEFAULT_YEAR_PLANS);
  // 포트폴리오 설정과 "적용된" 가정. 기존 사용자에게 자동 주입하지 않으므로 기본값은 비어 있다.
  // portfolioAssumptions 는 적용 버튼을 눌렀을 때만 채워지고, projection 에 반영된다.
  const [portfolioConfig, setPortfolioConfig] = useState<AssetSimulatorPortfolioConfigV1 | null>(null);
  const [portfolioAssumptions, setPortfolioAssumptions] = useState<AppliedPortfolioAssumptionsV1 | null>(null);
  // 목표 월생활비(현재 가치 기준, 만원). 입력이 있으면 은퇴 안전성 통합 평가가 target 기준으로 전환된다.
  // 값이 없으면(null) 기존 proxy 기반 임시 평가를 유지한다.
  const [targetMonthlyExpenseReal, setTargetMonthlyExpenseReal] = useState<number | null>(null);
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
    // 포트폴리오 설정/적용 가정은 컴포넌트 상태(closure)에서 읽어 저장 payload 에 포함한다.
    // writeLocalConfig 호출부 시그니처는 그대로 유지한다.
    const config = buildStoredSimulatorConfig(nextInputs, nextYearPlans, updatedAt, {
      ...(portfolioConfig ? { portfolioConfig } : {}),
      ...(portfolioAssumptions ? { portfolioAssumptions } : {}),
      // 목표 월생활비도 closure 에서 읽어 저장 payload 에 포함한다(호출부 시그니처는 유지).
      ...(targetMonthlyExpenseReal !== null ? { retirementSafetyConfig: { version: 1 as const, targetMonthlyExpenseReal } } : {}),
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ASSET_SIMULATOR_STORAGE_KEY, JSON.stringify(config));
      // 같은 탭에서 열려 있는 투자현황이 저장된 납입원금을 즉시 반영하도록 알린다.
      window.dispatchEvent(new Event(ASSET_SIMULATOR_SAVED_EVENT));
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
      // 저장된 포트폴리오 설정/적용 가정을 복원한다. 적용 가정은 version 1(applied)만 projection 에 사용한다.
      setPortfolioConfig(config.portfolioConfig ?? null);
      setPortfolioAssumptions(
        config.portfolioAssumptions && "version" in config.portfolioAssumptions && config.portfolioAssumptions.version === 1
          ? config.portfolioAssumptions
          : null,
      );
      // 저장된 목표 월생활비를 복원한다. 없으면 null(임시 평가 유지).
      setTargetMonthlyExpenseReal(config.retirementSafetyConfig?.targetMonthlyExpenseReal ?? null);
      setLastSavedAtMs(config.updatedAtMs);
      if (source === "cloud" && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            ASSET_SIMULATOR_STORAGE_KEY,
            JSON.stringify(buildStoredSimulatorConfig(config.inputs, config.yearPlans, new Date(config.updatedAtMs || Date.now()).toISOString(), {
              ...(config.portfolioConfig ? { portfolioConfig: config.portfolioConfig } : {}),
              ...(config.portfolioAssumptions ? { portfolioAssumptions: config.portfolioAssumptions } : {}),
              ...(config.retirementSafetyConfig ? { retirementSafetyConfig: config.retirementSafetyConfig } : {}),
            })),
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
    () => calculateAssetSimulatorPreview(inputs, yearPlans, exitMode, { portfolioAssumptions }),
    [inputs, yearPlans, exitMode, portfolioAssumptions],
  );

  // 기본 화면/차트는 projection 을 계속 사용하고, 보수적 stress projection 은
  // 은퇴 안전성 비교에만 전달한다. 두 계산에는 동일한 입력과 portfolio assumptions 를 쓴다.
  const stressProjection = useMemo(
    () => calculateAssetSimulatorPreview(inputs, yearPlans, exitMode, {
      portfolioAssumptions,
      stressScenario: { version: 1, preset: "early_downturn" },
    }),
    [inputs, yearPlans, exitMode, portfolioAssumptions],
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

  // 안정성 체크 탭 상태 도트. PortfolioConfigSection 의 applyState 판정과 동일한 기준을 쓴다.
  const safetyDotState: SafetyDotState = useMemo(() => {
    if (!portfolioAssumptions) return "none";
    if (!portfolioConfig || !doPortfolioAssumptionsMatchConfig(portfolioConfig, portfolioAssumptions)) {
      return "attention";
    }
    if (isPortfolioAssumptionsStale(portfolioAssumptions)) return "attention";
    return "ready";
  }, [portfolioAssumptions, portfolioConfig]);

  // "지금 EXIT?" 토글 시 계획표를 자동으로 접고/펼친다.
  // ON → 계산에 쓰이지 않으므로 즉시 접기, OFF → 기본 상태(열림) 복원.
  // 토글 사이에는 사용자가 직접 펼치기/접기 버튼으로 제어할 수 있다.
  const handleExitModeChange = (next: boolean) => {
    setExitMode(next);
    setPlanTableOpen(!next);
  };

  // URL query parameter 변화(?tab=...)에 맞춰 활성 탭을 동기화한다.
  // 직접 진입(?tab=safety)과 뒤로가기/앞으로가기 모두 반영된다.
  useEffect(() => {
    setActiveTab(resolveSimulatorTab(tabParam));
  }, [tabParam]);

  // 탭 클릭 시 활성 탭을 즉시 갱신하고 URL 을 replace 한다(히스토리 오염 방지).
  // 비활성 탭은 언마운트하지 않고 hidden 처리하므로 상태/진행 중 요청은 보존된다.
  const handleTabChange = useCallback(
    (next: SimulatorTabKey) => {
      setActiveTab(next);
      const query = next === "safety" ? "?tab=safety" : "";
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [pathname, router],
  );

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
    setPortfolioConfig(null);
    setPortfolioAssumptions(null);
    setTargetMonthlyExpenseReal(null);

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

  // 저장 안내 footer. 기본/안정성 두 탭 모두 하단에 노출한다.
  // 화이트모드 가독성을 위해 라이트/다크 이중 클래스로 지정한다(기존 다크 하드코딩 제거).
  const savedFooter = (
    <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600 dark:border-[#273032] dark:bg-[#171d1e] dark:text-slate-400">
      {lastSavedAtMs ? `마지막 저장: ${formatSimulatorSavedAt(lastSavedAtMs) ?? "확인 중"} · ` : ""}{user
        ? "로그인 상태에서는 Save 시 계정 클라우드에 저장돼요."
        : configured
          ? "로그아웃 상태에서는 이 브라우저에만 임시 저장돼요."
          : "Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다."} 입력값과 계획표는 금융 API 없이 저장됩니다.
    </p>
  );

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
            헤더 우측: 개인 메모 + "당장탈출" 고라니 버튼.
            메모는 고라니 버튼 옆에 배치하고, 모바일에서는 나란히(메모는 남는 폭 차지,
            버튼은 고정 크기)로 접힌다.
          */}
          <div className="flex flex-row items-start gap-3">
            <AssetSimulatorMemo />

            {/*
              대표 CTA: "당장탈출" 버튼.
              앱 아이콘처럼 보이지 않도록 둥근 마스킹을 최소화(8px)하고,
              얇은 테두리 + 아주 약한 그림자로 "누를 수 있는 버튼" 느낌만 준다(과한 카드 X).
              hover 시 살짝 확대·상승하고 그림자가 약간 진해진다(Glow/색상 변화 없음).
              "지금 EXIT?" 토글 상태와 무관하게 항상 EXIT 모드 기준 요약 모달을 연다.
            */}
            <button
              type="button"
              onClick={() => setExitModalOpen(true)}
              aria-haspopup="dialog"
              aria-label="🚪 당장탈출"
              title="🚪 당장탈출 — 지금 바로 은퇴할 경우의 요약 보기"
              className="group relative mt-0.5 aspect-square w-24 shrink-0 self-start overflow-hidden rounded-lg border border-slate-200/90 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 active:translate-y-0 active:scale-100 dark:border-white/10 sm:w-28"
            >
              {/*
                원본 exit.webp는 캐릭터가 캔버스 가로 약 46%·세로 76%만 차지하고
                주변(좌우 흐린 배경/위 건물/아래 단상)이 비어 보인다. 정사각 이미지를
                정사각 버튼에 object-cover로 넣으면 잘림 없이 전체가 그대로 보여
                캐릭터가 작게(여백 있게) 보인다. 캐릭터 중심(약 52% 40%)을 기준으로
                1.35배 확대해 버튼을 채우고, 넘치는 배경은 버튼의 overflow-hidden이 잘라낸다.
              */}
              <Image
                src="/exit.webp"
                alt=""
                width={1254}
                height={1254}
                sizes="(max-width: 640px) 96px, 112px"
                className="h-full w-full origin-[52%_40%] scale-[1.35] object-cover object-center"
              />
            </button>
          </div>
        </div>

        {/*
          서브탭 바. 계산기 페이지 탭 바 스타일을 참고했다.
          active 탭은 blue primary, inactive 탭은 화이트모드에서도 명확히 보이도록
          text-slate-700 이상을 사용한다. 모바일에서는 overflow-x-auto 로 가로 스크롤.
        */}
        <div
          role="tablist"
          aria-label="자산 시뮬레이터 탭"
          className="no-scrollbar my-5 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#273032] dark:bg-[#171d1e] sm:gap-2 sm:p-2"
        >
          {SIMULATOR_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold transition-colors sm:px-4 sm:text-[13px] ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
                {tab.key === "safety" && (
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      safetyDotState === "ready"
                        ? "bg-emerald-500"
                        : safetyDotState === "attention"
                          ? "bg-amber-500"
                          : "bg-slate-400 dark:bg-slate-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/*
          비활성 탭은 언마운트하지 않고 hidden 처리한다. 이유:
          - PortfolioConfigSection 내부 자동 계산 결과(resolutions) 상태 보존
          - 진행 중 자동 계산 요청 abort 방지
          - 탭 전환 시 입력/계산 중 상태 유실 방지
          hidden 속성만으로 접근성 트리에서도 제외되므로 aria-hidden 은 중복 지정하지 않는다.
        */}
        <section
          role="tabpanel"
          aria-label="기본 시뮬레이터"
          hidden={activeTab !== "basic"}
          className="space-y-5"
        >
          <SimulatorInputPanel inputs={inputs} onChange={handleInputsChange} onReset={handleReset} onSave={handleSave} saving={saving} saveMessage={saveMessage} saveError={saveError} exitMode={exitMode} onExitModeChange={handleExitModeChange} />
          <YearPlanTable plans={tablePlans} onChange={setYearPlans} open={planTableOpen} onToggleOpen={() => setPlanTableOpen((prev) => !prev)} exitMode={exitMode} />
          <SimulatorMetricCards summary={projection.summary} />
          <SimulatorResultTabs projection={projection} />
          {savedFooter}
        </section>

        <section
          role="tabpanel"
          aria-label="안정성 체크"
          hidden={activeTab !== "safety"}
          className="space-y-5"
        >
          {/*
            안정성 체크 탭은 SafetyCheckDashboard 래퍼로 대시보드 레이아웃(요약 바 + 좌 설정/우 결과)을 구성한다.
            설정/상세 섹션은 슬롯으로 전달해 기존 상태 보존 구조와 회귀 검증 배선을 그대로 유지한다.
          */}
          <SafetyCheckDashboard
            projection={projection}
            stressProjection={stressProjection}
            portfolioApplied={portfolioAssumptions !== null}
            targetMonthlyExpenseReal={targetMonthlyExpenseReal}
            onTargetMonthlyExpenseChange={setTargetMonthlyExpenseReal}
            lastSavedAtMs={lastSavedAtMs}
            onSave={handleSave}
            saving={saving}
            saveMessage={saveMessage}
            saveError={saveError}
            configPanel={
              <PortfolioConfigSection
                config={portfolioConfig}
                onConfigChange={setPortfolioConfig}
                appliedAssumptions={portfolioAssumptions}
                onApply={setPortfolioAssumptions}
                portfolioSummary={projection.summary.portfolioSummary}
              />
            }
            safetyPanel={
              <RetirementSafetySection
                projection={projection}
                stressProjection={stressProjection}
                portfolioApplied={portfolioAssumptions !== null}
                targetMonthlyExpenseReal={targetMonthlyExpenseReal}
              />
            }
          />
          {savedFooter}
        </section>
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
