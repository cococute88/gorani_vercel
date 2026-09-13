import type { CharacterId } from "./character-types";

export type CharacterActivity = "roaming" | "fishing" | "bench-sit" | "pond-watch";
type OccupiedActivity = "fishing" | "bench-sit";

const occupied = (activity: CharacterActivity): activity is OccupiedActivity =>
  activity === "fishing" || activity === "bench-sit";

/** One authority for the two shared slots and each character's exclusive activity. */
export class CharacterActivityCoordinator {
  private readonly activities: Record<CharacterId, CharacterActivity> = { gorani: "roaming", daramji: "roaming" };
  private readonly owners: Record<OccupiedActivity, CharacterId | null> = { fishing: null, "bench-sit": null };

  constructor(private readonly onDisplaced: (id: CharacterId, activity: OccupiedActivity) => Promise<void>) {}

  getActivity(id: CharacterId): CharacterActivity { return this.activities[id]; }
  getOwner(activity: OccupiedActivity): CharacterId | null { return this.owners[activity]; }

  /** Ownership changes synchronously; arrival waits until the prior occupant has left. */
  setCharacterActivity(id: CharacterId, activity: CharacterActivity): Promise<void> {
    if (this.activities[id] === activity) return Promise.resolve();
    const previous = this.activities[id];
    if (occupied(previous) && this.owners[previous] === id) this.owners[previous] = null;

    let departure = Promise.resolve();
    if (occupied(activity)) {
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
