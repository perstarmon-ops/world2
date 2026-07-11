import * as THREE from "three";
import { BlockType } from "./blocks";
import { Mob, MobKind } from "./Mob";
import { SEA_LEVEL, World } from "./World";

const PIG_COUNT = 6;
const COW_COUNT = 6;
const SPAWN_ATTEMPTS_PER_MOB = 40;

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

  update(dt: number): void {
    for (const mob of this.mobs) {
      mob.update(dt, this.world);
    }
  }
}
