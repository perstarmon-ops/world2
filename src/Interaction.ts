import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { AnimalManager } from "./AnimalManager";
import { BedManager } from "./BedManager";
import { BlockType, BLOCKS } from "./blocks";
import { BOAT_FLOAT_OFFSET, BoatManager } from "./BoatManager";
import { ChunkMesher } from "./ChunkMesher";
import { Inventory, Tool } from "./Inventory";
import { MobKind } from "./Mob";
import { Player } from "./Player";
import { raycastVoxels } from "./raycast";
import { Sfx } from "./Sfx";
import { SEA_LEVEL, World } from "./World";

const REACH = 6;
/** How far ahead of the player, along the ground, to search for a water tile to place a boat on. */
const BOAT_PLACE_MAX_DISTANCE = 4;
const WATER_MINING_SPEED = 0.35;
const TOOL_BONUS_SPEED = 2;
/** Bare-handed mining (no tool selected) works, just slower than any tool. */
const HAND_MINING_SPEED = 0.6;
/** Interval between mining "knock" sounds while a block is being broken. */
const MINE_HIT_INTERVAL = 0.22;

/** Blocks each tool mines at TOOL_BONUS_SPEED instead of the base rate. The sword can't mine at all. */
const TOOL_BONUS_BLOCKS: Record<Tool, BlockType[]> = {
  pickaxe: [BlockType.STONE, BlockType.DIAMOND_ORE, BlockType.GOLD_ORE, BlockType.OBSIDIAN, BlockType.NETHERRACK],
  axe: [BlockType.WOOD, BlockType.LEAVES, BlockType.DOOR_CLOSED, BlockType.DOOR_OPEN],
  shovel: [BlockType.DIRT],
  sword: [],
};

/** Blocks that drop a different item than themselves when mined. */
const MINED_DROPS: Partial<Record<BlockType, BlockType>> = {
  [BlockType.DIAMOND_ORE]: BlockType.DIAMOND,
  [BlockType.GOLD_ORE]: BlockType.GOLD,
  [BlockType.DOOR_OPEN]: BlockType.DOOR_CLOSED,
};

/** What each animal drops when killed with the sword. */
const ANIMAL_DROPS: Partial<Record<MobKind, BlockType[]>> = {
  pig: [BlockType.MEAT],
  cow: [BlockType.MEAT],
  goat: [BlockType.MEAT],
  chicken: [BlockType.MEAT],
  sheep: [BlockType.MEAT, BlockType.WOOL],
  hoglin: [BlockType.MEAT],
  piglin: [BlockType.GOLD],
};

export interface InteractionState {
  mining: boolean;
  progress: number;
  targetBlock: THREE.Vector3 | null;
  attacked: boolean;
}

