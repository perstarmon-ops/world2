import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { World } from "./World";

const GRAVITY = 28;
const JUMP_SPEED = 9;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.2;
const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const MAX_STEP = 0.05;

export class Player {
  readonly controls: PointerLockControls;
  readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private grounded = false;
  private readonly keys = new Set<string>();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    private readonly world: World,
  ) {
    this.controls = new PointerLockControls(camera, domElement);

    const [spawnX, spawnZ] = world.findSpawnPoint();
    const spawnY = world.surfaceHeightAt(spawnX, spawnZ) + 2;
    this.position.set(spawnX + 0.5, spawnY, spawnZ + 0.5);
    this.syncCamera();

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
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

  update(dt: number): void {
    if (!this.controls.isLocked) return;

    const forward = this.forwardVector();
    const right = this.rightVector();
    const moveDir = new THREE.Vector3();

    if (this.keys.has("KeyW")) moveDir.add(forward);
    if (this.keys.has("KeyS")) moveDir.sub(forward);
    if (this.keys.has("KeyD")) moveDir.add(right);
    if (this.keys.has("KeyA")) moveDir.sub(right);

    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(speed * dt);
    }

    this.velocity.y -= GRAVITY * dt;
    if (this.velocity.y < -50) this.velocity.y = -50;

    if (this.keys.has("Space") && this.grounded) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }

    this.grounded = false;
    this.moveAxis("x", moveDir.x);
    this.moveAxis("z", moveDir.z);
    this.moveAxis("y", this.velocity.y * dt);

    this.syncCamera();
  }

  getEyePosition(): THREE.Vector3 {
    return this.controls.object.position;
  }

  /** True if the given block cell overlaps the player's own bounding box (used to block self-trapping placement). */
  occupiesBlock(bx: number, by: number, bz: number): boolean {
    const minX = this.position.x - PLAYER_RADIUS;
    const maxX = this.position.x + PLAYER_RADIUS;
    const minY = this.position.y;
    const maxY = this.position.y + PLAYER_HEIGHT;
    const minZ = this.position.z - PLAYER_RADIUS;
    const maxZ = this.position.z + PLAYER_RADIUS;
    return bx + 1 > minX && bx < maxX && by + 1 > minY && by < maxY && bz + 1 > minZ && bz < maxZ;
  }
}
