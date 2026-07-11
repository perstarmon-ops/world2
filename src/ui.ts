import { BLOCKS } from "./blocks";
import { Inventory, RESOURCE_SLOT_COUNT, TOOL_SLOT_INDEX } from "./Inventory";

function rgb([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export class UI {
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly instructions: HTMLDivElement;
  private readonly debugEl: HTMLDivElement;
  private readonly miningBar: HTMLDivElement;
  private readonly miningFill: HTMLDivElement;

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

    const toolSlot = document.createElement("div");
    toolSlot.className = "vc-slot";
    toolSlot.innerHTML = `
      <div class="vc-tool-icon">⛏</div>
      <div class="vc-key">1</div>
    `;
    toolSlot.addEventListener("click", () => this.inventory.select(TOOL_SLOT_INDEX));
    hotbar.appendChild(toolSlot);
    this.slotEls.push(toolSlot);

    for (let i = 0; i < RESOURCE_SLOT_COUNT; i++) {
      const slot = document.createElement("div");
      slot.className = "vc-slot vc-slot-empty";
      slot.innerHTML = `
        <div class="vc-swatch"></div>
        <div class="vc-count"></div>
        <div class="vc-key">${i + 2}</div>
      `;
      slot.addEventListener("click", () => this.inventory.select(i + 1));
      hotbar.appendChild(slot);
      this.slotEls.push(slot);
    }
    root.appendChild(hotbar);

    this.instructions = document.createElement("div");
    this.instructions.className = "vc-instructions";
    this.instructions.innerHTML = `
      <h1>VoxelCraft</h1>
      <p>Click to play</p>
      <ul>
        <li><b>WASD</b> move &nbsp; <b>Space</b> jump &nbsp; <b>Shift</b> sprint/dive</li>
        <li><b>Mouse</b> look &nbsp; <b>Hold left click</b> mine &nbsp; <b>Right click</b> place</li>
        <li><b>1-9</b> select slot &nbsp; <b>Esc</b> release mouse</li>
        <li>Select the pickaxe (slot 1) to mine; select a mined block to place it</li>
      </ul>
    `;
    root.appendChild(this.instructions);

    this.debugEl = document.createElement("div");
    this.debugEl.className = "vc-debug";
    root.appendChild(this.debugEl);

    window.addEventListener("keydown", (e) => {
      const num = parseInt(e.code.replace("Digit", ""), 10);
      if (!Number.isNaN(num) && num >= 1 && num <= RESOURCE_SLOT_COUNT + 1) {
        this.inventory.select(num - 1);
      }
    });

    this.refreshInventory();
  }

  /** Re-reads the inventory state and repaints the hotbar; cheap enough to call every frame. */
  refreshInventory(): void {
    const selected = this.inventory.getSelectedIndex();
    const resourceSlots = this.inventory.getResourceSlots();

    this.slotEls.forEach((el, i) => el.classList.toggle("vc-selected", i === selected));

    resourceSlots.forEach((slot, i) => {
      const el = this.slotEls[i + 1];
      const swatch = el.querySelector<HTMLDivElement>(".vc-swatch")!;
      const count = el.querySelector<HTMLDivElement>(".vc-count")!;
      if (slot) {
        el.classList.remove("vc-slot-empty");
        swatch.style.background = rgb(BLOCKS[slot.block].color);
        count.textContent = String(slot.count);
      } else {
        el.classList.add("vc-slot-empty");
        swatch.style.background = "";
        count.textContent = "";
      }
    });
  }

  setLocked(locked: boolean): void {
    this.instructions.classList.toggle("vc-hidden", locked);
  }

  setDebugText(text: string): void {
    this.debugEl.textContent = text;
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
`;
