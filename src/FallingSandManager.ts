import * as THREE from "three";
import { BlockType } from "./blocks";
import { ChunkMesher } from "./ChunkMesher";
import { FallingSand } from "./FallingSand";
import { World } from "./World";

const GRAVITY = 28;
const MAX_FALL_SPEED = 40;

/**
 * Tracks sand blocks that have lost support (nothing solid directly beneath
 * them) and are falling until they land and rejoin the world grid as a real
 * SAND block, like Minecraft's classic falling sand/gravel.
 */
export class FallingSandManager {
  private readonly falling: FallingSand[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * If (x, y, z) is sand resting on nothing solid, turns it into a falling
   * entity and recurses upward so an entire unsupported stack starts
   * falling together, not just the bottom block.
   */
  checkAndDrop(world: World, mesher: ChunkMesher, x: number, y: number, z: number): void {
    if (world.getBlock(x, y, z) !== BlockType.SAND) return;
    if (world.isSolid(x, y - 1, z)) return;

    world.setBlock(x, y, z, BlockType.AIR);
    mesher.rebuildAround(x, z);

    const sand = new FallingSand(x, y, z);
    this.falling.push(sand);
    this.scene.add(sand.mesh);

    this.checkAndDrop(world, mesher, x, y + 1, z);
  }

  /**
   * Advances every falling block, sweeping through the cells it crosses this
   * frame so a fast fall can't tunnel through a thin floor. Processes
   * lowest-first so that when a stack lands in the same frame, each block
   * above sees its neighbor's landing immediately instead of lagging a
   * frame behind and overshooting onto the same cell.
   */
  update(dt: number, world: World, mesher: ChunkMesher): void {
    const order = this.falling.map((_, i) => i).sort((a, b) => this.falling[a].position.y - this.falling[b].position.y);
    const survivors: FallingSand[] = [];

    for (const i of order) {
      const sand = this.falling[i];
      sand.velocityY = Math.max(sand.velocityY - GRAVITY * dt, -MAX_FALL_SPEED);

      const cellX = Math.floor(sand.position.x);
      const cellZ = Math.floor(sand.position.z);
      const fromCellY = Math.floor(sand.position.y - 0.5);
      const newY = sand.position.y + sand.velocityY * dt;
      const toCellY = Math.floor(newY - 0.5);

      let landedAt: number | null = null;
      for (let cy = fromCellY; cy >= Math.max(toCellY, 0); cy--) {
        if (world.isSolid(cellX, cy - 1, cellZ)) {
          landedAt = cy;
          break;
        }
      }
      if (landedAt === null && toCellY <= 0) landedAt = 0;

      if (landedAt !== null) {
        this.scene.remove(sand.mesh);
        world.setBlock(cellX, landedAt, cellZ, BlockType.SAND);
        mesher.rebuildAround(cellX, cellZ);
        continue;
      }

      sand.position.y = newY;
      sand.syncMesh();
      survivors.push(sand);
    }

    this.falling.length = 0;
    this.falling.push(...survivors);
  }

  /** Discards every in-flight falling block without landing it, e.g. when switching dimensions. */
  clear(): void {
    for (const sand of this.falling) this.scene.remove(sand.mesh);
    this.falling.length = 0;
  }
}
