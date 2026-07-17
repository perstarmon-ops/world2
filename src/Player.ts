import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { Bed } from "./Bed";
import { Boat } from "./Boat";
import { BlockType } from "./blocks";
import { Sfx } from "./Sfx";
import { World } from "./World";

const GRAVITY = 28;
const JUMP_SPEED = 9;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.2;
const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const MAX_STEP = 0.05;
const STEP_HEIGHT = 1.02;
const LAND_STEP_BLOCKS = 1;
const WATER_CLIMB_BLOCKS = 3;

const WATER_GRAVITY_SCALE = 0.25;
const WATER_TERMINAL_VELOCITY = 3.5;
const SWIM_SPEED = 3.2;
const SWIM_ACCEL = 16;
const SWIM_WALK_SPEED = 3.2;

const FLY_SPEED = 6.5;
const FLY_VERTICAL_SPEED = 6;
/** Two Space presses within this window toggle flying on/off, like Minecraft creative mode. */
const DOUBLE_TAP_WINDOW_MS = 350;

const CROUCH_SPEED = 2.6;
/** How much the camera dips while crouching. */
const CROUCH_EYE_OFFSET = 0.3;

const BOAT_SPEED = 5.5;
/** Sitting low in the hull instead of standing height. */
const BOAT_EYE_HEIGHT = 0.9;
/** Lying flat instead of standing height. */
const BED_EYE_HEIGHT = 0.35;
/** Fixed "looking mostly up" pitch while lying in bed - the view is locked, like real Minecraft's sleep camera. */
const SLEEP_PITCH = -1.3;

/** Falling below this Y (out of the map bounds or through a mined hole) triggers a respawn. */
const VOID_RESPAWN_Y = -10;

/** Horizontal distance walked between footstep sounds. */
const STEP_INTERVAL_BLOCKS = 1.15;

const MAX_HEALTH = 20;
const MAX_HUNGER = 20;
/** Falling this many blocks or less does no damage. */
const SAFE_FALL_BLOCKS = 3;
const FALL_DAMAGE_PER_BLOCK = 2;
/** Seconds of normal walking per hunger point lost; sprinting burns it faster. */
const HUNGER_INTERVAL = 25;
const STARVE_INTERVAL = 4;
/** Starvation alone can weaken the player but never kill them. */
const STARVE_HEALTH_FLOOR = 1;
const REGEN_INTERVAL = 4;
const REGEN_HUNGER_THRESHOLD = 18;
const FOOD_RESTORE = 6;

