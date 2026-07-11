import * as THREE from "three";
import { BlockType } from "./blocks";
import { World, SEA_LEVEL } from "./World";

export type MobKind = "pig" | "cow" | "zombie";

const WANDER_SPEED = 1.3;
const LEG_SWING_SPEED = 6;
const LEG_SWING_AMOUNT = 0.5;
const ZOMBIE_CHASE_RADIUS = 10;
const ZOMBIE_CHASE_SPEED = 2.2;

function buildPig(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xefa8b8 });
  const snoutMat = new THREE.MeshLambertMaterial({ color: 0xd98a9a });
  const legMat = new THREE.MeshLambertMaterial({ color: 0xd692a2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.9), bodyMat);
  body.position.y = 0.55;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), bodyMat);
  head.position.set(0, 0.55, 0.58);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.1), snoutMat);
  snout.position.set(0, 0.5, 0.82);
  group.add(snout);

  const legs: THREE.Mesh[] = [];
  const legPositions: [number, number][] = [
    [0.18, 0.32],
    [-0.18, 0.32],
    [0.18, -0.32],
    [-0.18, -0.32],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), legMat);
    leg.geometry.translate(0, -0.17, 0);
    leg.position.set(x, 0.34, z);
    group.add(leg);
    legs.push(leg);
  }

  return { group, legs };
}

function buildCow(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a3324 });
  const patchMat = new THREE.MeshLambertMaterial({ color: 0xe7ddc9 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0xe7ddc9 });
  const hornMat = new THREE.MeshLambertMaterial({ color: 0xd8cfa8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 1.15), bodyMat);
  body.position.y = 0.75;
  group.add(body);

  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.3, 0.4), patchMat);
  patch.position.set(0, 0.7, 0.1);
  group.add(patch);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), bodyMat);
  head.position.set(0, 0.75, 0.75);
  group.add(head);

  for (const x of [-0.14, 0.14]) {
    const horn = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), hornMat);
    horn.position.set(x, 1.0, 0.75);
    group.add(horn);
  }

  const legs: THREE.Mesh[] = [];
  const legPositions: [number, number][] = [
    [0.22, 0.4],
    [-0.22, 0.4],
    [0.22, -0.4],
    [-0.22, -0.4],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), legMat);
    leg.geometry.translate(0, -0.225, 0);
    leg.position.set(x, 0.45, z);
    group.add(leg);
    legs.push(leg);
  }

  return { group, legs };
}

function buildZombie(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: 0x4f8a4f });
  const shirtMat = new THREE.MeshLambertMaterial({ color: 0x35667a });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2b2f52 });

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
  head.position.set(0, 1.6, 0);
  group.add(head);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), shirtMat);
  body.position.set(0, 1.15, 0);
  group.add(body);

  const armGeom = new THREE.BoxGeometry(0.15, 0.65, 0.15);
  armGeom.translate(0, -0.325, 0);
  for (const x of [-0.32, 0.32]) {
    const arm = new THREE.Mesh(armGeom, skinMat);
    arm.position.set(x, 1.5, 0);
    arm.rotation.x = -Math.PI / 2.4;
    group.add(arm);
  }

  const legs: THREE.Mesh[] = [];
  for (const x of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), pantsMat);
    leg.geometry.translate(0, -0.4, 0);
    leg.position.set(x, 0.8, 0);
    group.add(leg);
    legs.push(leg);
  }

  return { group, legs };
}

function buildModel(kind: MobKind): { group: THREE.Group; legs: THREE.Mesh[] } {
  if (kind === "pig") return buildPig();
  if (kind === "cow") return buildCow();
  return buildZombie();
}

export class Mob {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  private readonly legs: THREE.Mesh[];
  private yaw = 0;
  private walking = false;
  private stateTimer = 0;
  private walkTime = 0;

  constructor(readonly kind: MobKind, spawnX: number, spawnZ: number, spawnY: number) {
    const built = buildModel(kind);
    this.group = built.group;
    this.legs = built.legs;
    this.position = new THREE.Vector3(spawnX, spawnY, spawnZ);
    this.group.position.copy(this.position);
    this.pickNewState();
  }

  private pickNewState(): void {
    this.walking = Math.random() > 0.35;
    this.stateTimer = this.walking ? 1.5 + Math.random() * 2.5 : 1 + Math.random() * 2;
    if (this.walking) {
      this.yaw = Math.random() * Math.PI * 2;
    }
  }

  private isWalkable(world: World, x: number, z: number): boolean {
    if (!world.inBounds(x, 0, z)) return false;
    const height = world.heightAt(Math.floor(x), Math.floor(z));
    if (height <= SEA_LEVEL) return false;
    return world.getBlock(Math.floor(x), height - 1, Math.floor(z)) !== BlockType.WATER;
  }

  update(dt: number, world: World, playerPosition?: THREE.Vector3): void {
    let speed = WANDER_SPEED;
    let chasing = false;

    if (this.kind === "zombie" && playerPosition) {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      if (dx * dx + dz * dz < ZOMBIE_CHASE_RADIUS * ZOMBIE_CHASE_RADIUS) {
        chasing = true;
        this.yaw = Math.atan2(dx, dz);
        this.walking = true;
        this.stateTimer = 0.3;
        speed = ZOMBIE_CHASE_SPEED;
      }
    }

    if (!chasing) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.pickNewState();
    }

    if (this.walking) {
      const dx = Math.sin(this.yaw) * speed * dt;
      const dz = Math.cos(this.yaw) * speed * dt;
      const nx = this.position.x + dx;
      const nz = this.position.z + dz;

      if (this.isWalkable(world, nx, nz)) {
        this.position.x = nx;
        this.position.z = nz;
        this.position.y = world.surfaceHeightAt(Math.floor(nx), Math.floor(nz));
        this.walkTime += dt;
      } else if (!chasing) {
        this.stateTimer = 0;
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    const swing = this.walking ? Math.sin(this.walkTime * LEG_SWING_SPEED) * LEG_SWING_AMOUNT : 0;
    if (this.legs.length === 4) {
      this.legs[0].rotation.x = swing;
      this.legs[3].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
    } else {
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
    }
  }
}
