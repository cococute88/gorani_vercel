"use client";

import { useEffect, useState } from "react";
import { ASSET_SIMULATOR_STORAGE_KEY } from "@/lib/mock-asset-simulator-data";
import { normalizePersistedSimulatorConfig } from "@/lib/asset-simulator-persistence";

// 절세계좌 "납입원금"은 자산시뮬레이터 기본 설정의
//   기존 ISA 잔고(만원) + 기존 연금저축 잔고(만원)
// 을 합산한 값(원)이다. 자산시뮬레이터는 Save 시에만 localStorage 에 기록하므로,
// 저장(Save) 이후에만 투자현황에 반영된다(입력 중에는 반영되지 않는다).

// 만원 → 원 환산 계수. 시뮬레이터 입력값(initialIsa/initialPension)은 만원 단위다.
const MANWON_TO_KRW = 10_000;

// 자산시뮬레이터 Save 시 같은 탭 안에서도 즉시 반영되도록 발행하는 커스텀 이벤트.
// (다른 탭은 브라우저의 native "storage" 이벤트로 반영된다.)
export const ASSET_SIMULATOR_SAVED_EVENT = "gorani:asset-simulator-saved";

// 저장된 시뮬레이터 설정에서 납입원금(원)을 읽는다. 저장값이 없으면 null.
export function readSavedTaxAccountPrincipalKRW(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(ASSET_SIMULATOR_STORAGE_KEY);
    if (!stored) return null;
    const config = normalizePersistedSimulatorConfig(JSON.parse(stored), "local");
    if (!config) return null;
    const isaManwon = Number.isFinite(config.inputs.initialIsa) ? config.inputs.initialIsa : 0;
    const pensionManwon = Number.isFinite(config.inputs.initialPension) ? config.inputs.initialPension : 0;
    return (isaManwon + pensionManwon) * MANWON_TO_KRW;
  } catch {
    return null;
  }
}

// 투자현황이 저장된 납입원금(원)을 구독한다. Save(같은 탭 커스텀 이벤트) 및
// 다른 탭 저장(native storage 이벤트) 시 자동으로 갱신된다.
export function useTaxAccountPrincipalKRW(): number | null {
  const [principalKRW, setPrincipalKRW] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setPrincipalKRW(readSavedTaxAccountPrincipalKRW());
    sync();

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === ASSET_SIMULATOR_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ASSET_SIMULATOR_SAVED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ASSET_SIMULATOR_SAVED_EVENT, sync);
    };
  }, []);

  return principalKRW;
}
