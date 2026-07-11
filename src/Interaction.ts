import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { AnimalManager } from "./AnimalManager";
import { BlockType, BLOCKS } from "./blocks";
import { ChunkMesher } from "./ChunkMesher";
import { Inventory, Tool } from "./Inventory";
import { MobKind } from "./Mob";
import { Player } from "./Player";
import { raycastVoxels } from "./raycast";
import { World } from "./World";

const REACH = 6;
const WATER_MINING_SPEED = 0.35;
const TOOL_BONUS_SPEED = 2;

/** Blocks each tool mines at TOOL_BONUS_SPEED instead of the base rate. The sword can't mine at all. */
const TOOL_BONUS_BLOCKS: Record<Tool, BlockType[]> = {
  pickaxe: [BlockType.STONE, BlockType.DIAMOND_ORE, BlockType.GOLD_ORE],
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
const ANIMAL_DROPS: Partial<Record<MobKind, BlockType>> = {
  pig: BlockType.MEAT,
  cow: BlockType.MEAT,
  goat: BlockType.MEAT,
  chicken: BlockType.MEAT,
  sheep: BlockType.WOOL,
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
  private attackedThisFrame = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: PointerLockControls,
    private readonly world: World,
    private readonly mesher: ChunkMesher,
    private readonly player: Player,
    private readonly inventory: Inventory,
    private readonly animals: AnimalManager,
    domElement: HTMLElement,
  ) {
    const doc = domElement.ownerDocument;
    doc.addEventListener("mousedown", (e) => this.onMouseDown(e));
    doc.addEventListener("mouseup", (e) => this.onMouseUp(e));
    doc.addEventListener("contextmenu", (e) => e.preventDefault());
    controls.addEventListener("unlock", () => this.resetMining());
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.controls.isLocked) return;
    if (e.button === 0) {
      if (this.inventory.getSelectedTool() === "sword") {
        this.attack();
      } else {
        this.isLeftDown = true;
      }
    } else if (e.button === 2) {
      this.place();
    }
  }

  /** Swings the sword: always animates, kills the nearest mob in range if any, and drops meat from animals. */
  private attack(): void {
    this.attackedThisFrame = true;
    const origin = this.player.getEyePosition().clone();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const killed = this.animals.tryAttack(origin, direction, REACH);
    if (killed) {
      const drop = ANIMAL_DROPS[killed];
      if (drop) this.inventory.add(drop);
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
  }

  private place(): void {
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
    this.mesher.rebuildAround(x, z);
    this.player.resolveOverlap();
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
      !tool ||
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
    }

    const blockType = this.world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    const hardness = BLOCKS[blockType].hardness;
    let speed = this.player.isInWater() ? WATER_MINING_SPEED : 1;
    if (TOOL_BONUS_BLOCKS[tool].includes(blockType)) speed *= TOOL_BONUS_SPEED;
    this.miningProgress += dt * speed;

    if (this.miningProgress >= hardness) {
      this.world.setBlock(hit.block.x, hit.block.y, hit.block.z, BlockType.AIR);
      this.mesher.rebuildAround(hit.block.x, hit.block.z);
      this.inventory.add(MINED_DROPS[blockType] ?? blockType);
      this.miningTarget = null;
      this.miningProgress = 0;
      return { mining: false, progress: 0, targetBlock: null, attacked };
    }

    return { mining: true, progress: this.miningProgress / hardness, targetBlock: hoverBlock, attacked };
  }
}
