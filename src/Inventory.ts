import { BlockType, BLOCKS } from "./blocks";

export type Tool = "pickaxe" | "axe" | "shovel" | "sword";

export const DEFAULT_TOOLS: Tool[] = ["pickaxe", "axe", "shovel", "sword"];

/** Slots 0-8 are the hotbar (keys 1-9, directly selectable). */
export const HOTBAR_SLOT_COUNT = 9;
/** Slots 9-35: three extra 9-wide storage rows, reachable only from the inventory screen. */
export const STORAGE_ROWS = 3;
export const STORAGE_SLOT_COUNT = STORAGE_ROWS * HOTBAR_SLOT_COUNT;
export const TOTAL_SLOT_COUNT = HOTBAR_SLOT_COUNT + STORAGE_SLOT_COUNT;

export type SlotContent =
  | { kind: "tool"; tool: Tool }
  | { kind: "resource"; block: BlockType; count: number }
  | null;

/**
 * A 9-slot hotbar (keys 1-9) plus three extra 9-wide storage rows (36 slots
 * total), like a classic Minecraft-style inventory. The hotbar starts with
 * the four tools in order followed by empty slots; mined blocks fill the
 * first empty slot anywhere in the inventory. Any two slots can be swapped
 * (via the inventory screen), so a tool and a resource can end up anywhere,
 * but only a hotbar slot (0-8) can be the actively selected one.
 */
/** Placeholder stack size shown for creative-mode resources; never actually depletes. */
const CREATIVE_STACK_SIZE = 64;

export class Inventory {
  private readonly slots: SlotContent[] = new Array(TOTAL_SLOT_COUNT).fill(null);
  private selected = 0;
  private creative = false;

  constructor() {
    DEFAULT_TOOLS.forEach((tool, i) => {
      this.slots[i] = { kind: "tool", tool };
    });
  }

  /** Switches to creative mode: fills remaining slots with every placeable block, and placing never depletes them. */
  setCreative(): void {
    this.creative = true;
    const placeableTypes = (Object.keys(BLOCKS) as unknown as string[])
      .map(Number)
      .filter((type) => BLOCKS[type as BlockType].placeable) as BlockType[];

    let slotIndex = 0;
    for (const block of placeableTypes) {
      while (slotIndex < TOTAL_SLOT_COUNT && this.slots[slotIndex] !== null) slotIndex++;
      if (slotIndex >= TOTAL_SLOT_COUNT) break;
      this.slots[slotIndex] = { kind: "resource", block, count: CREATIVE_STACK_SIZE };
      slotIndex++;
    }
  }

  getSlot(index: number): SlotContent {
    return this.slots[index] ?? null;
  }

  getSelectedIndex(): number {
    return this.selected;
  }

  select(index: number): void {
    if (index < 0 || index >= HOTBAR_SLOT_COUNT) return;
    this.selected = index;
  }

  /** Swaps the contents of two inventory slots (hotbar or storage); used by the inventory screen. */
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

  /** Adds one of `block` to a matching or empty slot anywhere in the inventory. */
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

  /** Consumes one of the currently selected resource; returns false if none is available. In creative mode, blocks never deplete. */
  consumeSelected(): boolean {
    const slot = this.slots[this.selected];
    if (!slot || slot.kind !== "resource") return false;
    if (this.creative) return true;
    slot.count--;
    if (slot.count <= 0) {
      this.slots[this.selected] = null;
    }
    return true;
  }

  isCreative(): boolean {
    return this.creative;
  }

  /** For save/load: restores creative mode without re-filling every placeable slot (loadSlotsSnapshot supplies the exact contents). */
  setCreativeMode(value: boolean): void {
    this.creative = value;
  }

  getSlotsSnapshot(): SlotContent[] {
    return this.slots.map((slot) => (slot ? { ...slot } : null));
  }

  loadSlotsSnapshot(slots: SlotContent[]): void {
    for (let i = 0; i < TOTAL_SLOT_COUNT; i++) {
      const slot = slots[i];
      this.slots[i] = slot ? { ...slot } : null;
    }
  }
}
