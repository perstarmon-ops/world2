import * as THREE from "three";
import { BlockType } from "./blocks";
import { Mob, MobKind } from "./Mob";
import { SEA_LEVEL, World } from "./World";

const PIG_COUNT = 1;
const COW_COUNT = 1;
const SHEEP_COUNT = 1;
const GOAT_COUNT = 1;
const CHICKEN_COUNT = 1;
const ZOMBIE_COUNT = 1;
const MAX_PER_KIND = 1;
const RESPAWN_INTERVAL = 20;
/** Below this, DayNightCycle.getDaylight() counts as night - matches the day/night clock icon's 6am-6pm boundary. */
const NIGHT_DAYLIGHT_THRESHOLD = 0.5;
const ALL_KINDS: MobKind[] = ["pig", "cow", "sheep", "goat", "chicken", "zombie"];
const SPAWN_ATTEMPTS_PER_MOB = 40;
const MOB_HIT_RADIUS = 0.6;
const MOB_CENTER_HEIGHT = 0.4;

export class AnimalManager {
  private readonly mobs: Mob[] = [];
  private respawnTimer = 0;

  constructor(private readonly world: World, private readonly scene: THREE.Scene) {
    this.spawnKind("pig", PIG_COUNT);
    this.spawnKind("cow", COW_COUNT);
    this.spawnKind("sheep", SHEEP_COUNT);
    this.spawnKind("goat", GOAT_COUNT);
    this.spawnKind("chicken", CHICKEN_COUNT);
    // Zombies only spawn at night; the world always loads at noon, so none appear yet.
  }

  private spawnKind(kind: MobKind, count: number): void {
    for (let i = 0; i < count; i++) {
      const spot = this.findSpawnSpot();
      if (!spot) continue;
      const [x, z] = spot;
      const y = this.world.surfaceHeightAt(x, z);
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
      if (height <= SEA_LEVEL) continue;
      if (this.world.getBlock(x, height - 1, z) !== BlockType.GRASS) continue;
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

  update(dt: number, playerPosition: THREE.Vector3, daylight: number): void {
    for (const mob of this.mobs) {
      mob.update(dt, this.world, playerPosition);
    }

    const isNight = daylight < NIGHT_DAYLIGHT_THRESHOLD;
    this.respawnTimer += dt;
    if (this.respawnTimer >= RESPAWN_INTERVAL) {
      this.respawnTimer = 0;
      for (const kind of ALL_KINDS) {
        if (kind === "zombie" && !isNight) continue;
        const count = this.mobs.reduce((n, mob) => n + (mob.kind === kind ? 1 : 0), 0);
        if (count < (kind === "zombie" ? ZOMBIE_COUNT : MAX_PER_KIND)) this.spawnKind(kind, 1);
      }
    }
  }

  /** Kills the nearest mob along the ray within reach, if any; returns its kind, or null if nothing was hit. */
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
    const [mob] = this.mobs.splice(closestIndex, 1);
    this.scene.remove(mob.group);
    return mob.kind;
  }
}
