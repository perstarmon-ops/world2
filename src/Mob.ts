import * as THREE from "three";
import { BlockType } from "./blocks";
import { World, SEA_LEVEL } from "./World";

export type MobKind = "pig" | "cow" | "sheep" | "goat" | "chicken" | "zombie" | "piglin" | "hoglin";

const WANDER_SPEED = 1.3;
const LEG_SWING_SPEED = 6;
const LEG_SWING_AMOUNT = 0.5;
const ZOMBIE_CHASE_RADIUS = 10;
const ZOMBIE_CHASE_SPEED = 2.2;
/** Passive-mob ground checks require dry land above SEA_LEVEL; the nether has no sea level to speak of. */
const NETHER_KINDS: MobKind[] = ["piglin", "hoglin"];

/** Hits to kill with a sword. Chickens are fragile; the nether mobs are a bit tougher. */
const MOB_MAX_HEALTH: Record<MobKind, number> = {
  pig: 3,
  cow: 3,
  sheep: 3,
  goat: 3,
  chicken: 2,
  zombie: 4,
  piglin: 4,
  hoglin: 4,
};

const HEALTH_BAR_WIDTH = 64;
const HEALTH_BAR_HEIGHT = 10;
/** World-space size of the floating health bar above a mob's head. */
const HEALTH_BAR_SCALE: [number, number] = [0.7, 0.11];
/** Gap above the mob's own bounding-box top before the bar sits. */
const HEALTH_BAR_MARGIN = 0.15;

function paintHealthBar(fraction: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = HEALTH_BAR_WIDTH;
  canvas.height = HEALTH_BAR_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
  ctx.fillStyle = "#e0303f";
  ctx.fillRect(1, 1, Math.max(0, (HEALTH_BAR_WIDTH - 2) * fraction), HEALTH_BAR_HEIGHT - 2);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, HEALTH_BAR_WIDTH - 1, HEALTH_BAR_HEIGHT - 1);
  return canvas;
}

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

function buildSheep(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const woolMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.95), woolMat);
  body.position.y = 0.7;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), headMat);
  head.position.set(0, 0.68, 0.58);
  group.add(head);

  const legs: THREE.Mesh[] = [];
  const legPositions: [number, number][] = [
    [0.2, 0.34],
    [-0.2, 0.34],
    [0.2, -0.34],
    [-0.2, -0.34],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), legMat);
    leg.geometry.translate(0, -0.2, 0);
    leg.position.set(x, 0.4, z);
    group.add(leg);
    legs.push(leg);
  }

  return { group, legs };
}

function buildGoat(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xcfc7b4 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x9a9282 });
  const hornMat = new THREE.MeshLambertMaterial({ color: 0x3a352d });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.95), bodyMat);
  body.position.y = 0.62;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.36), bodyMat);
  head.position.set(0, 0.68, 0.62);
  group.add(head);

  const hornGeom = new THREE.BoxGeometry(0.06, 0.22, 0.06);
  hornGeom.translate(0, 0.11, 0);
  for (const x of [-0.1, 0.1]) {
    const horn = new THREE.Mesh(hornGeom, hornMat);
    horn.position.set(x, 0.85, 0.68);
    horn.rotation.x = -0.4;
    group.add(horn);
  }

  const legs: THREE.Mesh[] = [];
  const legPositions: [number, number][] = [
    [0.16, 0.36],
    [-0.16, 0.36],
    [0.16, -0.36],
    [-0.16, -0.36],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), legMat);
    leg.geometry.translate(0, -0.21, 0);
    leg.position.set(x, 0.42, z);
    group.add(leg);
    legs.push(leg);
  }

  return { group, legs };
}

function buildChicken(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf2f0e8 });
  const combMat = new THREE.MeshLambertMaterial({ color: 0xc23b3b });
  const beakMat = new THREE.MeshLambertMaterial({ color: 0xe0a83a });
  const legMat = new THREE.MeshLambertMaterial({ color: 0xe0a83a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.42), bodyMat);
  body.position.y = 0.32;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), bodyMat);
  head.position.set(0, 0.52, 0.2);
  group.add(head);

  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.1), combMat);
  comb.position.set(0, 0.64, 0.2);
  group.add(comb);

  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), beakMat);
  beak.position.set(0, 0.5, 0.32);
  group.add(beak);

  const wingGeom = new THREE.BoxGeometry(0.06, 0.2, 0.28);
  for (const x of [-0.18, 0.18]) {
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.set(x, 0.34, 0.02);
    group.add(wing);
  }

  const legs: THREE.Mesh[] = [];
  const legGeom = new THREE.BoxGeometry(0.05, 0.18, 0.05);
  legGeom.translate(0, -0.09, 0);
  for (const x of [-0.07, 0.07]) {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(x, 0.18, 0);
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

function buildPiglin(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xdba493 });
  const clothMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xdcb32a });

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.42), skinMat);
  head.position.set(0, 1.6, 0);
  group.add(head);

  const tuskGeom = new THREE.BoxGeometry(0.06, 0.14, 0.06);
  for (const x of [-0.1, 0.1]) {
    const tusk = new THREE.Mesh(tuskGeom, goldMat);
    tusk.position.set(x, 1.45, 0.2);
    group.add(tusk);
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), clothMat);
  body.position.set(0, 1.15, 0);
  group.add(body);

  const armGeom = new THREE.BoxGeometry(0.15, 0.65, 0.15);
  armGeom.translate(0, -0.325, 0);
  for (const x of [-0.32, 0.32]) {
    const arm = new THREE.Mesh(armGeom, skinMat);
    arm.position.set(x, 1.5, 0);
    group.add(arm);
  }

  const legs: THREE.Mesh[] = [];
  const legGeom = new THREE.BoxGeometry(0.18, 0.8, 0.18);
  legGeom.translate(0, -0.4, 0);
  for (const x of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(legGeom, clothMat);
    leg.position.set(x, 0.8, 0);
    group.add(leg);
    legs.push(leg);
  }

  return { group, legs };
}

