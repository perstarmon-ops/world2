import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { BlockType } from "./blocks";
import { ChunkMesher } from "./ChunkMesher";
import { Player } from "./Player";
import { raycastVoxels } from "./raycast";
import { World } from "./World";

const REACH = 6;

export class Interaction {
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: PointerLockControls,
    private readonly world: World,
    private readonly mesher: ChunkMesher,
    private readonly player: Player,
    private readonly getSelectedBlock: () => BlockType,
    domElement: HTMLElement,
  ) {
    domElement.ownerDocument.addEventListener("mousedown", (e) => this.onMouseDown(e));
    domElement.ownerDocument.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.controls.isLocked) return;
    const origin = this.player.getEyePosition().clone();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    const hit = raycastVoxels(this.world, origin, direction, REACH);
    if (!hit) return;

    if (e.button === 0) {
      this.world.setBlock(hit.block.x, hit.block.y, hit.block.z, BlockType.AIR);
      this.mesher.rebuildAround(hit.block.x, hit.block.z);
    } else if (e.button === 2) {
      const { x, y, z } = hit.before;
      if (!this.world.inBounds(x, y, z)) return;
      if (this.player.occupiesBlock(x, y, z)) return;
      this.world.setBlock(x, y, z, this.getSelectedBlock());
      this.mesher.rebuildAround(x, z);
    }
  }
}
