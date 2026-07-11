import { createNoise2D } from "simplex-noise";
import { BlockType, BLOCKS } from "./blocks";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 48;
export const WORLD_CHUNKS_X = 8;
export const WORLD_CHUNKS_Z = 8;
export const WORLD_SIZE_X = CHUNK_SIZE * WORLD_CHUNKS_X;
export const WORLD_SIZE_Z = CHUNK_SIZE * WORLD_CHUNKS_Z;
export const SEA_LEVEL = 17;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ChunkKey = string;

export function chunkKey(cx: number, cz: number): ChunkKey {
  return `${cx},${cz}`;
}

/**
 * Flat voxel storage for the whole (finite) world plus terrain generation.
 * Rendering is handled separately by ChunkMesher, which reads block data
 * back out of this class.
 */
export class World {
  readonly sizeX = WORLD_SIZE_X;
  readonly sizeZ = WORLD_SIZE_Z;
  readonly height = WORLD_HEIGHT;
  private blocks: Uint8Array;
  private heightmap: Int16Array;
  private readonly seed: number;

  constructor(seed = 1337) {
    this.seed = seed;
    this.blocks = new Uint8Array(this.sizeX * this.height * this.sizeZ);
    this.heightmap = new Int16Array(this.sizeX * this.sizeZ);
    this.generate();
  }

  private index(x: number, y: number, z: number): number {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.sizeX && y >= 0 && y < this.height && z >= 0 && z < this.sizeZ;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (!this.inBounds(x, y, z)) return BlockType.AIR;
    return this.blocks[this.index(x, y, z)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): boolean {
    if (!this.inBounds(x, y, z)) return false;
    this.blocks[this.index(x, y, z)] = type;
    return true;
  }

  isSolid(x: number, y: number, z: number): boolean {
    const block = this.getBlock(x, y, z);
    return BLOCKS[block].solid;
  }

  heightAt(x: number, z: number): number {
    return this.heightmap[z * this.sizeX + x] ?? 0;
  }

  /** Highest non-air, non-water block a player could stand on. */
  surfaceHeightAt(x: number, z: number): number {
    for (let y = this.height - 1; y >= 0; y--) {
      const block = this.getBlock(x, y, z);
      if (block !== BlockType.AIR && block !== BlockType.WATER) {
        return y + 1;
      }
    }
    return 1;
  }

  /** Finds dry land (grass/sand, not a lake bed) nearest to the map center for spawning. */
  findSpawnPoint(): [number, number] {
    const centerX = Math.floor(this.sizeX / 2);
    const centerZ = Math.floor(this.sizeZ / 2);
    const maxRadius = Math.floor(Math.min(this.sizeX, this.sizeZ) / 2) - 1;

    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = centerX + dx;
          const z = centerZ + dz;
          if (!this.inBounds(x, 0, z)) continue;
          if (this.heightAt(x, z) > SEA_LEVEL) return [x, z];
        }
      }
    }
    return [centerX, centerZ];
  }

  chunkCoordFor(x: number, z: number): [number, number] {
    return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
  }

  private generate(): void {
    const noise2D = createNoise2D(mulberry32(this.seed));
    const detail2D = createNoise2D(mulberry32(this.seed + 1));
    const treeRand = mulberry32(this.seed + 2);

    for (let x = 0; x < this.sizeX; x++) {
      for (let z = 0; z < this.sizeZ; z++) {
        const base = noise2D(x * 0.012, z * 0.012);
        const detail = detail2D(x * 0.05, z * 0.05);
        const h = Math.floor(SEA_LEVEL + base * 14 + detail * 4);
        const height = Math.max(3, Math.min(this.height - 6, h));
        this.heightmap[z * this.sizeX + x] = height;

        for (let y = 0; y < this.height; y++) {
          let type = BlockType.AIR;
          if (y < height - 4) {
            type = BlockType.STONE;
          } else if (y < height - 1) {
            type = BlockType.DIRT;
          } else if (y === height - 1) {
            type = height <= SEA_LEVEL + 1 ? BlockType.SAND : BlockType.GRASS;
          } else if (y < SEA_LEVEL) {
            type = BlockType.WATER;
          }
          if (type !== BlockType.AIR) {
            this.blocks[this.index(x, y, z)] = type;
          }
        }
      }
    }

    // Scatter trees on grass, one candidate per 5x5 cell so they stay spread out.
    const spacing = 5;
    for (let cx = 1; cx < this.sizeX - 1; cx += spacing) {
      for (let cz = 1; cz < this.sizeZ - 1; cz += spacing) {
        if (treeRand() > 0.35) continue;
        const x = cx + Math.floor(treeRand() * spacing);
        const z = cz + Math.floor(treeRand() * spacing);
        if (x < 2 || x >= this.sizeX - 2 || z < 2 || z >= this.sizeZ - 2) continue;
        const height = this.heightAt(x, z);
        if (height <= SEA_LEVEL) continue;
        if (this.getBlock(x, height - 1, z) !== BlockType.GRASS) continue;
        this.plantTree(x, height, z, treeRand);
      }
    }
  }

  private plantTree(x: number, y: number, z: number, rand: () => number): void {
    const trunkHeight = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < trunkHeight; i++) {
      this.setBlock(x, y + i, z, BlockType.WOOD);
    }
    const canopyBase = y + trunkHeight - 2;
    for (let ly = 0; ly < 3; ly++) {
      const radius = ly === 1 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius === 2) continue;
          const bx = x + dx;
          const by = canopyBase + ly;
          const bz = z + dz;
          if (this.getBlock(bx, by, bz) === BlockType.AIR) {
            this.setBlock(bx, by, bz, BlockType.LEAVES);
          }
        }
      }
    }
    this.setBlock(x, canopyBase + 3, z, BlockType.LEAVES);
  }
}
