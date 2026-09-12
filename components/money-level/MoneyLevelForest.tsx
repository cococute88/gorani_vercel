"use client";
/* eslint-disable @next/next/no-img-element -- Phase 2 intentionally preserves approved PNG masters without Next image optimization. */
/* eslint-disable @next/next/no-img-element -- approved PNG masters are intentionally unoptimized in this phase */

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import TopNav from "@/components/TopNav";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import {
  usePortfolioRefresh,
  type PortfolioRefreshOutcome,
} from "@/lib/portfolio-firestore-snapshot-sync";
import { useMoneyLevelPortfolioSnapshot } from "@/lib/money-level/use-money-level-portfolio-snapshot";
import {
  calculateMoneyLevelIncome,
  calculateMoneyLevelMp,
  houseDisplayLevel,
  toHpHearts,
  toTenthHearts,
} from "@/lib/money-level/finance";
import { resolveMoneyLevelPortfolioHouses } from "@/lib/money-level/house-stages";
import { calculateRetirementProgress } from "@/lib/money-level/retirement";
import {
  DEFAULT_MONEY_LEVEL_SETTINGS,
  normalizeMoneyLevelSettings,
} from "@/lib/money-level/settings";
import { isSuspiciousMoneyLevelUpdatedAt } from "@/lib/money-level/portfolio-selector";
import { useMoneyLevelMarketWeather, type MoneyLevelWeatherState } from "@/lib/money-level/use-money-level-market-weather";
import { resolveMoneyLevelTimeOfDay } from "@/lib/money-level/weather";
import type {
  HeartBreakdown,
  HpHeartBreakdown,
  MoneyLevelPortfolioSnapshot,
  MoneyLevelSettings,
} from "@/lib/money-level/types";
import MoneyLevelScene from "./MoneyLevelScene";
import MoneyLevelSettingsDialog from "./MoneyLevelSettings";

const SETTINGS_KEY = "gorani.money-level.settings.v1";
const SNAPSHOT_KEY = "gorani.money-level.snapshot.v1";
const EMPTY_SNAPSHOT: MoneyLevelPortfolioSnapshot = {
  brokerageValue: 0,
  isaPrincipal: 0,
  pensionPrincipal: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};
const phrases = [
  "오늘도 천천히 갑니다.", "조금씩 자유로워지는 중.", "곰라니는 산책 중이에요.",
  "다람쥐는 오늘도 바빠요.", "숲이 잘 자라고 있어요.", "오늘도 좋은 하루예요.", "머니파워 충전 중.",
] as const;

type SyncMessage = { kind: "normal" | "error"; text: string } | null;

