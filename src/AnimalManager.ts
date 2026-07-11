import * as THREE from "three";
import { BlockType } from "./blocks";
import { Mob, MobKind } from "./Mob";
import { SEA_LEVEL, World } from "./World";

const PIG_COUNT = 6;
const COW_COUNT = 6;
const SPAWN_ATTEMPTS_PER_MOB = 40;
const MOB_HIT_RADIUS = 0.6;
const MOB_CENTER_HEIGHT = 0.4;

export class AnimalManager {
  private readonly mobs: Mob[] = [];

  constructor(private readonly world: World, private readonly scene: THREE.Scene) {
    this.spawnKind("pig", PIG_COUNT);
    this.spawnKind("cow", COW_COUNT);
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

  update(dt: number): void {
    for (const mob of this.mobs) {
      mob.update(dt, this.world);
    }
  }

  /** Kills the nearest mob along the ray within reach, if any; returns whether something died. */
  tryAttack(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): boolean {
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

    if (closestIndex === -1) return false;
    const [mob] = this.mobs.splice(closestIndex, 1);
    this.scene.remove(mob.group);
    return true;
  }
}
