import { SlotContent } from "./Inventory";

/** Slots per chest: 3 rows of 9, matching the player's own storage rows. */
export const CHEST_SLOT_COUNT = 27;

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Tracks each placed chest's contents, keyed by world position. Chests are real blocks (see blocks.ts), so placement/mining/collision reuse the normal block system - this just owns the extra per-chest inventory data. */
export class ChestManager {
  private readonly chests = new Map<string, SlotContent[]>();

  /** Returns the chest's slots at (x, y, z), creating an empty one if none exists yet. */
  getOrCreate(x: number, y: number, z: number): SlotContent[] {
    const k = key(x, y, z);
    let slots = this.chests.get(k);
    if (!slots) {
      slots = new Array(CHEST_SLOT_COUNT).fill(null);
      this.chests.set(k, slots);
    }
    return slots;
  }

  has(x: number, y: number, z: number): boolean {
    return this.chests.has(key(x, y, z));
  }

  /** Removes and returns the chest's contents (e.g. when mined), or null if there wasn't one. */
  remove(x: number, y: number, z: number): SlotContent[] | null {
    const k = key(x, y, z);
    const slots = this.chests.get(k);
    if (!slots) return null;
    this.chests.delete(k);
    return slots;
  }

  /** For save/load: every chest's position and contents. */
  getSnapshot(): { x: number; y: number; z: number; slots: SlotContent[] }[] {
    const out: { x: number; y: number; z: number; slots: SlotContent[] }[] = [];
    for (const [k, slots] of this.chests) {
      const [x, y, z] = k.split(",").map(Number);
      out.push({ x, y, z, slots: slots.map((s) => (s ? { ...s } : null)) });
    }
    return out;
  }

  loadSnapshot(data: { x: number; y: number; z: number; slots: SlotContent[] }[]): void {
    this.chests.clear();
    for (const entry of data) {
      this.chests.set(key(entry.x, entry.y, entry.z), entry.slots.map((s) => (s ? { ...s } : null)));
    }
  }
}
