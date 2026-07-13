import * as THREE from "three";
import { BlockType } from "./blocks";
import { getBlockIconUrl } from "./textures";

/** Slightly under a full cell so it doesn't clip into the frame on either side. */
const DOOR_WIDTH = 0.95;
const DOOR_THICKNESS = 0.12;
/** Spans both cells of a 2-tall door, slightly short so it doesn't poke through the ceiling. */
const DOOR_HEIGHT = 1.95;
const OPEN_ANGLE = Math.PI / 2;
/** Radians per second - a quick, snappy swing rather than a slow creak. */
const SWING_SPEED = Math.PI * 2.4;

let doorMaterial: THREE.MeshLambertMaterial | null = null;

/** Reuses the door's real painted texture (same one used for in-world faces and inventory icons) instead of a flat color. */
function getDoorMaterial(): THREE.MeshLambertMaterial {
  if (!doorMaterial) {
    const texture = new THREE.TextureLoader().load(getBlockIconUrl(BlockType.DOOR_CLOSED));
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    doorMaterial = new THREE.MeshLambertMaterial({ map: texture });
  }
  return doorMaterial;
}

function buildDoorModel(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS), getDoorMaterial());
  // Offset so the mesh's own left edge sits at the group's local origin (the hinge line).
  mesh.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0);
  return mesh;
}

/**
 * A placed door: a thin slab pivoting around its hinge edge instead of a
 * full cube, animating open/closed instead of snapping instantly.
 */
export class Door {
  readonly group: THREE.Group;
  private angle = 0;
  private open = false;

  /**
   * (hingeX, hingeZ) is the world position of the door's vertical hinge
   * edge; y is the bottom of its foot cell. `baseYaw` orients the closed
   * door flush with the wall (0 for a wall running along X, so the slab's
   * local +X spans world +X; PI/2 for a wall running along Z). `swingSign`
   * picks which way it swings open around the hinge.
   */
  constructor(hingeX: number, y: number, hingeZ: number, private readonly baseYaw: number, private readonly swingSign: 1 | -1) {
    this.group = new THREE.Group();
    this.group.add(buildDoorModel());
    this.group.position.set(hingeX, y, hingeZ);
    this.syncMesh();
  }

  setOpen(open: boolean): void {
    this.open = open;
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Eases the swing angle toward its open/closed target by up to one frame's worth of motion. */
  update(dt: number): void {
    const target = this.open ? OPEN_ANGLE * this.swingSign : 0;
    const diff = target - this.angle;
    if (Math.abs(diff) <= SWING_SPEED * dt) {
      this.angle = target;
    } else {
      this.angle += Math.sign(diff) * SWING_SPEED * dt;
    }
    this.syncMesh();
  }

  private syncMesh(): void {
    this.group.rotation.y = this.baseYaw + this.angle;
  }
}