function buildHoglin(): { group: THREE.Group; legs: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8a6a5a });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x6e5347 });
  const tuskMat = new THREE.MeshLambertMaterial({ color: 0xe8e0c8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.3), bodyMat);
  body.position.y = 0.85;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), bodyMat);
  head.position.set(0, 0.85, 0.85);
  group.add(head);

  const tuskGeom = new THREE.BoxGeometry(0.08, 0.08, 0.3);
  for (const x of [-0.15, 0.15]) {
    const tusk = new THREE.Mesh(tuskGeom, tuskMat);
    tusk.position.set(x, 0.65, 1.15);
    group.add(tusk);
  }

  const legs: THREE.Mesh[] = [];
  const legPositions: [number, number][] = [
    [0.3, 0.5],
    [-0.3, 0.5],
    [0.3, -0.5],
    [-0.3, -0.5],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.24), legMat);
    leg.geometry.translate(0, -0.275, 0);
    leg.position.set(x, 0.55, z);
    group.add(leg);
    legs.push(leg);
  }

  return { group, legs };
}

function buildModel(kind: MobKind): { group: THREE.Group; legs: THREE.Mesh[] } {
  if (kind === "pig") return buildPig();
  if (kind === "cow") return buildCow();
  if (kind === "sheep") return buildSheep();
  if (kind === "goat") return buildGoat();
  if (kind === "chicken") return buildChicken();
  if (kind === "piglin") return buildPiglin();
  if (kind === "hoglin") return buildHoglin();
  return buildZombie();
}

export class Mob {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  readonly maxHealth: number;
  health: number;
  private readonly legs: THREE.Mesh[];
  private yaw = 0;
  private walking = false;
  private stateTimer = 0;
  private walkTime = 0;
  private healthBarSprite: THREE.Sprite | null = null;
  private healthBarTexture: THREE.CanvasTexture | null = null;
  private readonly healthBarHeight: number;

  constructor(readonly kind: MobKind, spawnX: number, spawnZ: number, spawnY: number) {
    const built = buildModel(kind);
    this.group = built.group;
    this.legs = built.legs;
    this.position = new THREE.Vector3(spawnX, spawnY, spawnZ);
    this.group.position.copy(this.position);
    this.maxHealth = MOB_MAX_HEALTH[kind];
    this.health = this.maxHealth;
    this.healthBarHeight = new THREE.Box3().setFromObject(this.group).max.y + HEALTH_BAR_MARGIN;
    this.pickNewState();
  }

  /** Applies damage and updates the floating health bar (shown only once damaged); returns true if this brought the mob to 0 HP. */
  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.syncHealthBar();
    return this.health <= 0;
  }

  private syncHealthBar(): void {
    if (this.health >= this.maxHealth) {
      if (this.healthBarSprite) this.healthBarSprite.visible = false;
      return;
    }
    if (!this.healthBarSprite || !this.healthBarTexture) {
      this.healthBarTexture = new THREE.CanvasTexture(paintHealthBar(1));
      const material = new THREE.SpriteMaterial({ map: this.healthBarTexture, depthTest: false, depthWrite: false });
      this.healthBarSprite = new THREE.Sprite(material);
      this.healthBarSprite.scale.set(HEALTH_BAR_SCALE[0], HEALTH_BAR_SCALE[1], 1);
      this.healthBarSprite.renderOrder = 999;
      this.healthBarSprite.position.set(0, this.healthBarHeight, 0);
      this.group.add(this.healthBarSprite);
    }
    this.healthBarSprite.visible = true;
    this.healthBarTexture.image = paintHealthBar(this.health / this.maxHealth);
    this.healthBarTexture.needsUpdate = true;
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
    if (!NETHER_KINDS.includes(this.kind) && height <= SEA_LEVEL) return false;
    if (height <= 0) return false;
    return world.getBlock(Math.floor(x), height - 1, Math.floor(z)) !== BlockType.WATER;
  }

  update(dt: number, world: World, playerPosition?: THREE.Vector3): void {
    let speed = WANDER_SPEED;
    let chasing = false;

    if ((this.kind === "zombie" || this.kind === "piglin") && playerPosition) {
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
        // heightAt() (the precomputed ground-only heightmap), not surfaceHeightAt() (which
        // scans live blocks and would land a mob on top of a tree's leaves - solid, but not ground).
        this.position.y = world.heightAt(Math.floor(nx), Math.floor(nz));
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
