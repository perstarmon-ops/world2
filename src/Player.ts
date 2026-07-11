import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
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

/** Falling below this Y (out of the map bounds or through a mined hole) triggers a respawn. */
const VOID_RESPAWN_Y = -10;

/** Horizontal distance walked between footstep sounds. */
const STEP_INTERVAL_BLOCKS = 1.15;

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
      this.keys.add(e.code);
      if (e.code === "Space" && !e.repeat && this.canFly) this.handleSpaceTap();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    // If the window loses focus mid-press (e.g. an OS prompt steals it), the
    // matching keyup never arrives - without this a key could get stuck held
    // forever, which would look like movement silently breaking.
    window.addEventListener("blur", () => this.keys.clear());
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
    this.controls.object.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
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

    const inWater = !this.flying && this.isInWater();

    const forward = this.forwardVector();
    const right = this.rightVector();
    const moveDir = new THREE.Vector3();

    if (this.keys.has("KeyW")) moveDir.add(forward);
    if (this.keys.has("KeyS")) moveDir.sub(forward);
    if (this.keys.has("KeyD")) moveDir.add(right);
    if (this.keys.has("KeyA")) moveDir.sub(right);

    const sprinting = !this.flying && !inWater && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
    const speed = this.flying ? FLY_SPEED : inWater ? SWIM_WALK_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;
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
    const prevZ = this.position.z;
    this.moveAxis("x", moveDir.x);
    this.moveAxis("z", moveDir.z);
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

    if (this.position.y < VOID_RESPAWN_Y) this.respawn();

    this.syncCamera();
  }

  /** Sends the player back to their spawn point, e.g. after falling out of the world. */
  private respawn(): void {
    this.position.copy(this.spawnPosition);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  /** Switches which World this player collides against, e.g. when stepping through a portal. */
  setWorld(world: World): void {
    this.world = world;
  }

  /** Creative mode can fly (double-tap Space to toggle, then Space up/Shift down); survival keeps normal jump/gravity physics. */
  setFlying(enabled: boolean): void {
    this.canFly = enabled;
    this.flying = enabled;
    if (enabled) this.velocity.y = 0;
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
