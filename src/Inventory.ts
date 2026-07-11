import { BlockType, BLOCKS } from "./blocks";

export const RESOURCE_SLOT_COUNT = 8;
export const TOOL_SLOT_INDEX = 0;

export interface ResourceSlot {
  block: BlockType;
  count: number;
}

/**
 * Hotbar slot 0 is always the pickaxe (the mining tool, never consumed).
 * Slots 1..RESOURCE_SLOT_COUNT hold whatever blocks the player has mined,
 * appearing as they're first collected and disappearing once used up.
 */
export class Inventory {
  private readonly resourceSlots: (ResourceSlot | null)[] = new Array(RESOURCE_SLOT_COUNT).fill(null);
  private selected = TOOL_SLOT_INDEX;

  getResourceSlots(): ReadonlyArray<ResourceSlot | null> {
    return this.resourceSlots;
  }

  getSelectedIndex(): number {
    return this.selected;
  }

  select(index: number): void {
    if (index < 0 || index > RESOURCE_SLOT_COUNT) return;
    this.selected = index;
  }

  isToolSelected(): boolean {
    return this.selected === TOOL_SLOT_INDEX;
  }

  /** Adds one of `block` to the first matching or empty resource slot. */
  add(block: BlockType): void {
    if (!BLOCKS[block].placeable) return;
    const existing = this.resourceSlots.findIndex((slot) => slot?.block === block);
    if (existing !== -1) {
      this.resourceSlots[existing]!.count++;
      return;
    }
    const empty = this.resourceSlots.findIndex((slot) => slot === null);
    if (empty !== -1) {
      this.resourceSlots[empty] = { block, count: 1 };
    }
  }

  getSelectedBlock(): BlockType | null {
    if (this.isToolSelected()) return null;
    return this.resourceSlots[this.selected - 1]?.block ?? null;
  }

  /** Consumes one of the currently selected resource; returns false if none is available. */
  consumeSelected(): boolean {
    if (this.isToolSelected()) return false;
    const slot = this.resourceSlots[this.selected - 1];
    if (!slot) return false;
    slot.count--;
    if (slot.count <= 0) {
      this.resourceSlots[this.selected - 1] = null;
    }
    return true;
  }
}
