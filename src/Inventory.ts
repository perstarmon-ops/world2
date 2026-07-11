import { BlockType, BLOCKS } from "./blocks";

export type Tool = "pickaxe" | "axe" | "shovel" | "sword";

export const DEFAULT_TOOLS: Tool[] = ["pickaxe", "axe", "shovel", "sword"];
export const TOTAL_SLOT_COUNT = 9;

export type SlotContent =
  | { kind: "tool"; tool: Tool }
  | { kind: "resource"; block: BlockType; count: number }
  | null;

/**
 * A single 9-slot hotbar (keys 1-9). Slots start with the four tools in
 * order followed by empty slots; mined blocks fill the first empty slot
 * they find. Any two slots can be swapped (via the inventory screen), so a
 * tool and a resource can end up anywhere.
 */
export class Inventory {
  private readonly slots: SlotContent[] = new Array(TOTAL_SLOT_COUNT).fill(null);
  private selected = 0;

  constructor() {
    DEFAULT_TOOLS.forEach((tool, i) => {
      this.slots[i] = { kind: "tool", tool };
    });
  }

  getSlot(index: number): SlotContent {
    return this.slots[index] ?? null;
  }

  getSelectedIndex(): number {
    return this.selected;
  }

  select(index: number): void {
    if (index < 0 || index >= TOTAL_SLOT_COUNT) return;
    this.selected = index;
  }

  /** Swaps the contents of two hotbar slots; used by the inventory screen. */
  swap(a: number, b: number): void {
    if (a < 0 || a >= TOTAL_SLOT_COUNT || b < 0 || b >= TOTAL_SLOT_COUNT || a === b) return;
    const tmp = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = tmp;
  }

  getSelectedTool(): Tool | null {
    const slot = this.slots[this.selected];
    return slot?.kind === "tool" ? slot.tool : null;
  }

  getSelectedBlock(): BlockType | null {
    const slot = this.slots[this.selected];
    return slot?.kind === "resource" ? slot.block : null;
  }

  /** Adds one of `block` to a matching or empty slot. */
  add(block: BlockType): void {
    if (!BLOCKS[block].placeable) return;
    const existing = this.slots.findIndex((slot) => slot?.kind === "resource" && slot.block === block);
    if (existing !== -1) {
      const slot = this.slots[existing];
      if (slot && slot.kind === "resource") slot.count++;
      return;
    }
    const empty = this.slots.findIndex((slot) => slot === null);
    if (empty !== -1) {
      this.slots[empty] = { kind: "resource", block, count: 1 };
    }
  }

  /** Consumes one of the currently selected resource; returns false if none is available. */
  consumeSelected(): boolean {
    const slot = this.slots[this.selected];
    if (!slot || slot.kind !== "resource") return false;
    slot.count--;
    if (slot.count <= 0) {
      this.slots[this.selected] = null;
    }
    return true;
  }
}
