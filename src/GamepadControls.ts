import { Player } from "./Player";

/** Fraction of the stick's travel that must be crossed before a direction counts as held, so a resting/imprecise stick doesn't drift the player. */
const STICK_DEADZONE = 0.25;

/**
 * Drives the same WASD key state the keyboard would from a connected gamepad's
 * left thumbstick (e.g. a Steam Controller running through Chrome's standard
 * gamepad mapping) - lets a controller walk the player around without needing
 * a keyboard at all. Polled once per frame from the render loop, since the
 * Gamepad API has no change events of its own.
 */
export class GamepadControls {
  constructor(private readonly player: Player) {}

  update(): void {
    const pad = navigator.getGamepads?.().find((g) => g !== null) ?? null;
    // No pad (or it just disconnected mid-press) - make sure a stuck direction doesn't keep the player walking forever.
    const nx = pad ? (pad.axes[0] ?? 0) : 0;
    const ny = pad ? (pad.axes[1] ?? 0) : 0;
    // Distinct virtual codes rather than reusing "KeyW" etc: this runs every frame regardless of
    // whether the stick moved, and stomping the real WASD keys here would break using a keyboard
    // and gamepad at the same time.
    this.player.setVirtualKey("GamepadForward", ny < -STICK_DEADZONE);
    this.player.setVirtualKey("GamepadBack", ny > STICK_DEADZONE);
    this.player.setVirtualKey("GamepadLeft", nx < -STICK_DEADZONE);
    this.player.setVirtualKey("GamepadRight", nx > STICK_DEADZONE);
  }
}