export default function MoneyLevelForest() {
  const theme = useResolvedTheme();
  const live = useMoneyLevelPortfolioSnapshot();
  const refreshController = usePortfolioRefresh();
  const [settings, setSettings] = useState<MoneyLevelSettings>({ ...DEFAULT_MONEY_LEVEL_SETTINGS });
  const [lastGood, setLastGood] = useState<MoneyLevelPortfolioSnapshot | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phrase, setPhrase] = useState<(typeof phrases)[number]>(phrases[0]);
  const [syncMessage, setSyncMessage] = useState<SyncMessage>(null);
  const [manualLiveAccepted, setManualLiveAccepted] = useState(false);
  const [now] = useState(() => new Date());
  const marketWeather = useMoneyLevelMarketWeather(now);

  useEffect(() => {
    setSettings(readStoredSettings());
    setLastGood(readStoredSnapshot());
    setPhrase(sample(phrases));
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || !live.snapshot) return;
    const authoritative = live.syncStatus === "applied" || manualLiveAccepted;
    if (!authoritative && lastGood) return;
    setLastGood(live.snapshot);
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(live.snapshot));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.warn("[Money Level] last-good snapshot cache write failed", error);
    }
  }, [lastGood, live.snapshot, live.syncStatus, manualLiveAccepted, storageReady]);

  useEffect(() => {
    const suspicious = live.diagnostics.filter(({ code }) => code === "updated_at_epoch_fallback" || code === "updated_at_invalid");
    if (suspicious.length > 0 && process.env.NODE_ENV !== "production") {
      console.warn("[Money Level] suspicious portfolio timestamp", suspicious);
    }
  }, [live.diagnostics]);

  const liveIsAuthoritative = live.syncStatus === "applied" || manualLiveAccepted;
  const snapshot = lastGood && !liveIsAuthoritative ? lastGood : live.snapshot ?? lastGood;
  const sceneSnapshot = snapshot ?? (marketWeather.fallback === "forced-preview" ? EMPTY_SNAPSHOT : null);
  const displaySnapshot = snapshot ?? EMPTY_SNAPSHOT;
  const calculations = useMemo(() => {
    const income = calculateMoneyLevelIncome(displaySnapshot, settings);
    const mp = calculateMoneyLevelMp(displaySnapshot);
    const hearts = {
      brokerage: toHpHearts(income.brokerageMonthlyIncome),
      isa: toHpHearts(income.isaMonthlyIncome),
      pension: toHpHearts(income.pensionMonthlyIncome),
      mp: toTenthHearts(mp),
    };
    const houses = resolveMoneyLevelPortfolioHouses(displaySnapshot);
    return {
      income,
      mp,
      hearts,
      houses,
      brokerageLevel: houseDisplayLevel(hearts.brokerage),
      taxLevel: houseDisplayLevel(hearts.isa, hearts.pension),
      retirement: calculateRetirementProgress(now, settings.retirementDate),
    };
  }, [displaySnapshot, now, settings]);

  const weather = marketWeather.weather;
  const timeOfDay = resolveMoneyLevelTimeOfDay(now);
  const isCachedFallback = Boolean(lastGood) && !liveIsAuthoritative;
  const suspiciousUpdatedAt = snapshot ? isSuspiciousMoneyLevelUpdatedAt(snapshot.updatedAt) : false;

  const handleSync = async () => {
    setSyncMessage({ kind: "normal", text: "숲에 새 소식을 가져오는 중…" });
    const outcome: PortfolioRefreshOutcome = await refreshController.refresh();
    setPhrase(sample(phrases));
    if (outcome === "error") {
      setSyncMessage({ kind: "error", text: "동기화 실패 · 마지막 정상 데이터 사용 중" });
      return;
    }
    if (outcome === "updated") setManualLiveAccepted(true);
    setSyncMessage({ kind: "normal", text: outcome === "updated" ? "동기화 완료 · 새 데이터를 반영했어요." : "동기화 완료 · 이미 최신이에요." });
  };

  const saveSettings = (next: MoneyLevelSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.warn("[Money Level] settings cache write failed", error);
    }
  };

  return (
    <>
      <TopNav theme={theme} />
      <div
        className="moneyLevelRoot"
        data-money-level-ready={snapshot ? "true" : "false"}
        data-brokerage-value={snapshot?.brokerageValue ?? ""}
        data-isa-principal={snapshot?.isaPrincipal ?? ""}
        data-pension-principal={snapshot?.pensionPrincipal ?? ""}
        data-updated-at={snapshot?.updatedAt ?? ""}
        data-brokerage-level={snapshot ? calculations.brokerageLevel : ""}
        data-tax-level={snapshot ? calculations.taxLevel : ""}
        data-brokerage-stage={snapshot ? calculations.houses.brokerage.art : ""}
        data-tax-stage={snapshot ? calculations.houses.taxAdvantaged.art : ""}
        data-weather={weather}
        data-weather-fallback={String(marketWeather.fallback)}
      >
        <main className={`forest-shell weather-${weather} time-${timeOfDay}`}>
          <section className="forest-card" aria-label="곰라니 머니레벨 숲">
            <header className="topbar">
              <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">♧</span><div><p>나의 작은 자산 숲</p><h1>곰라니 머니레벨</h1></div></div>
              <div className="topbar-actions">
                <Link href="/portfolio" className="icon-button icon-button-back" aria-label="포트폴리오로 돌아가기" title="포트폴리오로 돌아가기"><span aria-hidden="true">←</span></Link>
                <button className="icon-button" type="button" aria-label="설정 열기" onClick={() => setSettingsOpen(true)}>⚙</button>
              </div>
            </header>
            <section className="money-hud" aria-label="금융 상태" aria-busy={!storageReady || live.syncStatus === "loading"}>
              <div className="retirement-card">
                <div className="hud-heading"><span>은퇴까지</span><strong>{calculations.retirement.remainingMonths}개월</strong></div>
                <div className="progress-track" role="progressbar" aria-label="은퇴 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(calculations.retirement.progress * 100)}><i style={{ width: `${calculations.retirement.progress * 100}%` }} /></div>
                <div className="progress-meta"><span>{calculations.retirement.currentMonth} / {calculations.retirement.totalMonths}개월차</span><b>{(calculations.retirement.progress * 100).toFixed(1)}%</b></div>
              </div>
              <div className="heart-row hp-row"><div className="hud-label"><span>HP</span><small>월 {formatWon(calculations.income.totalMonthlyIncome)}</small></div><div className="heart-groups"><HpGroup label="위탁" color="brokerage" breakdown={calculations.hearts.brokerage} /><HpGroup label="ISA" color="isa" breakdown={calculations.hearts.isa} /><HpGroup label="연금" color="pension" breakdown={calculations.hearts.pension} /></div></div>
              <div className="heart-row mp-row"><div className="hud-label"><span>MP</span><small>{(calculations.mp / 100_000_000).toFixed(1)}억원</small></div><div className="heart-groups"><HeartGroup label="전체 자산" color="mp" breakdown={calculations.hearts.mp} /></div></div>
            </section>
            {sceneSnapshot ? (
              <MoneyLevelScene
                brokerageStage={calculations.houses.brokerage}
                taxStage={calculations.houses.taxAdvantaged}
                brokerageValue={sceneSnapshot.brokerageValue}
                taxValue={sceneSnapshot.isaPrincipal + sceneSnapshot.pensionPrincipal}
                brokerageLevel={calculations.brokerageLevel}
                taxLevel={calculations.taxLevel}
                weather={weather}
                timeOfDay={timeOfDay}
                phrase={phrase}
              />
            ) : (
              <section className="forest-scene forest-empty" aria-label="포트폴리오 데이터 대기 중">
                <div className="scene-illustration" aria-hidden="true"><img src="/money-level/art/background/cozy-forest-base.webp" alt="" draggable={false} /></div>
                <div className="scene-tint" aria-hidden="true" />
                <div className="empty-forest-copy" role="status"><strong>{live.syncStatus === "loading" ? "숲을 불러오는 중이에요…" : "포트폴리오 데이터를 아직 불러오지 못했어요."}</strong><Link href="/portfolio">포트폴리오 보기</Link></div>
              </section>
            )}
            {isCachedFallback ? <div className="source-notice is-error">최신 데이터를 불러오지 못해 마지막 정상 숲을 보여드리고 있어요.</div> : null}
            {marketWeather.debugEnabled ? <MarketWeatherDebug state={marketWeather} /> : null}
            <footer className="forest-footer">
              <div className={`sync-copy${syncMessage?.kind === "error" ? " is-error" : ""}`} title={suspiciousUpdatedAt ? "동기화 시간이 확인이 필요합니다." : undefined}><span className="status-dot" /><span>{syncMessage?.text ?? (snapshot ? <>마지막 동기화 <time>{formatSyncTime(snapshot.updatedAt)}</time>{suspiciousUpdatedAt ? " · 시간 확인 필요" : ""}</> : "동기화된 데이터 없음")}</span></div>
              <button className="sync-button" type="button" onClick={() => void handleSync()} disabled={refreshController.isRefreshing} aria-busy={refreshController.isRefreshing}><span aria-hidden="true">↻</span> 동기화</button>
            </footer>
          </section>
        </main>
        <MoneyLevelSettingsDialog open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />
      </div>
    </>
  );
}

