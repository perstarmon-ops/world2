import { BlockType, BLOCKS } from "./blocks";

export type Tool = "pickaxe" | "axe" | "shovel" | "sword";

export const TOOL_SLOTS: Tool[] = ["pickaxe", "axe", "shovel", "sword"];
export const RESOURCE_SLOT_COUNT = 5;
export const TOTAL_SLOT_COUNT = TOOL_SLOTS.length + RESOURCE_SLOT_COUNT;

export interface ResourceSlot {
  block: BlockType;
  count: number;
}

/**
 * The first TOOL_SLOTS.length hotbar slots are fixed tools (pickaxe, axe,
 * shovel, sword - never consumed). The rest hold whatever blocks the player
 * has mined, appearing as they're first collected and disappearing once used
 * up.
 */
export class Inventory {
  private readonly resourceSlots: (ResourceSlot | null)[] = new Array(RESOURCE_SLOT_COUNT).fill(null);
  private selected = 0;

  getResourceSlots(): ReadonlyArray<ResourceSlot | null> {
    return this.resourceSlots;
  }

  getSelectedIndex(): number {
    return this.selected;
  }

  select(index: number): void {
    if (index < 0 || index >= TOTAL_SLOT_COUNT) return;
    this.selected = index;
  }

  /** The currently selected tool, or null if a resource slot is selected. */
  getSelectedTool(): Tool | null {
    return TOOL_SLOTS[this.selected] ?? null;
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
    if (this.getSelectedTool() !== null) return null;
    return this.resourceSlots[this.selected - TOOL_SLOTS.length]?.block ?? null;
  }

  /** Consumes one of the currently selected resource; returns false if none is available. */
  consumeSelected(): boolean {
    if (this.getSelectedTool() !== null) return false;
    const index = this.selected - TOOL_SLOTS.length;
    const slot = this.resourceSlots[index];
    if (!slot) return false;
    slot.count--;
    if (slot.count <= 0) {
      this.resourceSlots[index] = null;
    }
    return true;
  }
}