export class Interaction {
  private isLeftDown = false;
  private miningTarget: THREE.Vector3 | null = null;
  private miningProgress = 0;
  private miningSoundTimer = 0;
  private attackedThisFrame = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: PointerLockControls,
    private world: World,
    private mesher: ChunkMesher,
    private readonly player: Player,
    private readonly inventory: Inventory,
    private animals: AnimalManager,
    domElement: HTMLElement,
    private readonly sfx: Sfx,
    private readonly boats: BoatManager,
    private readonly beds: BedManager,
  ) {
    const doc = domElement.ownerDocument;
    doc.addEventListener("mousedown", (e) => this.onMouseDown(e));
    doc.addEventListener("mouseup", (e) => this.onMouseUp(e));
    doc.addEventListener("contextmenu", (e) => e.preventDefault());
    controls.addEventListener("unlock", () => this.resetMining());
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.controls.isLocked) return;
    if (this.player.isRidingBoat() || this.player.isSleeping()) return;

    if (e.button === 0) {
      if (this.tryMountNearbyEntity()) return;
      if (this.inventory.getSelectedTool() === "sword") {
        this.attack();
      } else {
        this.isLeftDown = true;
      }
    } else if (e.button === 2) {
      this.place();
    }
  }

  /** Left-clicking a placed boat or bed within reach mounts it instead of mining/attacking. */
  private tryMountNearbyEntity(): boolean {
    const origin = this.player.getEyePosition().clone();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    const boat = this.boats.raycastHit(origin, direction, REACH);
    if (boat) {
      this.player.mountBoat(boat);
      return true;
    }
    const bed = this.beds.raycastHit(origin, direction, REACH);
    if (bed) {
      this.player.mountBed(bed);
      return true;
    }
    return false;
  }

  /** Swings the sword: always animates, kills the nearest mob in range if any, and drops meat from animals. */
  private attack(): void {
    this.attackedThisFrame = true;
    const origin = this.player.getEyePosition().clone();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const killed = this.animals.tryAttack(origin, direction, REACH);
    if (killed) {
      const drops = ANIMAL_DROPS[killed];
      if (drops) for (const drop of drops) this.inventory.add(drop);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.isLeftDown = false;
      this.resetMining();
    }
  }

  private resetMining(): void {
    this.isLeftDown = false;
    this.miningTarget = null;
    this.miningProgress = 0;
    this.miningSoundTimer = 0;
  }

  private place(): void {
    const selected = this.inventory.getSelectedBlock();
    if (selected === BlockType.BOAT) {
      this.tryPlaceBoat();
      return;
    }
    if (selected === BlockType.BED) {
      this.tryPlaceBed();
      return;
    }

    const hit = this.raycast();
    if (!hit) return;

    const targetType = this.world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    if (targetType === BlockType.DOOR_CLOSED || targetType === BlockType.DOOR_OPEN) {
      this.toggleDoor(hit.block.x, hit.block.y, hit.block.z);
      return;
    }

    const blockType = this.inventory.getSelectedBlock();
    if (blockType === null) return;
    const { x, y, z } = hit.before;
    if (!this.world.inBounds(x, y, z)) return;

    if (!this.inventory.consumeSelected()) return;
    this.world.setBlock(x, y, z, blockType);
    if (blockType === BlockType.DOOR_CLOSED && this.world.getBlock(x, y + 1, z) === BlockType.AIR) {
      this.world.setBlock(x, y + 1, z, BlockType.DOOR_CLOSED);
    }
    this.mesher.rebuildAround(x, z);
    this.player.resolveOverlap();
  }

  /**
   * Boats aren't world blocks, so this doesn't use the solid-block raycaster
   * (which treats water as passable and won't hit it): it walks a short
   * distance ahead of the player and places the boat on the first water
   * tile found. Every flooded column's water surface sits at the same
   * fixed SEA_LEVEL by construction, so no vertical search is needed.
   */
  private tryPlaceBoat(): void {
    const origin = this.player.getEyePosition();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() < 1e-6) return;
    direction.normalize();

    for (let dist = 1.5; dist <= BOAT_PLACE_MAX_DISTANCE; dist += 0.5) {
      const x = origin.x + direction.x * dist;
      const z = origin.z + direction.z * dist;
      if (this.world.getBlock(Math.floor(x), SEA_LEVEL - 1, Math.floor(z)) !== BlockType.WATER) continue;
      if (!this.inventory.consumeSelected()) return;
      this.boats.place(x, SEA_LEVEL - 1 + BOAT_FLOAT_OFFSET, z);
      return;
    }
  }

  /**
   * Beds occupy two cells, so this uses the normal solid-ground raycast to
   * find the "foot" cell (like any other block placement), then snaps the
   * player's facing direction to the nearest cardinal axis to pick the
   * adjacent "head" cell for the pillow. Both cells are written into the
   * world grid as (invisible) BED blocks for real collision/mining; the
   * visible model is a separate hand-built entity positioned on top.
   */
  private tryPlaceBed(): void {
    const hit = this.raycast();
    if (!hit) return;
    const { x, y, z } = hit.before;
    if (!this.world.inBounds(x, y, z)) return;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();

    const dx = Math.abs(forward.x) > Math.abs(forward.z) ? Math.sign(forward.x) : 0;
    const dz = dx === 0 ? Math.sign(forward.z) : 0;
    const headX = x + dx;
    const headZ = z + dz;
    if (!this.world.inBounds(headX, y, headZ)) return;
    if (this.world.isSolid(headX, y, headZ)) return;

    if (!this.inventory.consumeSelected()) return;
    const yaw = Math.atan2(dx, dz);
    this.world.setBlock(x, y, z, BlockType.BED);
    this.world.setBlock(headX, y, headZ, BlockType.BED);
    this.mesher.rebuildAround(x, z);
    this.mesher.rebuildAround(headX, headZ);
    this.beds.place(x, y, z, headX, headZ, x + 0.5 + dx * 0.5, z + 0.5 + dz * 0.5, yaw);
  }

  /** Opens/closes the door at (x, y, z), along with any vertically adjacent door block so a 2-tall door swings as one unit. */
  private toggleDoor(x: number, y: number, z: number): void {
    const isDoor = (b: BlockType) => b === BlockType.DOOR_CLOSED || b === BlockType.DOOR_OPEN;
    const current = this.world.getBlock(x, y, z);
    if (!isDoor(current)) return;
    const next = current === BlockType.DOOR_CLOSED ? BlockType.DOOR_OPEN : BlockType.DOOR_CLOSED;

    this.world.setBlock(x, y, z, next);
    for (const ny of [y - 1, y + 1]) {
      if (isDoor(this.world.getBlock(x, ny, z))) this.world.setBlock(x, ny, z, next);
    }
    this.mesher.rebuildAround(x, z);
  }

  private raycast() {
    const origin = this.player.getEyePosition().clone();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return raycastVoxels(this.world, origin, direction, REACH);
  }

  /** Switches which World/ChunkMesher/AnimalManager this player interacts with, e.g. when stepping through a portal. */
  setDimension(world: World, mesher: ChunkMesher, animals: AnimalManager): void {
    this.world = world;
    this.mesher = mesher;
    this.animals = animals;
    this.resetMining();
  }

  /** Advances the mining timer against whatever block is under the crosshair; returns the current visual state. */
  update(dt: number): InteractionState {
    const attacked = this.attackedThisFrame;
    this.attackedThisFrame = false;

    if (!this.controls.isLocked) {
      this.resetMining();
      return { mining: false, progress: 0, targetBlock: null, attacked };
    }

    const hit = this.raycast();
    const hoverBlock = hit ? hit.block : null;
    const tool = this.inventory.getSelectedTool();

    if (
      !this.isLeftDown ||
      !hit ||
      tool === "sword" ||
      !BLOCKS[this.world.getBlock(hit.block.x, hit.block.y, hit.block.z)].breakable
    ) {
      this.miningTarget = null;
      this.miningProgress = 0;
      return { mining: false, progress: 0, targetBlock: hoverBlock, attacked };
    }

    if (!this.miningTarget || !this.miningTarget.equals(hit.block)) {
      this.miningTarget = hit.block.clone();
      this.miningProgress = 0;
      this.miningSoundTimer = 0;
    }

    const blockType = this.world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    const hardness = BLOCKS[blockType].hardness;
    let speed = this.player.isInWater() ? WATER_MINING_SPEED : 1;
    if (!tool) {
      speed *= HAND_MINING_SPEED;
    } else if (TOOL_BONUS_BLOCKS[tool].includes(blockType)) {
      speed *= TOOL_BONUS_SPEED;
    }
    this.miningProgress += dt * speed;

    this.miningSoundTimer += dt;
    if (this.miningSoundTimer >= MINE_HIT_INTERVAL) {
      this.miningSoundTimer -= MINE_HIT_INTERVAL;
      this.sfx.mineHit();
    }

    if (this.miningProgress >= hardness) {
      this.world.setBlock(hit.block.x, hit.block.y, hit.block.z, BlockType.AIR);
      if (blockType === BlockType.DOOR_CLOSED || blockType === BlockType.DOOR_OPEN) {
        for (const ny of [hit.block.y - 1, hit.block.y + 1]) {
          const neighbor = this.world.getBlock(hit.block.x, ny, hit.block.z);
          if (neighbor === BlockType.DOOR_CLOSED || neighbor === BlockType.DOOR_OPEN) {
            this.world.setBlock(hit.block.x, ny, hit.block.z, BlockType.AIR);
          }
        }
      }
      if (blockType === BlockType.BED) {
        const pair = this.beds.removeAt(hit.block.x, hit.block.y, hit.block.z);
        if (pair) {
          this.world.setBlock(pair.x, pair.y, pair.z, BlockType.AIR);
          this.mesher.rebuildAround(pair.x, pair.z);
        }
      }
      this.mesher.rebuildAround(hit.block.x, hit.block.z);
      this.inventory.add(MINED_DROPS[blockType] ?? blockType);
      this.sfx.blockBreak();
      this.miningTarget = null;
      this.miningProgress = 0;
      this.miningSoundTimer = 0;
      return { mining: false, progress: 0, targetBlock: null, attacked };
    }

    return { mining: true, progress: this.miningProgress / hardness, targetBlock: hoverBlock, attacked };
  }
}
