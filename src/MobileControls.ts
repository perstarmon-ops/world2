import * as THREE from "three";
import { Interaction } from "./Interaction";
import { Player } from "./Player";
import { UI } from "./ui";

const STICK_MAX_RADIUS = 45;
/** Fraction of the stick's travel that must be crossed before a direction counts as held, so a resting thumb doesn't drift the player. */
const STICK_DEADZONE = 0.25;
const LOOK_SENSITIVITY = 0.0035;
const PI_2 = Math.PI / 2;

/**
 * True when the device's PRIMARY input is touch, where the on-screen
 * controls should be shown instead of relying on keyboard/mouse. Checks
 * the "pointer" media feature rather than mere touch support
 * (navigator.maxTouchPoints/"ontouchstart") - plenty of touchscreen
 * laptops/desktops report touch capability while still being driven by a
 * mouse day to day, and those should keep the full 9-slot hotbar and no
 * mobile buttons.
 */
export function isTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Touch-first controls for mobile/tablet: a virtual thumbstick drives the
 * same WASD key state the keyboard would, dragging anywhere else rotates
 * the camera (mirroring PointerLockControls' own math, since real pointer
 * lock doesn't apply to a touchscreen), and two buttons stand in for the
 * left/right mouse buttons (mine and build).
 */
export class MobileControls {
  private readonly root: HTMLDivElement;
  private readonly gameplayControls: HTMLDivElement;
  private readonly stickBase: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;
  private readonly inventoryBtn: HTMLButtonElement;
  private stickTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private active = false;
  private wasInventoryOpen = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: Player,
    private readonly interaction: Interaction,
    private readonly ui: UI,
    domElement: HTMLElement,
  ) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement("div");
    this.root.className = "vc-touch-controls vc-hidden";
    this.root.innerHTML = `
      <button class="vc-touch-btn vc-touch-inventory" aria-label="Inventory">🎒</button>
      <div class="vc-touch-gameplay">
        <div class="vc-touch-stick-base">
          <div class="vc-touch-stick-knob"></div>
        </div>
        <div class="vc-touch-buttons">
          <button class="vc-touch-btn vc-touch-jump" aria-label="Jump">⬆</button>
          <button class="vc-touch-btn vc-touch-mine" aria-label="Mine">⛏</button>
          <button class="vc-touch-btn vc-touch-build" aria-label="Build">🧱</button>
        </div>
      </div>
    `;
    domElement.appendChild(this.root);
    this.gameplayControls = this.root.querySelector(".vc-touch-gameplay")!;
    this.stickBase = this.root.querySelector(".vc-touch-stick-base")!;
    this.stickKnob = this.root.querySelector(".vc-touch-stick-knob")!;
    this.inventoryBtn = this.root.querySelector(".vc-touch-inventory")!;

    this.wireStick();
    this.wireButtons();
    this.wireInventoryButton();
    this.wireLook(domElement);
  }

  /** Call once the player has chosen a mode. Skips real pointer lock (a touchscreen has no cursor to lock) and reveals the on-screen controls. No-op on non-touch devices. */
  activate(): void {
    if (!isTouchDevice() || this.active) return;
    this.active = true;
    this.player.controls.isLocked = true;
    this.ui.setLocked(true);
    this.ui.setCompactHotbar(true);
    this.ui.setPreviewVisible(false);
    this.root.classList.remove("vc-hidden");
  }

  isActive(): boolean {
    return this.active;
  }

  /** Called every frame: hides the stick/action buttons while the inventory is open, however it got opened (the inventory button, or interacting with a chest). */
  update(): void {
    if (!this.active) return;
    const open = this.ui.isInventoryOpen();
    if (open !== this.wasInventoryOpen) {
      this.gameplayControls.classList.toggle("vc-hidden", open);
      this.wasInventoryOpen = open;
    }
  }

  private wireStick(): void {
    const updateFromTouch = (touch: Touch): void => {
      const rect = this.stickBase.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const dist = Math.hypot(dx, dy);
      if (dist > STICK_MAX_RADIUS) {
        dx = (dx / dist) * STICK_MAX_RADIUS;
        dy = (dy / dist) * STICK_MAX_RADIUS;
      }
      this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

      const nx = dx / STICK_MAX_RADIUS;
      const ny = dy / STICK_MAX_RADIUS;
      this.player.setVirtualKey("KeyW", ny < -STICK_DEADZONE);
      this.player.setVirtualKey("KeyS", ny > STICK_DEADZONE);
      this.player.setVirtualKey("KeyA", nx < -STICK_DEADZONE);
      this.player.setVirtualKey("KeyD", nx > STICK_DEADZONE);
    };

    const release = (): void => {
      this.stickTouchId = null;
      this.stickKnob.style.transform = "translate(0, 0)";
      this.player.setVirtualKey("KeyW", false);
      this.player.setVirtualKey("KeyS", false);
      this.player.setVirtualKey("KeyA", false);
      this.player.setVirtualKey("KeyD", false);
    };

    this.stickBase.addEventListener("touchstart", (e) => {
      if (this.ui.isInventoryOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      const touch = e.changedTouches[0];
      this.stickTouchId = touch.identifier;
      updateFromTouch(touch);
    });
    this.stickBase.addEventListener("touchmove", (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.stickTouchId) updateFromTouch(touch);
      }
    });
    const onEnd = (e: TouchEvent): void => {
      e.stopPropagation();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.stickTouchId) release();
      }
    };
    this.stickBase.addEventListener("touchend", onEnd);
    this.stickBase.addEventListener("touchcancel", onEnd);
  }

  private wireButtons(): void {
    const jumpBtn = this.root.querySelector<HTMLButtonElement>(".vc-touch-jump")!;
    const mineBtn = this.root.querySelector<HTMLButtonElement>(".vc-touch-mine")!;
    const buildBtn = this.root.querySelector<HTMLButtonElement>(".vc-touch-build")!;

    jumpBtn.addEventListener("touchstart", (e) => {
      if (this.ui.isInventoryOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      // In creative, each press flips flying on/off (a no-op in survival) - a single-tap
      // alternative to the desktop double-tap-Space, since a virtual button doesn't
      // carry the same "quick double press" feel as a physical key.
      this.player.toggleFlying();
      this.player.setVirtualKey("Space", true);
    });
    const stopJump = (e: TouchEvent): void => {
      e.stopPropagation();
      this.player.setVirtualKey("Space", false);
    };
    jumpBtn.addEventListener("touchend", stopJump);
    jumpBtn.addEventListener("touchcancel", stopJump);

    mineBtn.addEventListener("touchstart", (e) => {
      if (this.ui.isInventoryOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      this.interaction.startMining();
    });
    const stopMine = (e: TouchEvent): void => {
      e.stopPropagation();
      this.interaction.stopMining();
    };
    mineBtn.addEventListener("touchend", stopMine);
    mineBtn.addEventListener("touchcancel", stopMine);

    buildBtn.addEventListener("touchstart", (e) => {
      if (this.ui.isInventoryOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      this.interaction.triggerPlace();
    });
  }

  private wireInventoryButton(): void {
    this.inventoryBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.ui.toggleInventory();
    });
  }

  /** Dragging anywhere outside the stick/buttons rotates the camera; touches that start on them are stopped from propagating here so they don't also register as a look-drag. */
  private wireLook(domElement: HTMLElement): void {
    domElement.addEventListener("touchstart", (e) => {
      if (this.lookTouchId !== null || this.ui.isInventoryOpen()) return;
      const touch = e.changedTouches[0];
      this.lookTouchId = touch.identifier;
      this.lastLookX = touch.clientX;
      this.lastLookY = touch.clientY;
    });
    domElement.addEventListener("touchmove", (e) => {
      if (this.ui.isInventoryOpen()) return;
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier !== this.lookTouchId) continue;
        const dx = touch.clientX - this.lastLookX;
        const dy = touch.clientY - this.lastLookY;
        this.lastLookX = touch.clientX;
        this.lastLookY = touch.clientY;
        this.applyLook(dx, dy);
      }
    });
    const onEnd = (e: TouchEvent): void => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.lookTouchId) this.lookTouchId = null;
      }
    };
    domElement.addEventListener("touchend", onEnd);
    domElement.addEventListener("touchcancel", onEnd);
  }

  /** Mirrors PointerLockControls' own mousemove rotation math so touch-drag look feels the same as mouse-look. */
  private applyLook(dx: number, dy: number): void {
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    euler.setFromQuaternion(this.camera.quaternion);
    euler.y -= dx * LOOK_SENSITIVITY;
    euler.x -= dy * LOOK_SENSITIVITY;
    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
    this.camera.quaternion.setFromEuler(euler);
  }
}

