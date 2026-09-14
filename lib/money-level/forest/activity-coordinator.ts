import type { CharacterId } from "./character-types";
import { CEREMONY_SLOT_IDS, CEREMONY_SLOTS, type CeremonySlotId } from "./statue-view";

export type CharacterActivity = "roaming" | "fishing" | "bench-sit" | "pond-watch" | "statue-ceremony";
export type OccupiedActivity = "fishing" | "bench-sit" | "statue-ceremony";

const occupied = (activity: CharacterActivity): activity is OccupiedActivity =>
  activity === "fishing" || activity === "bench-sit" || activity === "statue-ceremony";

/** Exclusive fishing/bench seats; three ceremony slots for two known actors. */
export class CharacterActivityCoordinator {
  private readonly activities: Record<CharacterId, CharacterActivity> = { gorani: "roaming", daramji: "roaming" };
  private readonly owners: Record<OccupiedActivity, CharacterId | null> = { fishing: null, "bench-sit": null, "statue-ceremony": null };
  private readonly ceremonyOwners: Record<CeremonySlotId, CharacterId | null> = { CEREMONY_LEFT_A: null, CEREMONY_LEFT_B: null, CEREMONY_RIGHT: null };

  constructor(private readonly onDisplaced: (id: CharacterId, activity: OccupiedActivity) => Promise<void>) {}

  getActivity(id: CharacterId): CharacterActivity { return this.activities[id]; }
  getOwner(activity: OccupiedActivity): CharacterId | null {
    return activity === "statue-ceremony" ? Object.values(this.ceremonyOwners).find(Boolean) ?? null : this.owners[activity];
  }
  getCeremonyOwners(): Readonly<Record<CeremonySlotId, CharacterId | null>> { return { ...this.ceremonyOwners }; }
  getCeremonySlot(id: CharacterId): CeremonySlotId | null { return CEREMONY_SLOT_IDS.find(slot => this.ceremonyOwners[slot] === id) ?? null; }
  private releaseCeremony(id: CharacterId): void {
    for (const slot of CEREMONY_SLOT_IDS) if (this.ceremonyOwners[slot] === id) this.ceremonyOwners[slot] = null;
  }
  claimCeremony(id: CharacterId, target: CeremonySlotId, available: readonly CeremonySlotId[] = CEREMONY_SLOT_IDS): CeremonySlotId | null {
    // Release first, including moves between slots. The just-vacated anchor
    // becomes a candidate when the target belongs to the other actor.
    this.releaseCeremony(id);
    const anchor = CEREMONY_SLOTS[target].anchor;
    const free = available.filter(slot => !this.ceremonyOwners[slot]).sort((a,b) =>
      Math.hypot(CEREMONY_SLOTS[a].anchor.x-anchor.x,CEREMONY_SLOTS[a].anchor.y-anchor.y)
      - Math.hypot(CEREMONY_SLOTS[b].anchor.x-anchor.x,CEREMONY_SLOTS[b].anchor.y-anchor.y));
    const slot = free[0];
    if (!slot) return null;
    this.ceremonyOwners[slot] = id;
    return slot;
  }

  /** Ownership changes synchronously; arrival waits until the prior occupant has left. */
  setCharacterActivity(id: CharacterId, activity: CharacterActivity): Promise<void> {
    if (activity !== "statue-ceremony") this.releaseCeremony(id);
    else if (!this.getCeremonySlot(id)) this.claimCeremony(id, "CEREMONY_LEFT_A");
    if (this.activities[id] === activity) return Promise.resolve();
    const previous = this.activities[id];
    if (occupied(previous) && this.owners[previous] === id) this.owners[previous] = null;

    let departure = Promise.resolve();
    if (occupied(activity) && activity !== "statue-ceremony") {
      const displaced = this.owners[activity];
      if (displaced && displaced !== id) {
        this.activities[displaced] = "roaming";
        departure = this.onDisplaced(displaced, activity);
      }
      this.owners[activity] = id;
    }
    this.activities[id] = activity;
    return departure;
  }
}
