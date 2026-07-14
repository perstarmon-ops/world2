import { createNoise2D, createNoise3D } from "simplex-noise";
import { BlockType, BLOCKS } from "./blocks";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 48;
export const WORLD_CHUNKS_X = 8;
export const WORLD_CHUNKS_Z = 8;
export const WORLD_SIZE_X = CHUNK_SIZE * WORLD_CHUNKS_X;
export const WORLD_SIZE_Z = CHUNK_SIZE * WORLD_CHUNKS_Z;
export const SEA_LEVEL = 17;
/** Shifts terrain height up from sea level so land is the majority of the map instead of ~half being flooded. */
const TERRAIN_HEIGHT_BIAS = 8;
const DIAMOND_MAX_Y = 14;
const DIAMOND_CHANCE = 0.0015;
const GOLD_MAX_Y = 22;
const GOLD_CHANCE = 0.0025;
const CAVE_MIN_Y = 3;
/** Caves stay at least this many blocks below the surface, so they never breach it or undermine villages/portals (which are built at/above ground height). */
const CAVE_SURFACE_BUFFER = 5;
/** Caves (and their loot chests/easter eggs) only carve under columns at least this tall - i.e. only in the mountains, not under every hill. */
const CAVE_MOUNTAIN_MIN_HEIGHT = 29;
/** Fraction of mountain columns where the surface buffer is skipped, letting the cave noise breach the surface into a visible entrance. */
const CAVE_ENTRANCE_CHANCE = 0.06;
const CAVE_SCALE_XZ = 0.09;
const CAVE_SCALE_Y = 0.12;
/** Higher = thinner, sparser tunnels; sampled against abs(noise), which is 0 most often, so this stays fairly high. */
const CAVE_THRESHOLD = 0.62;
/** One candidate roughly every this many blocks in each axis when scattering loot chests. */
const LOOT_CHEST_SPACING = 20;
const LOOT_CHEST_CHANCE = 0.5;
/** An ultra-rare cave easter egg - much sparser than loot chests, expect roughly one or two per map. */
const POOP_SPACING = 40;
const POOP_CHANCE = 0.15;

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