const CSS = `
.vc-touch-controls {
  position: fixed;
  inset: 0;
  /* Above .vc-inventory (z-index 25) so the inventory-toggle button stays reachable while the inventory panel is open, instead of being covered by it. */
  z-index: 26;
  pointer-events: none;
  touch-action: none;
}
.vc-touch-controls.vc-hidden {
  display: none;
}
.vc-touch-gameplay.vc-hidden {
  display: none;
}
.vc-touch-inventory {
  position: absolute;
  left: 20px;
  top: 84px;
}
.vc-touch-stick-base {
  position: absolute;
  left: 26px;
  bottom: 26px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.35);
  pointer-events: auto;
  touch-action: none;
}
.vc-touch-stick-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 50px;
  height: 50px;
  margin: -25px 0 0 -25px;
  border-radius: 50%;
  background: rgba(255,255,255,0.35);
  border: 2px solid rgba(255,255,255,0.6);
  pointer-events: none;
}
.vc-touch-buttons {
  position: absolute;
  right: 26px;
  bottom: 26px;
  display: flex;
  gap: 16px;
}
.vc-touch-btn {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: rgba(255,255,255,0.14);
  border: 2px solid rgba(255,255,255,0.4);
  color: #fff;
  font-size: 28px;
  pointer-events: auto;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
.vc-touch-btn:active {
  background: rgba(255,255,255,0.32);
}
`;
