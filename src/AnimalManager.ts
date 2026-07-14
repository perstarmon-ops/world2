import * as THREE from "three";
import { BlockType } from "./blocks";
import { Mob, MobKind } from "./Mob";
import { Player } from "./Player";
import { SEA_LEVEL, World } from "./World";

const RESPAWN_INTERVAL = 20;
/** Below this, DayNightCycle.getDaylight() counts as night - matches the day/night clock icon's 6am-6pm boundary. */
const NIGHT_DAYLIGHT_THRESHOLD = 0.5;
const SPAWN_ATTEMPTS_PER_MOB = 40;
const MOB_HIT_RADIUS = 0.6;
const MOB_CENTER_HEIGHT = 0.4;
/** Kinds that physically shove the player away instead of overlapping them, and deal contact damage. */
const PUSHY_KINDS: MobKind[] = ["zombie", "piglin", "hoglin"];
/** Combined horizontal clearance kept between a pushy mob and the player. */
const PUSH_RADIUS = 0.9;
const MOB_CONTACT_DAMAGE = 2;
/** Minimum time between contact-damage hits, shared across all pushy mobs touching the player. */
const MOB_HIT_INTERVAL = 1;
/** How much health a single sword swing takes off. */
const SWORD_DAMAGE = 1;

export interface MobSpawnConfig {
  kind: MobKind;
  /** How many spawn immediately when the dimension is created. */
  initialCount: number;
  /** Respawn tops a kind back up to this cap. */
  maxCount: number;
  /** Only spawns/respawns while it's night (used for overworld zombies). */
  nightOnly?: boolean;
}

export const OVERWORLD_SPAWNS: MobSpawnConfig[] = [
  { kind: "pig", initialCount: 1, maxCount: 1 },
  { kind: "cow", initialCount: 1, maxCount: 1 },
  { kind: "sheep", initialCount: 1, maxCount: 1 },
  { kind: "goat", initialCount: 1, maxCount: 1 },
  { kind: "chicken", initialCount: 1, maxCount: 1 },
  { kind: "zombie", initialCount: 0, maxCount: 1, nightOnly: true },
];

export const NETHER_SPAWNS: MobSpawnConfig[] = [
  { kind: "piglin", initialCount: 2, maxCount: 3 },
  { kind: "hoglin", initialCount: 2, maxCount: 3 },
];

export class AnimalManager {
  private readonly mobs: Mob[] = [];
  private respawnTimer = 0;
  private hitCooldown = 0;

  constructor(
    private readonly world: World,
    private readonly scene: THREE.Scene,
    private readonly groundBlocks: BlockType[] = [BlockType.GRASS],
    private readonly spawnConfigs: MobSpawnConfig[] = OVERWORLD_SPAWNS,
    /** Overworld has water to avoid spawning in/under; the nether has none, so this doesn't apply there. */
    private readonly requiresAboveSeaLevel: boolean = true,
  ) {
    for (const config of this.spawnConfigs) {
      if (!config.nightOnly) this.spawnKind(config.kind, config.initialCount);
    }
  }

  private spawnKind(kind: MobKind, count: number): void {
    for (let i = 0; i < count; i++) {
      const spot = this.findSpawnSpot();
      if (!spot) continue;
      const [x, z] = spot;
      // heightAt() matches findSpawnSpot()'s own ground check - surfaceHeightAt() scans live
      // blocks and would spawn a mob on top of a tree's leaves if one happens to stand here.
      const y = this.world.heightAt(x, z);
      const mob = new Mob(kind, x + 0.5, z + 0.5, y);
      this.scene.add(mob.group);
      this.mobs.push(mob);
    }
  }

  private findSpawnSpot(): [number, number] | null {
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS_PER_MOB; attempt++) {
      const x = Math.floor(Math.random() * this.world.sizeX);
      const z = Math.floor(Math.random() * this.world.sizeZ);
      const height = this.world.heightAt(x, z);
      if (this.requiresAboveSeaLevel && height <= SEA_LEVEL) continue;
      if (!this.groundBlocks.includes(this.world.getBlock(x, height - 1, z))) continue;
      return [x, z];
    }
    return null;
  }

  getMobs(): ReadonlyArray<Mob> {
    return this.mobs;
  }

  /** Hides/shows this dimension's mobs, for switching between dimensions sharing one scene. */
  setActive(active: boolean): void {
    for (const mob of this.mobs) {
      mob.group.visible = active;
    }
  }

  update(dt: number, player: Player, daylight: number): void {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    for (const mob of this.mobs) {
      mob.update(dt, this.world, player.position);
      if (PUSHY_KINDS.includes(mob.kind)) this.pushPlayerAway(mob, player);
    }

    const isNight = daylight < NIGHT_DAYLIGHT_THRESHOLD;
    this.respawnTimer += dt;
    if (this.respawnTimer >= RESPAWN_INTERVAL) {
      this.respawnTimer = 0;
      for (const config of this.spawnConfigs) {
        if (config.nightOnly && !isNight) continue;
        const count = this.mobs.reduce((n, mob) => n + (mob.kind === config.kind ? 1 : 0), 0);
        if (count < config.maxCount) this.spawnKind(config.kind, 1);
      }
    }
  }

  /** Shoves the player back if a pushy mob has walked into their space, instead of letting the two overlap, and periodically deals contact damage. */
  private pushPlayerAway(mob: Mob, player: Player): void {
    const dx = player.position.x - mob.position.x;
    const dz = player.position.z - mob.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= PUSH_RADIUS) return;
    // Exact overlap has no defined direction - fall back to a fixed nudge so it can't deadlock.
    const [ux, uz] = dist < 1e-4 ? [1, 0] : [dx / dist, dz / dist];
    const overlap = PUSH_RADIUS - dist;
    player.push(ux * overlap, uz * overlap);

    if (this.hitCooldown <= 0) {
      player.takeDamage(MOB_CONTACT_DAMAGE);
      this.hitCooldown = MOB_HIT_INTERVAL;
    }
  }

  /** Damages the nearest mob along the ray within reach, if any; returns its kind only once that hit brings it to 0 HP (and removes it), otherwise null. */
  tryAttack(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): MobKind | null {
    let closestIndex = -1;
    let closestDistance = Infinity;

    this.mobs.forEach((mob, index) => {
      const center = mob.position.clone();
      center.y += MOB_CENTER_HEIGHT;
      const toCenter = center.clone().sub(origin);
      const t = toCenter.dot(direction);
      if (t < 0 || t > maxDistance) return;
      const closestPoint = origin.clone().addScaledVector(direction, t);
      if (closestPoint.distanceTo(center) > MOB_HIT_RADIUS) return;
      if (t < closestDistance) {
        closestDistance = t;
        closestIndex = index;
      }
    });

    if (closestIndex === -1) return null;
    const mob = this.mobs[closestIndex];
    if (!mob.takeDamage(SWORD_DAMAGE)) return null;
    this.mobs.splice(closestIndex, 1);
    this.scene.remove(mob.group);
    return mob.kind;
  }
}