export type WorldTheme = "overworld" | "nether";

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
  private readonly theme: WorldTheme;
  private portalPosition: [number, number, number] | null = null;
  private readonly lootChests: { x: number; y: number; z: number; loot: [BlockType, number][] }[] = [];

  constructor(seed = 1337, theme: WorldTheme = "overworld") {
    this.seed = seed;
    this.theme = theme;
    this.blocks = new Uint8Array(this.sizeX * this.height * this.sizeZ);
    this.heightmap = new Int16Array(this.sizeX * this.sizeZ);
    this.generate();
  }

  /** World-space coordinates of the standing tile inside this world's portal, if one was built. */
  getPortalPosition(): [number, number, number] | null {
    return this.portalPosition;
  }

  /** Cave-floor chests placed during generation, with their pre-rolled loot - the caller populates a ChestManager from this after construction. */
  getLootChests(): ReadonlyArray<{ x: number; y: number; z: number; loot: [BlockType, number][] }> {
    return this.lootChests;
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

  /** Raw block data for save/load; the heightmap is generation-time-only and doesn't need to round-trip. */
  getBlocksSnapshot(): Uint8Array {
    return this.blocks;
  }

  /** Restores block data saved via getBlocksSnapshot(); a size mismatch (e.g. after a world-size change) is ignored. */
  loadBlocksSnapshot(data: Uint8Array): void {
    if (data.length === this.blocks.length) this.blocks.set(data);
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
    if (this.theme === "nether") {
      this.generateNether();
    } else {
      this.generateOverworld();
    }
  }

  private generateOverworld(): void {
    const noise2D = createNoise2D(mulberry32(this.seed));
    const detail2D = createNoise2D(mulberry32(this.seed + 1));
    const treeRand = mulberry32(this.seed + 2);
    const oreRand = mulberry32(this.seed + 3);
    const flowerRand = mulberry32(this.seed + 4);
    const villageRand = mulberry32(this.seed + 5);
    const caveNoise3D = createNoise3D(mulberry32(this.seed + 7));
    const lootRand = mulberry32(this.seed + 8);
    const poopRand = mulberry32(this.seed + 9);
    const entranceRand = mulberry32(this.seed + 10);

    for (let x = 0; x < this.sizeX; x++) {
      for (let z = 0; z < this.sizeZ; z++) {
        const base = noise2D(x * 0.012, z * 0.012);
        const detail = detail2D(x * 0.05, z * 0.05);
        const h = Math.floor(SEA_LEVEL + TERRAIN_HEIGHT_BIAS + base * 14 + detail * 4);
        const height = Math.max(3, Math.min(this.height - 6, h));
        this.heightmap[z * this.sizeX + x] = height;
        // A handful of mountain columns skip the surface buffer entirely, so the cave tunnel underneath breaches through as a visible entrance.
        const isCaveEntranceColumn = height >= CAVE_MOUNTAIN_MIN_HEIGHT && entranceRand() < CAVE_ENTRANCE_CHANCE;

        for (let y = 0; y < this.height; y++) {
          let type = BlockType.AIR;
          if (y < height - 4) {
            if (y < DIAMOND_MAX_Y && oreRand() < DIAMOND_CHANCE) {
              type = BlockType.DIAMOND_ORE;
            } else if (y < GOLD_MAX_Y && oreRand() < GOLD_CHANCE) {
              type = BlockType.GOLD_ORE;
            } else {
              type = BlockType.STONE;
            }
          } else if (y < height - 1) {
            type = BlockType.DIRT;
          } else if (y === height - 1) {
            type = height <= SEA_LEVEL + 1 ? BlockType.SAND : BlockType.GRASS;
          } else if (y < SEA_LEVEL) {
            type = BlockType.WATER;
          }
          if (
            height >= CAVE_MOUNTAIN_MIN_HEIGHT &&
            y >= CAVE_MIN_Y &&
            y < height - (isCaveEntranceColumn ? 0 : CAVE_SURFACE_BUFFER) &&
            (type === BlockType.STONE ||
              type === BlockType.DIAMOND_ORE ||
              type === BlockType.GOLD_ORE ||
              type === BlockType.DIRT ||
              type === BlockType.GRASS) &&
            Math.abs(caveNoise3D(x * CAVE_SCALE_XZ, y * CAVE_SCALE_Y, z * CAVE_SCALE_XZ)) > CAVE_THRESHOLD
          ) {
            type = BlockType.AIR;
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

    // Scatter flowers on grass, one candidate per 3x3 cell so they stay dense but spread out.
    const flowerSpacing = 3;
    for (let cx = 0; cx < this.sizeX; cx += flowerSpacing) {
      for (let cz = 0; cz < this.sizeZ; cz += flowerSpacing) {
        if (flowerRand() > 0.3) continue;
        const x = cx + Math.floor(flowerRand() * flowerSpacing);
        const z = cz + Math.floor(flowerRand() * flowerSpacing);
        if (!this.inBounds(x, 0, z)) continue;
        const height = this.heightAt(x, z);
        if (height <= SEA_LEVEL) continue;
        if (this.getBlock(x, height - 1, z) !== BlockType.GRASS) continue;
        if (this.getBlock(x, height, z) !== BlockType.AIR) continue;
        const type = flowerRand() < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
        this.setBlock(x, height, z, type);
      }
    }

    // Scatter loot chests on cave floors, one candidate per LOOT_CHEST_SPACING cell.
    for (let cx = 2; cx < this.sizeX - 2; cx += LOOT_CHEST_SPACING) {
      for (let cz = 2; cz < this.sizeZ - 2; cz += LOOT_CHEST_SPACING) {
        if (lootRand() > LOOT_CHEST_CHANCE) continue;
        const x = cx + Math.floor(lootRand() * LOOT_CHEST_SPACING);
        const z = cz + Math.floor(lootRand() * LOOT_CHEST_SPACING);
        if (!this.inBounds(x, 0, z)) continue;
        const spot = this.findCaveFloorSpot(x, z);
        if (!spot) continue;
        const [chestX, chestY, chestZ] = spot;
        this.setBlock(chestX, chestY, chestZ, BlockType.CHEST);
        this.lootChests.push({ x: chestX, y: chestY, z: chestZ, loot: this.rollLoot(lootRand) });
      }
    }

    // An ultra-rare easter egg on a cave floor somewhere.
    for (let cx = 3; cx < this.sizeX - 3; cx += POOP_SPACING) {
      for (let cz = 3; cz < this.sizeZ - 3; cz += POOP_SPACING) {
        if (poopRand() > POOP_CHANCE) continue;
        const x = cx + Math.floor(poopRand() * POOP_SPACING);
        const z = cz + Math.floor(poopRand() * POOP_SPACING);
        if (!this.inBounds(x, 0, z)) continue;
        const spot = this.findCaveFloorSpot(x, z);
        if (!spot) continue;
        const [px, py, pz] = spot;
        if (this.getBlock(px, py, pz) !== BlockType.AIR) continue; // don't overwrite a loot chest that claimed this spot
        this.setBlock(px, py, pz, BlockType.POOP);
      }
    }

    this.generateVillage(villageRand);

    const portalRand = mulberry32(this.seed + 6);
    const [baseX, baseZ] = this.findSpawnPoint();
    let placed = false;
    for (let attempt = 0; attempt < 12 && !placed; attempt++) {
      const angle = portalRand() * Math.PI * 2;
      const dist = 16 + portalRand() * 10;
      const px = Math.round(baseX + Math.cos(angle) * dist);
      const pz = Math.round(baseZ + Math.sin(angle) * dist);
      const spot = this.findBuildSpot(px, pz, 4, 1, SEA_LEVEL);
      if (spot) {
        this.buildPortal(spot[0], spot[1]);
        placed = true;
      }
    }
    // Guaranteed fallback: the spawn point itself is always dry land.
    if (!placed) {
      const spot = this.findBuildSpot(baseX, baseZ, 4, 1, SEA_LEVEL);
      if (spot) this.buildPortal(spot[0], spot[1]);
    }
  }

  /** Barren, flatter netherrack terrain with scattered obsidian spikes and a single return portal. */
  private generateNether(): void {
    const noise2D = createNoise2D(mulberry32(this.seed));
    const detail2D = createNoise2D(mulberry32(this.seed + 1));
    const spikeRand = mulberry32(this.seed + 2);
    const mushroomRand = mulberry32(this.seed + 3);
    const fireRand = mulberry32(this.seed + 4);
    const baseHeight = 14;

    for (let x = 0; x < this.sizeX; x++) {
      for (let z = 0; z < this.sizeZ; z++) {
        const base = noise2D(x * 0.02, z * 0.02);
        const detail = detail2D(x * 0.06, z * 0.06);
        const h = Math.floor(baseHeight + base * 6 + detail * 2);
        const height = Math.max(3, Math.min(this.height - 10, h));
        this.heightmap[z * this.sizeX + x] = height;
        for (let y = 0; y < height; y++) {
          this.blocks[this.index(x, y, z)] = BlockType.NETHERRACK;
        }
      }
    }

    // Scatter jagged obsidian spikes for atmosphere.
    const spacing = 10;
    for (let cx = 2; cx < this.sizeX - 2; cx += spacing) {
      for (let cz = 2; cz < this.sizeZ - 2; cz += spacing) {
        if (spikeRand() > 0.4) continue;
        const x = cx + Math.floor(spikeRand() * spacing);
        const z = cz + Math.floor(spikeRand() * spacing);
        if (!this.inBounds(x, 0, z)) continue;
        const groundY = this.heightAt(x, z);
        const spikeHeight = 3 + Math.floor(spikeRand() * 5);
        for (let i = 0; i < spikeHeight; i++) {
          this.setBlock(x, groundY + i, z, BlockType.OBSIDIAN);
        }
      }
    }

    // Scatter giant red mushrooms.
    const mushroomSpacing = 14;
    for (let cx = 3; cx < this.sizeX - 3; cx += mushroomSpacing) {
      for (let cz = 3; cz < this.sizeZ - 3; cz += mushroomSpacing) {
        if (mushroomRand() > 0.5) continue;
        const x = cx + Math.floor(mushroomRand() * mushroomSpacing);
        const z = cz + Math.floor(mushroomRand() * mushroomSpacing);
        if (x < 4 || x >= this.sizeX - 4 || z < 4 || z >= this.sizeZ - 4) continue;
        const groundY = this.heightAt(x, z);
        this.buildGiantMushroom(x, groundY, z, mushroomRand);
      }
    }

    // Scatter patches of fire across the ground for atmosphere.
    const fireSpacing = 6;
    for (let cx = 1; cx < this.sizeX - 1; cx += fireSpacing) {
      for (let cz = 1; cz < this.sizeZ - 1; cz += fireSpacing) {
        if (fireRand() > 0.3) continue;
        const x = cx + Math.floor(fireRand() * fireSpacing);
        const z = cz + Math.floor(fireRand() * fireSpacing);
        if (!this.inBounds(x, 0, z)) continue;
        const groundY = this.heightAt(x, z);
        if (this.getBlock(x, groundY, z) !== BlockType.AIR) continue;
        this.setBlock(x, groundY, z, BlockType.FIRE);
      }
    }

    const centerX = Math.floor(this.sizeX / 2);
    const centerZ = Math.floor(this.sizeZ / 2);
    const spot = this.findBuildSpot(centerX, centerZ, 4, 1, 0);
    if (spot) this.buildPortal(spot[0], spot[1]);
  }

  /** A thick stem topped with a wide domed red cap. */
  private buildGiantMushroom(x: number, y: number, z: number, rand: () => number): void {
    const stemHeight = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < stemHeight; i++) {
      this.setBlock(x, y + i, z, BlockType.MUSHROOM_STEM);
    }
    const capY = y + stemHeight;
    const radius = 3;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.hypot(dx, dz) > radius) continue;
        for (let dy = 0; dy <= 1; dy++) {
          const bx = x + dx;
          const by = capY + dy;
          const bz = z + dz;
          if (this.getBlock(bx, by, bz) === BlockType.AIR) {
            this.setBlock(bx, by, bz, BlockType.MUSHROOM_CAP);
          }
        }
      }
    }
  }

  /** Builds a 4-wide x5-tall obsidian portal frame with a 2x3 glowing portal interior. */
  private buildPortal(x: number, z: number): void {
    const groundY = this.heightAt(x + 1, z);
    for (let dx = 0; dx <= 3; dx++) {
      for (let dy = 0; dy <= 4; dy++) {
        const onEdge = dx === 0 || dx === 3 || dy === 0 || dy === 4;
        this.setBlock(x + dx, groundY + dy, z, onEdge ? BlockType.OBSIDIAN : BlockType.PORTAL);
      }
    }
    this.portalPosition = [x + 1.5, groundY + 1, z + 0.5];
  }

  /** Builds a small cluster of houses around the spawn point, connected by paths. */
  private generateVillage(rand: () => number): void {
    const [baseX, baseZ] = this.findSpawnPoint();
    const size = 5;
    const spacing = 9;
    const offsets: [number, number][] = [
      [-spacing, -spacing],
      [spacing, -spacing],
      [-spacing, spacing],
      [spacing, spacing],
      [0, spacing * 2],
    ];

    const doors: [number, number][] = [];
    for (const [ox, oz] of offsets) {
      const spot = this.findBuildSpot(baseX + ox, baseZ + oz, size, size, SEA_LEVEL);
      if (!spot) continue;
      const [x, z] = spot;
      this.buildHouse(x, z, size, rand);
      doors.push([x + Math.floor(size / 2), z]);
    }

    for (const [dx, dz] of doors) {
      this.carvePathSegment(baseX, baseZ, dx, baseZ);
      this.carvePathSegment(dx, baseZ, dx, dz);
    }
  }

  /** Searches an expanding ring around (x, z) for in-bounds land above minGroundY to place a width x depth footprint. */
  private findBuildSpot(x: number, z: number, width: number, depth: number, minGroundY: number): [number, number] | null {
    for (let ring = 0; ring <= 4; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const hx = x + dx * 2;
          const hz = z + dz * 2;
          if (!this.inBounds(hx - 1, 0, hz - 1) || !this.inBounds(hx + width, 0, hz + depth)) continue;
          const cx = hx + Math.floor(width / 2);
          const cz = hz + Math.floor(depth / 2);
          if (this.heightAt(cx, cz) <= minGroundY) continue;
          return [hx, hz];
        }
      }
    }
    return null;
  }

  private buildHouse(x: number, z: number, size: number, rand: () => number): void {
    const cx = x + Math.floor(size / 2);
    const cz = z + Math.floor(size / 2);
    const groundY = this.heightAt(cx, cz);
    if (groundY <= SEA_LEVEL) return;
    const wallHeight = 3 + Math.floor(rand() * 2);
    const floorY = groundY - 1;
    const roofY = groundY + wallHeight;

    // Clear any tree parts overlapping the footprint before building.
    for (let dx = -1; dx <= size; dx++) {
      for (let dz = -1; dz <= size; dz++) {
        for (let y = floorY; y <= roofY + 2; y++) {
          const bx = x + dx;
          const bz = z + dz;
          if (!this.inBounds(bx, y, bz)) continue;
          const b = this.getBlock(bx, y, bz);
          if (b === BlockType.WOOD || b === BlockType.LEAVES) this.setBlock(bx, y, bz, BlockType.AIR);
        }
      }
    }

    for (let dx = 0; dx < size; dx++) {
      for (let dz = 0; dz < size; dz++) {
        this.setBlock(x + dx, floorY, z + dz, BlockType.PLANK);
      }
    }

    const doorX = Math.floor(size / 2);
    const windowZ = Math.floor(size / 2);
    for (let dy = 0; dy < wallHeight; dy++) {
      const y = groundY + dy;
      for (let dx = 0; dx < size; dx++) {
        for (let dz = 0; dz < size; dz++) {
          const onEdge = dx === 0 || dx === size - 1 || dz === 0 || dz === size - 1;
          if (!onEdge) continue;
          if (dz === 0 && dx === doorX && dy < 2) {
            this.setBlock(x + dx, y, z + dz, BlockType.DOOR_CLOSED);
            continue;
          }
          const isWindow = dy === 1 && (dx === 0 || dx === size - 1) && dz === windowZ;
          this.setBlock(x + dx, y, z + dz, isWindow ? BlockType.GLASS : BlockType.PLANK);
        }
      }
    }

    for (let dx = -1; dx <= size; dx++) {
      for (let dz = -1; dz <= size; dz++) {
        this.setBlock(x + dx, roofY, z + dz, BlockType.BRICK);
      }
    }
  }

  private carvePathSegment(x0: number, z0: number, x1: number, z1: number): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const z = Math.round(z0 + (z1 - z0) * t);
      if (!this.inBounds(x, 0, z)) continue;
      const y = this.heightAt(x, z);
      if (y <= SEA_LEVEL) continue;
      // Only pave natural ground - never overwrite house walls/doors that
      // happen to sit a row off from this column's raw terrain height.
      const surface = this.getBlock(x, y - 1, z);
      if (surface !== BlockType.GRASS && surface !== BlockType.DIRT && surface !== BlockType.SAND) continue;
      this.setBlock(x, y - 1, z, BlockType.PATH);
    }
  }

  /** Searches down the column at (x, z) for an air cell with a solid floor and headroom, within the same depth band caves are carved in. */
  private findCaveFloorSpot(x: number, z: number): [number, number, number] | null {
    const height = this.heightAt(x, z);
    const top = Math.min(this.height - 1, height - CAVE_SURFACE_BUFFER - 1);
    for (let y = top; y >= CAVE_MIN_Y; y--) {
      if (this.getBlock(x, y, z) !== BlockType.AIR) continue;
      if (this.getBlock(x, y + 1, z) !== BlockType.AIR) continue;
      if (!this.isSolid(x, y - 1, z)) continue;
      return [x, y, z];
    }
    return null;
  }

  /** A handful of randomized resource stacks for a cave loot chest. */
  private rollLoot(rand: () => number): [BlockType, number][] {
    const pool: [BlockType, number, number][] = [
      [BlockType.DIAMOND, 1, 3],
      [BlockType.GOLD, 1, 4],
      [BlockType.COBBLESTONE, 4, 12],
      [BlockType.MEAT, 2, 5],
      [BlockType.WOOL, 2, 6],
      [BlockType.PLANK, 4, 10],
    ];
    const itemCount = Math.min(pool.length, 2 + Math.floor(rand() * 3));
    const usedIndices = new Set<number>();
    const loot: [BlockType, number][] = [];
    while (loot.length < itemCount) {
      const idx = Math.floor(rand() * pool.length);
      if (usedIndices.has(idx)) continue;
      usedIndices.add(idx);
      const [block, min, max] = pool[idx];
      loot.push([block, min + Math.floor(rand() * (max - min + 1))]);
    }
    return loot;
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
