import { BLOCKS } from "./blocks";
import { HOTBAR_SLOT_COUNT, Inventory, Tool, TOTAL_SLOT_COUNT } from "./Inventory";

function rgb([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

const TOOL_ICONS: Record<Tool, string> = {
  pickaxe: "⛏",
  axe: "🪓",
  shovel: "♠",
  sword: "🗡",
};

function buildSlotEl(key: number, onClick: () => void): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "vc-slot vc-slot-empty";
  el.innerHTML = `
    <div class="vc-tool-icon"></div>
    <div class="vc-swatch"></div>
    <div class="vc-count"></div>
    <div class="vc-key">${key}</div>
  `;
  el.addEventListener("click", onClick);
  return el;
}

export class UI {
  private readonly hotbarEls: HTMLDivElement[] = [];
  private readonly invEls: HTMLDivElement[];
  private readonly instructions: HTMLDivElement;
  private readonly inventoryPanel: HTMLDivElement;
  private readonly previewCanvas: HTMLCanvasElement;
  private readonly debugEl: HTMLDivElement;
  private readonly clockEl: HTMLDivElement;
  private readonly miningBar: HTMLDivElement;
  private readonly miningFill: HTMLDivElement;
  private inventoryOpen = false;
  private pickedSlot: number | null = null;

  constructor(root: HTMLElement, private readonly inventory: Inventory) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    root.insertAdjacentHTML("beforeend", `<div class="vc-crosshair"></div>`);

    this.miningBar = document.createElement("div");
    this.miningBar.className = "vc-mining-bar";
    this.miningBar.innerHTML = `<div class="vc-mining-fill"></div>`;
    root.appendChild(this.miningBar);
    this.miningFill = this.miningBar.querySelector(".vc-mining-fill")!;

    const hotbar = document.createElement("div");
    hotbar.className = "vc-hotbar";
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const el = buildSlotEl(i + 1, () => this.inventory.select(i));
      hotbar.appendChild(el);
      this.hotbarEls.push(el);
    }
    root.appendChild(hotbar);

    this.inventoryPanel = document.createElement("div");
    this.inventoryPanel.className = "vc-inventory vc-hidden";
    this.inventoryPanel.innerHTML = `<h2>Inventory</h2><p>Click a slot, then click another to swap. Press <b>E</b> to close.</p>`;

    const content = document.createElement("div");
    content.className = "vc-inventory-content";

    this.previewCanvas = document.createElement("canvas");
    this.previewCanvas.className = "vc-player-canvas";
    content.appendChild(this.previewCanvas);

    const gridWrap = document.createElement("div");
    gridWrap.className = "vc-inventory-gridwrap";
    this.invEls = new Array(TOTAL_SLOT_COUNT);

    // Storage rows (slots 9-35) in their own grid, above a separate single-row
    // hotbar grid (slots 0-8) - two grids instead of one 36-cell grid so the
    // gap between them can't misalign either row.
    const storageGrid = document.createElement("div");
    storageGrid.className = "vc-inventory-grid";
    for (let i = HOTBAR_SLOT_COUNT; i < TOTAL_SLOT_COUNT; i++) {
      const el = buildSlotEl(i + 1, () => this.onInventorySlotClick(i));
      el.classList.add("vc-inv-slot");
      storageGrid.appendChild(el);
      this.invEls[i] = el;
    }
    gridWrap.appendChild(storageGrid);

    const hotbarGrid = document.createElement("div");
    hotbarGrid.className = "vc-inventory-grid";
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const el = buildSlotEl(i + 1, () => this.onInventorySlotClick(i));
      el.classList.add("vc-inv-slot");
      hotbarGrid.appendChild(el);
      this.invEls[i] = el;
    }
    gridWrap.appendChild(hotbarGrid);

    content.appendChild(gridWrap);
    this.inventoryPanel.appendChild(content);
    this.inventoryPanel.addEventListener("click", (e) => e.stopPropagation());
    root.appendChild(this.inventoryPanel);

    this.instructions = document.createElement("div");
    this.instructions.className = "vc-instructions";
    this.instructions.innerHTML = `
      <h1>VoxelCraft</h1>
      <p>Click to play</p>
      <ul>
        <li><b>WASD</b> move &nbsp; <b>Space</b> jump &nbsp; <b>Shift</b> sprint/dive</li>
        <li><b>Mouse</b> look &nbsp; <b>Hold left click</b> mine &nbsp; <b>Right click</b> place</li>
        <li><b>1-9</b> select slot &nbsp; <b>E</b> inventory &nbsp; <b>Esc</b> release mouse</li>
        <li>Pickaxe (1) speeds up stone, axe (2) speeds up wood/leaves, shovel (3) speeds up dirt</li>
        <li>Sword (4) attacks instead of mining - kill a pig or cow for meat</li>
        <li>Zombies wander the world and will chase you if you get close</li>
        <li>Select a mined block to place it</li>
      </ul>
    `;
    root.appendChild(this.instructions);

    this.debugEl = document.createElement("div");
    this.debugEl.className = "vc-debug";
    root.appendChild(this.debugEl);

    this.clockEl = document.createElement("div");
    this.clockEl.className = "vc-clock";
    root.appendChild(this.clockEl);

    window.addEventListener("keydown", (e) => {
      const num = parseInt(e.code.replace("Digit", ""), 10);
      if (!Number.isNaN(num) && num >= 1 && num <= HOTBAR_SLOT_COUNT) {
        this.inventory.select(num - 1);
      }
    });

    this.refreshInventory();
  }

  private onInventorySlotClick(index: number): void {
    if (this.pickedSlot === null) {
      this.pickedSlot = index;
    } else if (this.pickedSlot === index) {
      this.pickedSlot = null;
    } else {
      this.inventory.swap(this.pickedSlot, index);
      this.pickedSlot = null;
    }
    this.refreshInventory();
  }

  /** Opens/closes the inventory screen. Returns the new open state. */
  toggleInventory(): boolean {
    this.inventoryOpen = !this.inventoryOpen;
    this.pickedSlot = null;
    this.inventoryPanel.classList.toggle("vc-hidden", !this.inventoryOpen);
    this.refreshInventory();
    return this.inventoryOpen;
  }

  isInventoryOpen(): boolean {
    return this.inventoryOpen;
  }

  getPreviewCanvas(): HTMLCanvasElement {
    return this.previewCanvas;
  }

  /** Re-reads the inventory state and repaints the hotbar/inventory screen; cheap enough to call every frame. */
  refreshInventory(): void {
    const selected = this.inventory.getSelectedIndex();

    for (let i = 0; i < TOTAL_SLOT_COUNT; i++) {
      const slotData = this.inventory.getSlot(i);
      if (i < HOTBAR_SLOT_COUNT) {
        this.paintSlot(this.hotbarEls[i], slotData, i === selected);
      }
      this.paintSlot(this.invEls[i], slotData, i === selected, i === this.pickedSlot);
    }
  }

  private paintSlot(el: HTMLDivElement, slot: ReturnType<Inventory["getSlot"]>, selected: boolean, picked = false): void {
    const icon = el.querySelector<HTMLDivElement>(".vc-tool-icon")!;
    const swatch = el.querySelector<HTMLDivElement>(".vc-swatch")!;
    const count = el.querySelector<HTMLDivElement>(".vc-count")!;

    el.classList.toggle("vc-selected", selected);
    el.classList.toggle("vc-picked", picked);

    if (slot?.kind === "tool") {
      el.classList.remove("vc-slot-empty");
      icon.textContent = TOOL_ICONS[slot.tool];
      swatch.style.background = "";
      count.textContent = "";
    } else if (slot?.kind === "resource") {
      el.classList.remove("vc-slot-empty");
      icon.textContent = "";
      swatch.style.background = rgb(BLOCKS[slot.block].color);
      count.textContent = String(slot.count);
    } else {
      el.classList.add("vc-slot-empty");
      icon.textContent = "";
      swatch.style.background = "";
      count.textContent = "";
    }
  }

  setLocked(locked: boolean): void {
    this.instructions.classList.toggle("vc-hidden", locked);
  }

  setDebugText(text: string): void {
    this.debugEl.textContent = text;
  }

  setClock(text: string): void {
    this.clockEl.textContent = text;
  }

  /** Pass null to hide the mining progress bar, or 0-1 to show fill progress. */
  setMiningProgress(progress: number | null): void {
    this.miningBar.classList.toggle("vc-hidden", progress === null);
    if (progress !== null) {
      this.miningFill.style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
    }
  }
}

