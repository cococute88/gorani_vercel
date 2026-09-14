import { normalizeMoneyLevelSettings } from "./settings";
import type { MoneyLevelSettings } from "./types";

export const LEGACY_SETTINGS_KEY = "gorani.money-level.settings.v1";
const MIGRATED_UID_KEY = "gorani.money-level.settings.migrated-uid";
export const settingsCacheKey = (uid: string | null) => `gorani.money-level.settings.v2.${uid ?? "guest"}`;
export type SettingsStatus = "uninitialized" | "loading" | "ready";
export interface SettingsCloud {
  load(): Promise<Partial<MoneyLevelSettings> | null>;
  /** Returns the existing cloud value if another session won migration. */
  migrate(settings: MoneyLevelSettings): Promise<Partial<MoneyLevelSettings>>;
  save(patch: Partial<MoneyLevelSettings>): Promise<void>;
}
type Cache = { settings: MoneyLevelSettings; pending: Partial<MoneyLevelSettings> };
export type SettingsState = { status: SettingsStatus; settings: MoneyLevelSettings; source: "cloud" | "local"; error: string | null };

/** No save effect: only an explicit edit or a verified legacy migration writes. */
export class MoneyLevelSettingsSession {
  state: SettingsState = { status: "uninitialized", settings: normalizeMoneyLevelSettings(null), source: "local", error: null };
  private disposed = false;
  private revision = 0;
  private pending: Partial<MoneyLevelSettings> = {};
  private writes = Promise.resolve();
  constructor(private uid: string | null, private storage: Pick<Storage, "getItem" | "setItem">,
    private cloud: SettingsCloud | null, private changed: (state: SettingsState) => void) {}
  dispose(): void { this.disposed = true; }
  private publish(state: SettingsState): void { if (!this.disposed) { this.state = state; this.changed(state); } }
  private read(key: string): unknown {
    try { return JSON.parse(this.storage.getItem(key) ?? "null"); } catch { return null; }
  }
  private writeCache(): void {
    try { this.storage.setItem(settingsCacheKey(this.uid), JSON.stringify({ settings: this.state.settings, pending: this.pending })); }
    catch { /* Storage-restricted sessions can still use Cloud. */ }
  }
  async hydrate(): Promise<void> {
    this.publish({ ...this.state, status: "loading" });
    const raw = this.read(settingsCacheKey(this.uid)) as Cache | null;
    const marker = (() => { try { return this.storage.getItem(MIGRATED_UID_KEY); } catch { return null; } })();
    const legacy = !this.uid || !marker || marker === this.uid ? this.read(LEGACY_SETTINGS_KEY) as Partial<MoneyLevelSettings> | null : null;
    const local = raw?.settings ?? legacy;
    this.pending = raw?.pending ?? {};
    let settings = normalizeMoneyLevelSettings(local), source: "cloud" | "local" = "local", error: string | null = null;
    let hasPersistedValue = Boolean(local);
    if (this.cloud) {
      try {
        let remote = await this.cloud.load();
        hasPersistedValue ||= remote !== null;
        if (this.disposed) return;
        if (!remote && local) {
          remote = await this.cloud.migrate(settings);
          if (this.disposed) return;
          if (this.uid) { try { this.storage.setItem(MIGRATED_UID_KEY, this.uid); } catch { /* best effort */ } }
        }
        if (Object.keys(this.pending).length) {
          // Explicit offline edits replay as a field patch, preserving other
          // values changed by another session. Defaults never become a patch.
          await this.cloud.save(this.pending);
          remote = { ...remote, ...this.pending };
          this.pending = {};
        }
        settings = normalizeMoneyLevelSettings(remote);
        source = "cloud";
      } catch { error = "Cloud 설정을 불러오지 못해 이 기기의 저장값을 사용합니다."; }
    }
    if (this.disposed) return;
    this.publish({ status: "ready", settings, source, error });
    // Do not cache defaults when neither local nor Cloud contains a document.
    if (hasPersistedValue) this.writeCache();
  }
  save(next: MoneyLevelSettings): Promise<void> {
    if (this.disposed || this.state.status !== "ready") return Promise.reject(new Error("Settings are not hydrated"));
    const settings = normalizeMoneyLevelSettings(next);
    const patch: Partial<MoneyLevelSettings> = {};
    for (const key of Object.keys(settings) as (keyof MoneyLevelSettings)[]) {
      if (settings[key] !== this.state.settings[key]) Object.assign(patch, { [key]: settings[key] });
    }
    const revision = ++this.revision;
    this.pending = { ...this.pending, ...patch };
    this.publish({ ...this.state, settings, error: null });
    this.writeCache();
    if (!this.cloud || !Object.keys(this.pending).length) return Promise.resolve();
    const payload = { ...this.pending };
    this.writes = this.writes.then(async () => {
      try {
        await this.cloud!.save(payload);
        if (revision === this.revision) {
          this.pending = {};
          this.publish({ ...this.state, source: "cloud", error: null });
          this.writeCache();
        }
      } catch {
        this.publish({ ...this.state, source: "local", error: "이 기기에 저장했습니다. Cloud 연결이 복구되면 동기화합니다." });
      }
    });
    return this.writes;
  }
}
