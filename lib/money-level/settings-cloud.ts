import { doc, getDocFromServer, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import type { SettingsCloud } from "./settings-persistence";
import type { MoneyLevelSettings } from "./types";

export const moneyLevelSettingsPath = (uid: string) => `users/${uid}/uiPreferences/moneyLevel`;
export function createSettingsCloud(uid: string): SettingsCloud | null {
  if (!firestoreDb) return null;
  const db = firestoreDb;
  const ref = doc(db, moneyLevelSettingsPath(uid));
  return {
    async load() {
      // A failed server read is unavailable, never an absent Cloud document.
      const snap = await getDocFromServer(ref);
      return snap.exists() ? snap.data().settings as Partial<MoneyLevelSettings> ?? {} : null;
    },
    async migrate(settings) {
      return runTransaction(db, async transaction => {
        const snap = await transaction.get(ref);
        if (snap.exists()) return snap.data().settings as Partial<MoneyLevelSettings> ?? {};
        transaction.set(ref, { schemaVersion: 2, settings, migratedFrom: "gorani.money-level.settings.v1", updatedAt: serverTimestamp() }, { merge: true });
        return settings;
      });
    },
    async save(settings) {
      await setDoc(ref, { schemaVersion: 2, settings, updatedAt: serverTimestamp() }, { merge: true });
    },
  };
}