export class Player {
  readonly controls: PointerLockControls;
  readonly position = new THREE.Vector3();
  private readonly spawnPosition: THREE.Vector3;
  private readonly velocity = new THREE.Vector3();
  private grounded = false;
  private canFly = false;
  private flying = false;
  private lastSpaceTapTime = 0;
  private stepDistance = 0;
  private crouching = false;
  private riding: Boat | null = null;
  private sleeping: Bed | null = null;
  private creative = false;
  private health = MAX_HEALTH;
  private hunger = MAX_HUNGER;
  private peakAirY: number | null = null;
  private hungerTimer = 0;
  private starveTimer = 0;
  private regenTimer = 0;
  private readonly keys = new Set<string>();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    private world: World,
    private readonly sfx: Sfx,
  ) {
    this.controls = new PointerLockControls(camera, domElement);

    const [spawnX, spawnZ] = world.findSpawnPoint();
    const spawnY = world.surfaceHeightAt(spawnX, spawnZ) + 2;
    this.spawnPosition = new THREE.Vector3(spawnX + 0.5, spawnY, spawnZ + 0.5);
    this.position.copy(this.spawnPosition);
    this.syncCamera();

    window.addEventListener("keydown", (e) => {
      // Arrow keys double as movement (e.g. a Steam Controller's D-pad emulating them by default) - stop the browser's own scroll-the-page behavior for them.
      if (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "Space" && !e.repeat && this.canFly) this.handleSpaceTap();
      // Ctrl works too in case Shift is intercepted by the OS/browser on some setups (same reasoning as the flying-descend fallback).
      const isDismountKey = e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "ControlLeft" || e.code === "ControlRight";
      if (isDismountKey && !e.repeat) {
        if (this.riding) this.dismountBoat();
        else if (this.sleeping) this.dismountBed();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    // If the window loses focus mid-press (e.g. an OS prompt steals it), the
    // matching keyup never arrives - without this a key could get stuck held
    // forever, which would look like movement silently breaking.
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** Simulates a keyboard key being held/released - lets touch controls (e.g. a virtual thumbstick) drive the same movement code as the keyboard. */
  setVirtualKey(code: string, held: boolean): void {
    if (held) this.keys.add(code);
    else this.keys.delete(code);
  }

  /** Double-tapping Space toggles flying on/off, like Minecraft creative mode. */
  private handleSpaceTap(): void {
    const now = performance.now();
    if (now - this.lastSpaceTapTime < DOUBLE_TAP_WINDOW_MS) {
      this.flying = !this.flying;
      this.velocity.y = 0;
      this.lastSpaceTapTime = 0;
    } else {
      this.lastSpaceTapTime = now;
    }
  }

  /** Shift descends while flying; Ctrl works too in case Shift is intercepted by the OS/browser on some setups. */
  private isDescendKeyHeld(): boolean {
    return (
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight") ||
      this.keys.has("ControlLeft") ||
      this.keys.has("ControlRight")
    );
  }

  private syncCamera(): void {
    const eyeHeight = this.sleeping
      ? BED_EYE_HEIGHT
      : this.riding
        ? BOAT_EYE_HEIGHT
        : this.crouching
          ? EYE_HEIGHT - CROUCH_EYE_OFFSET
          : EYE_HEIGHT;
    this.controls.object.position.set(this.position.x, this.position.y + eyeHeight, this.position.z);
  }

  /** True if there's a solid block directly under any part of the player's footprint at (x, y, z). */
  private hasGroundSupport(x: number, y: number, z: number): boolean {
    const minX = Math.floor(x - PLAYER_RADIUS);
    const maxX = Math.floor(x + PLAYER_RADIUS);
    const minZ = Math.floor(z - PLAYER_RADIUS);
    const maxZ = Math.floor(z + PLAYER_RADIUS);
    const groundY = Math.floor(y) - 1;
    for (let bx = minX; bx <= maxX; bx++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (this.world.isSolid(bx, groundY, bz)) return true;
      }
    }
    return false;
  }

  /** Same stepped movement as moveAxis, but refuses any step that would leave the feet unsupported - lets crouching stop right at a ledge instead of walking off it. */
  private moveAxisGrounded(axis: "x" | "z", delta: number): void {
    if (delta === 0) return;
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / MAX_STEP));
    const stepDelta = delta / steps;
    for (let i = 0; i < steps; i++) {
      const next = { x: this.position.x, y: this.position.y, z: this.position.z };
      next[axis] += stepDelta;
      if (this.aabbCollides(next.x, next.y, next.z)) break;
      if (!this.hasGroundSupport(next.x, next.y, next.z)) break;
      this.position[axis] = next[axis];
    }
  }

  private aabbCollides(x: number, y: number, z: number): boolean {
    const minX = Math.floor(x - PLAYER_RADIUS);
    const maxX = Math.floor(x + PLAYER_RADIUS);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT);
    const minZ = Math.floor(z - PLAYER_RADIUS);
    const maxZ = Math.floor(z + PLAYER_RADIUS);
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (this.world.isSolid(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }

  private moveAxis(axis: "x" | "y" | "z", delta: number): void {
    if (delta === 0) return;
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / MAX_STEP));
    const stepDelta = delta / steps;
    for (let i = 0; i < steps; i++) {
      const next = { x: this.position.x, y: this.position.y, z: this.position.z };
      next[axis] += stepDelta;
      if (this.aabbCollides(next.x, next.y, next.z)) {
        if (axis === "y") {
          this.velocity.y = 0;
          if (stepDelta < 0) this.grounded = true;
        }
        break;
      }
      this.position[axis] = next[axis];
    }
  }

  /**
   * If moving by (dx, dz) is blocked at the current height but a ledge up to
   * `maxBlocks` higher is clear, lift the player onto it. On land this only
   * clears a single block (normal walking); in water it clears up to
   * WATER_CLIMB_BLOCKS so swimming up to a shoreline and pushing forward
   * hauls the player out instead of leaving them stuck against the bank.
   */
  private tryStepUp(dx: number, dz: number, maxBlocks: number): void {
    if (dx === 0 && dz === 0) return;
    const nextX = this.position.x + dx;
    const nextZ = this.position.z + dz;
    if (!this.aabbCollides(nextX, this.position.y, nextZ)) return;

    for (let n = 1; n <= maxBlocks; n++) {
      const raisedY = this.position.y + n * STEP_HEIGHT;
      if (this.aabbCollides(this.position.x, raisedY, this.position.z)) return;
      if (!this.aabbCollides(nextX, raisedY, nextZ)) {
        this.position.y = raisedY;
        if (this.velocity.y < 0) this.velocity.y = 0;
        return;
      }
    }
  }

  private forwardVector(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    return dir;
  }

  private rightVector(): THREE.Vector3 {
    const forward = this.forwardVector();
    return new THREE.Vector3().crossVectors(forward, this.camera.up);
  }

  /** Checked at chest height so the player starts swimming once mostly submerged. */
  isInWater(): boolean {
    const midY = this.position.y + PLAYER_HEIGHT * 0.5;
    return (
      this.world.getBlock(Math.floor(this.position.x), Math.floor(midY), Math.floor(this.position.z)) ===
      BlockType.WATER
    );
  }

  update(dt: number): void {
    if (!this.controls.isLocked) return;

    if (this.sleeping) {
      // View is locked while lying down - overrides whatever the mouse would
      // otherwise have applied this frame (controls.enabled is also off, so
      // this is really just a static pose, not a per-frame necessity).
      this.camera.rotation.set(SLEEP_PITCH, this.sleeping.group.rotation.y, 0, "YXZ");
      this.syncCamera();
      return;
    }

    if (this.riding) {
      this.updateBoat(dt);
      this.syncCamera();
      return;
    }

    const inWater = !this.flying && this.isInWater();

    const forward = this.forwardVector();
    const right = this.rightVector();
    const moveDir = new THREE.Vector3();

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.keys.has("GamepadForward")) moveDir.add(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown") || this.keys.has("GamepadBack")) moveDir.sub(forward);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight") || this.keys.has("GamepadRight")) moveDir.add(right);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft") || this.keys.has("GamepadLeft")) moveDir.sub(right);

    const sprinting = !this.flying && !inWater && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
    const crouching = !this.flying && !inWater && (this.keys.has("ControlLeft") || this.keys.has("ControlRight"));
    this.crouching = crouching;
    const speed = this.flying ? FLY_SPEED : inWater ? SWIM_WALK_SPEED : crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(speed * dt);
    }

    if (this.flying) {
      const descend = this.isDescendKeyHeld();
      if (this.keys.has("Space") && !descend) this.velocity.y = FLY_VERTICAL_SPEED;
      else if (descend) this.velocity.y = -FLY_VERTICAL_SPEED;
      else this.velocity.y = 0;
    } else if (inWater) {
      this.velocity.y -= GRAVITY * WATER_GRAVITY_SCALE * dt;
      this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -WATER_TERMINAL_VELOCITY, WATER_TERMINAL_VELOCITY);

      if (this.keys.has("Space")) {
        this.velocity.y = Math.min(this.velocity.y + SWIM_ACCEL * dt, SWIM_SPEED);
      } else if (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) {
        this.velocity.y = Math.max(this.velocity.y - SWIM_ACCEL * dt, -SWIM_SPEED);
      }
    } else {
      this.velocity.y -= GRAVITY * dt;
      if (this.velocity.y < -50) this.velocity.y = -50;

      if (this.keys.has("Space") && this.grounded) {
        this.velocity.y = JUMP_SPEED;
        this.grounded = false;
      }
    }

    const wasGrounded = this.grounded;
    this.grounded = false;
    if (!this.flying && (wasGrounded || inWater)) {
      const climbBlocks = inWater ? WATER_CLIMB_BLOCKS : LAND_STEP_BLOCKS;
      this.tryStepUp(moveDir.x, 0, climbBlocks);
      this.tryStepUp(0, moveDir.z, climbBlocks);
    }
    const prevX = this.position.x;
    const prevY = this.position.y;
    const prevZ = this.position.z;
    if (crouching && wasGrounded) {
      this.moveAxisGrounded("x", moveDir.x);
      this.moveAxisGrounded("z", moveDir.z);
    } else {
      this.moveAxis("x", moveDir.x);
      this.moveAxis("z", moveDir.z);
    }
    this.moveAxis("y", this.velocity.y * dt);

    if (this.grounded && !this.flying && !inWater) {
      this.stepDistance += Math.hypot(this.position.x - prevX, this.position.z - prevZ);
      if (this.stepDistance >= STEP_INTERVAL_BLOCKS) {
        this.stepDistance -= STEP_INTERVAL_BLOCKS;
        this.sfx.footstep();
      }
    } else {
      this.stepDistance = 0;
    }

    if (this.flying || inWater) {
      this.peakAirY = null;
    } else if (this.grounded) {
      if (!wasGrounded && this.peakAirY !== null) {
        const fallDistance = this.peakAirY - this.position.y;
        if (fallDistance > SAFE_FALL_BLOCKS) {
          this.takeDamage(Math.round((fallDistance - SAFE_FALL_BLOCKS) * FALL_DAMAGE_PER_BLOCK));
        }
      }
      this.peakAirY = null;
    } else {
      this.peakAirY = this.peakAirY === null ? Math.max(prevY, this.position.y) : Math.max(this.peakAirY, this.position.y);
    }

    this.tickVitals(dt, sprinting);

    if (this.position.y < VOID_RESPAWN_Y) this.respawn();

    this.syncCamera();
  }

  /** Steers the boat with WASD relative to camera-facing directions, staying confined to water; the player's position just follows along. */
  private updateBoat(dt: number): void {
    const boat = this.riding!;
    const forward = this.forwardVector();
    const right = this.rightVector();
    const moveDir = new THREE.Vector3();

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.keys.has("GamepadForward")) moveDir.add(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown") || this.keys.has("GamepadBack")) moveDir.sub(forward);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight") || this.keys.has("GamepadRight")) moveDir.add(right);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft") || this.keys.has("GamepadLeft")) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(BOAT_SPEED * dt);
      const nextX = boat.position.x + moveDir.x;
      const nextZ = boat.position.z + moveDir.z;
      // The boat's own Y sits just above the water surface (see BOAT_FLOAT_OFFSET), so the water cell itself is one below that.
      if (this.world.getBlock(Math.floor(nextX), Math.floor(boat.position.y) - 1, Math.floor(nextZ)) === BlockType.WATER) {
        boat.position.x = nextX;
        boat.position.z = nextZ;
      }
      boat.yaw = Math.atan2(moveDir.x, moveDir.z);
    }

    this.position.copy(boat.position);
  }

  /** Depletes hunger over time (faster while sprinting), starves health down to a floor when hunger runs out, and slowly regenerates health when hunger is high. Creative mode is exempt. */
  private tickVitals(dt: number, sprinting: boolean): void {
    if (this.creative) return;

    this.hungerTimer += dt * (sprinting ? 1.6 : 1);
    if (this.hungerTimer >= HUNGER_INTERVAL) {
      this.hungerTimer -= HUNGER_INTERVAL;
      this.hunger = Math.max(0, this.hunger - 1);
    }

    if (this.hunger <= 0 && this.health > STARVE_HEALTH_FLOOR) {
      this.starveTimer += dt;
      if (this.starveTimer >= STARVE_INTERVAL) {
        this.starveTimer = 0;
        this.health = Math.max(STARVE_HEALTH_FLOOR, this.health - 1);
      }
    } else {
      this.starveTimer = 0;
    }

    if (this.hunger >= REGEN_HUNGER_THRESHOLD && this.health < MAX_HEALTH) {
      this.regenTimer += dt;
      if (this.regenTimer >= REGEN_INTERVAL) {
        this.regenTimer = 0;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
      }
    } else {
      this.regenTimer = 0;
    }
  }

  /** Sends the player back to their spawn point and fully heals them, e.g. after falling out of the world or dying. */
  private respawn(): void {
    this.position.copy(this.spawnPosition);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.peakAirY = null;
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.hungerTimer = 0;
    this.starveTimer = 0;
    this.regenTimer = 0;
  }

  /** Switches which World this player collides against, e.g. when stepping through a portal. */
  setWorld(world: World): void {
    this.world = world;
  }

  /** Creative mode can fly (double-tap Space to toggle, then Space up/Shift down) and is invulnerable/never hungry; survival keeps normal jump/gravity physics plus health and hunger. */
  setFlying(enabled: boolean): void {
    this.canFly = enabled;
    this.flying = enabled;
    this.creative = enabled;
    if (enabled) this.velocity.y = 0;
  }

  /** Toggles flying on/off (a no-op outside creative mode) without touching whether it's allowed at all - a single-press alternative to the double-tap-Space toggle, for mobile's jump button. */
  toggleFlying(): void {
    if (!this.canFly) return;
    this.flying = !this.flying;
    this.velocity.y = 0;
  }

  isFlying(): boolean {
    return this.flying;
  }

  isRidingBoat(): boolean {
    return this.riding !== null;
  }

  mountBoat(boat: Boat): void {
    this.riding = boat;
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  /** Steps the player off onto the boat's deck height so they don't end up swimming immediately after exiting. */
  dismountBoat(): void {
    const boat = this.riding;
    if (!boat) return;
    this.position.copy(boat.position);
    this.riding = null;
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  isSleeping(): boolean {
    return this.sleeping !== null;
  }

  /** Lies the player down on the bed: locks the view (like real Minecraft's sleep camera) and disables movement. */
  mountBed(bed: Bed): void {
    this.sleeping = bed;
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.controls.enabled = false;
  }

  /** Stands the player back up next to the bed and restores normal mouse-look. */
  dismountBed(): void {
    const bed = this.sleeping;
    if (!bed) return;
    this.position.set(bed.group.position.x, bed.group.position.y, bed.group.position.z);
    this.sleeping = null;
    this.controls.enabled = true;
    this.grounded = false;
    // The bed's own cells are solid, so standing back up at its position starts out
    // embedded in them - pop up onto its top surface instead of being stuck inside.
    this.resolveOverlap();
  }

  getHealth(): number {
    return this.health;
  }

  getHunger(): number {
    return this.hunger;
  }

  /** Reduces health by `amount`; no-op in creative mode. Respawns the player on death. */
  takeDamage(amount: number): void {
    if (this.creative || amount <= 0 || this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.sfx.hurt();
    if (this.health <= 0) this.respawn();
  }

  canEat(): boolean {
    return !this.creative && this.hunger < MAX_HUNGER;
  }

  /** For save/load: restores health/hunger without going through takeDamage/eat. */
  setVitals(health: number, hunger: number): void {
    this.health = THREE.MathUtils.clamp(health, 0, MAX_HEALTH);
    this.hunger = THREE.MathUtils.clamp(hunger, 0, MAX_HUNGER);
  }

  /** Restores hunger from eating; the caller is responsible for consuming the food item. */
  eat(amount: number = FOOD_RESTORE): void {
    this.hunger = Math.min(MAX_HUNGER, this.hunger + amount);
  }

  /** Moves the player to an exact position (e.g. through a portal) without carrying over momentum. */
  teleportTo(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.syncCamera();
  }

  /** Shoves the player by (dx, dz), same collision-checked stepping as normal movement - used by mobs bumping into the player. */
  push(dx: number, dz: number): void {
    this.moveAxis("x", dx);
    this.moveAxis("z", dz);
    this.syncCamera();
  }

  getEyePosition(): THREE.Vector3 {
    return this.controls.object.position;
  }

  /**
   * Pops the player straight up out of any solid block that now overlaps
   * them (e.g. one they just placed under their own feet). This is what
   * makes jump-and-place pillaring work: place a block beneath you while
   * airborne and you land standing on top of it instead of clipping inside.
   */
  resolveOverlap(): void {
    let guard = 0;
    while (this.aabbCollides(this.position.x, this.position.y, this.position.z) && guard < 64) {
      this.position.y += 0.05;
      this.velocity.y = Math.max(this.velocity.y, 0);
      guard++;
    }
  }
}
