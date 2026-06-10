import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import type { StoredSimulatorPreview } from "@/lib/asset-simulator-types";
import { firestoreDb } from "./client";

export type CalendarTickerData = {
  ticker: string;
  name?: string;
  enabled?: boolean;
};

export type CalendarEventMeta = {
  eventId: string;
  ticker?: string;
  star?: boolean;
  heart?: boolean;
  memo?: string;
};

export type CalculatorPresetType = "dividend-capture" | "conversion" | "mdd";

export type CalculatorPreset = {
  id: string;
  type: CalculatorPresetType;
  name: string;
  values: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function requireDb() {
  if (!firestoreDb) throw new Error("Firebase is not configured");
  return firestoreDb;
}

function userDoc(uid: string) {
  return doc(requireDb(), "users", uid);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const ref = userDoc(user.uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function savePortfolioSnapshot(uid: string, snapshot: PortfolioSnapshot): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "portfolioSnapshots", snapshot.id), {
    ...snapshot,
    updatedAt: serverTimestamp(),
  });
}

export async function loadPortfolioSnapshots(uid: string): Promise<PortfolioSnapshot[]> {
  const snap = await getDocs(query(collection(requireDb(), "users", uid, "portfolioSnapshots"), orderBy("snapshotDate", "asc")));
  return snap.docs.map((item) => item.data() as unknown as PortfolioSnapshot);
}

export async function deletePortfolioSnapshot(uid: string, snapshotId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "portfolioSnapshots", snapshotId));
}

export async function saveCalendarTicker(uid: string, tickerData: CalendarTickerData): Promise<void> {
  const ticker = tickerData.ticker.trim().toUpperCase();
  await setDoc(
    doc(requireDb(), "users", uid, "calendarTickers", ticker),
    { ...tickerData, ticker, enabled: tickerData.enabled ?? true, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadCalendarTickers(uid: string): Promise<CalendarTickerData[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarTickers"));
  return snap.docs.map((item) => item.data() as unknown as CalendarTickerData);
}

export async function deleteCalendarTicker(uid: string, ticker: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "calendarTickers", ticker.trim().toUpperCase()));
}

export async function saveCalendarSettings(uid: string, settings: Record<string, unknown>): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calendarSettings", "default"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveCalendarEventMeta(uid: string, eventId: string, meta: CalendarEventMeta): Promise<void> {
  await setDoc(
    doc(requireDb(), "users", uid, "calendarEvents", eventId),
    { ...meta, eventId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadCalendarEventMetas(uid: string): Promise<CalendarEventMeta[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calendarEvents"));
  return snap.docs.map((item) => item.data() as unknown as CalendarEventMeta);
}

export async function saveAssetSimulatorConfig(uid: string, config: StoredSimulatorPreview): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"), {
    ...config,
    updatedAt: serverTimestamp(),
  });
}

export async function loadAssetSimulatorConfig(uid: string): Promise<StoredSimulatorPreview | null> {
  const snap = await getDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"));
  return snap.exists() ? (snap.data() as unknown as StoredSimulatorPreview) : null;
}

export async function deleteAssetSimulatorConfig(uid: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "assetSimulatorConfigs", "default"));
}

export async function saveCalculatorPreset(uid: string, preset: CalculatorPreset): Promise<void> {
  await setDoc(doc(requireDb(), "users", uid, "calculatorPresets", preset.id), {
    ...preset,
    updatedAt: serverTimestamp(),
    createdAt: preset.createdAt ?? serverTimestamp(),
  });
}

export async function loadCalculatorPresets(uid: string): Promise<CalculatorPreset[]> {
  const snap = await getDocs(collection(requireDb(), "users", uid, "calculatorPresets"));
  return snap.docs.map((item) => item.data() as unknown as CalculatorPreset);
}

export async function deleteCalculatorPreset(uid: string, presetId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), "users", uid, "calculatorPresets", presetId));
}

export function warnFirestoreFallback(scope: string, err: unknown): void {
  console.warn(`${scope} Firestore operation failed; keeping localStorage fallback`, err as DocumentData);
}