const CSS = `
.vc-crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  pointer-events: none;
  z-index: 10;
}
.vc-crosshair::before, .vc-crosshair::after {
  content: "";
  position: absolute;
  background: rgba(255,255,255,0.85);
  box-shadow: 0 0 2px rgba(0,0,0,0.6);
}
.vc-crosshair::before {
  left: 8px; top: 0; width: 2px; height: 18px;
}
.vc-crosshair::after {
  top: 8px; left: 0; width: 18px; height: 2px;
}
.vc-mining-bar {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 70px;
  height: 8px;
  margin: 16px 0 0 -35px;
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 3px;
  background: rgba(0,0,0,0.35);
  overflow: hidden;
  pointer-events: none;
  z-index: 10;
}
.vc-mining-bar.vc-hidden {
  display: none;
}
.vc-mining-fill {
  height: 100%;
  width: 0%;
  background: #f2f2f2;
}
.vc-hotbar {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 10;
  background: rgba(0,0,0,0.25);
  padding: 6px;
  border-radius: 8px;
}
.vc-slot {
  width: 48px;
  height: 48px;
  border: 2px solid rgba(255,255,255,0.4);
  border-radius: 4px;
  position: relative;
  cursor: pointer;
  box-sizing: border-box;
}
.vc-slot.vc-selected {
  border-color: #fff;
  box-shadow: 0 0 8px rgba(255,255,255,0.8);
}
.vc-slot.vc-picked {
  border-color: #ffd24d;
  box-shadow: 0 0 10px rgba(255,210,77,0.9);
}
.vc-slot-empty {
  opacity: 0.45;
}
.vc-tool-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.vc-swatch {
  position: absolute;
  inset: 4px;
  border-radius: 2px;
}
.vc-count {
  position: absolute;
  bottom: 1px;
  left: 3px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 2px #000;
  font-family: monospace;
}
.vc-key {
  position: absolute;
  bottom: 1px;
  right: 3px;
  font-size: 10px;
  color: #fff;
  text-shadow: 0 0 2px #000;
  font-family: monospace;
}
.vc-instructions {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.55);
  color: #fff;
  z-index: 20;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: pointer;
}
.vc-instructions.vc-hidden {
  display: none;
}
.vc-instructions h1 {
  margin: 0 0 8px;
  font-size: 42px;
  letter-spacing: 2px;
}
.vc-instructions p {
  font-size: 18px;
  margin: 0 0 20px;
  opacity: 0.9;
}
.vc-instructions ul {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
  line-height: 1.8;
}
.vc-inventory {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.65);
  color: #fff;
  z-index: 25;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.vc-inventory.vc-hidden {
  display: none;
}
.vc-inventory h2 {
  margin: 0 0 6px;
  font-size: 28px;
  letter-spacing: 1px;
}
.vc-inventory p {
  margin: 0 0 20px;
  font-size: 14px;
  opacity: 0.85;
}
.vc-inventory-content {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.vc-player-canvas {
  width: 140px;
  height: 200px;
  background: rgba(255,255,255,0.06);
  border: 2px solid rgba(255,255,255,0.35);
  border-radius: 6px;
}
.vc-inventory-grid {
  display: grid;
  grid-template-columns: repeat(9, 64px);
  gap: 10px;
}
.vc-inv-slot {
  width: 64px;
  height: 64px;
}
.vc-inv-hotbar-row-start {
  margin-top: 10px;
}
.vc-inv-slot .vc-tool-icon {
  font-size: 30px;
}
.vc-inv-slot .vc-count {
  font-size: 14px;
}
.vc-debug {
  position: fixed;
  top: 8px;
  left: 8px;
  color: #fff;
  font-family: monospace;
  font-size: 12px;
  text-shadow: 0 0 3px #000;
  z-index: 10;
  white-space: pre;
  pointer-events: none;
}
.vc-clock {
  position: fixed;
  top: 8px;
  right: 12px;
  color: #fff;
  font-family: monospace;
  font-size: 20px;
  font-weight: bold;
  text-shadow: 0 0 4px rgba(0,0,0,0.8);
  z-index: 10;
  pointer-events: none;
}
`;