function HpGroup({ label, color, breakdown }: { label: string; color: string; breakdown: HpHeartBreakdown }) {
  return <HeartGroup label={label} color={color} breakdown={breakdown} special={breakdown.special} />;
}

function HeartGroup({ label, color, breakdown, special = 0 }: { label: string; color: string; breakdown: HeartBreakdown; special?: number }) {
  const accessible = `${label} 월 100만원 하트 ${special}개, 일반 하트 ${breakdown.full}개, 반하트 ${breakdown.fraction ? 1 : 0}개`;
  return (
    <span className={`heart-group heart-${color}`} aria-label={accessible}>
      <small>{label}</small>
      <span>
        {Array.from({ length: special }, (_, index) => <span key={`special-${index}`} className="heart heart-special heart-special-ruby" title="월 100만원" aria-hidden="true">♥</span>)}
        {Array.from({ length: breakdown.full }, (_, index) => <span key={`full-${index}`} className="heart heart-full" aria-hidden="true">♥</span>)}
        {breakdown.fraction > 0 ? <span className="heart heart-fraction" style={{ "--fill": `${breakdown.fraction * 100}%` } as CSSProperties} aria-hidden="true"><i>♥</i><b>♥</b></span> : null}
      </span>
    </span>
  );
}

function readStoredSettings(): MoneyLevelSettings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<MoneyLevelSettings> | null;
    return normalizeMoneyLevelSettings(value);
  } catch {
    return { ...DEFAULT_MONEY_LEVEL_SETTINGS };
  }
}

function readStoredSnapshot(): MoneyLevelPortfolioSnapshot | null {
  try {
    const value = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "null") as Partial<MoneyLevelPortfolioSnapshot> | null;
    return value
      && [value.brokerageValue, value.isaPrincipal, value.pensionPrincipal].every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0)
      && typeof value.updatedAt === "string"
      ? value as MoneyLevelPortfolioSnapshot
      : null;
  } catch {
    return null;
  }
}

function formatWon(value: number): string { return `${Math.round(value).toLocaleString("ko-KR")}원`; }
function formatSyncTime(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(parsed) : "시간 미상";
}
function sample<T>(values: readonly T[]): T { return values[Math.floor(Math.random() * values.length)]; }

function MarketWeatherDebug({ state }: { state: MoneyLevelWeatherState }) {
  const data = state.market;
  return (
    <aside className="weather-debug" aria-label="Market weather debug">
      <b>Market weather debug</b>
      <span>sessions: {data ? `${data.previousSessionDate} → ${data.latestSessionDate}` : "unavailable"}</span>
      <span>closes: {data ? `${data.previousClose} → ${data.latestClose}` : "unavailable"}</span>
      <span>change: {data ? `${data.changePct.toFixed(4)}%` : "unavailable"}</span>
      <span>resolved: {data?.resolvedWeather ?? "unavailable"}</span>
      <span>displayed: {state.weather}</span>
      <span>source: {data?.source ?? "none"} · fallback: {String(state.fallback)}</span>
    </aside>
  );
}
