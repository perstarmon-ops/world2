import * as THREE from "three";
import { BlockType } from "./blocks";
import { World } from "./World";

export interface VoxelHit {
  /** Coordinates of the solid block that was hit. */
  block: THREE.Vector3;
  /** The empty-space coordinate just before the hit block (where a new block would be placed). */
  before: THREE.Vector3;
  /** Face normal of the hit surface. */
  normal: THREE.Vector3;
}

/**
 * Amanatides & Woo voxel traversal: walks a ray through the block grid one
 * cell at a time so we hit exactly the block the crosshair is over, without
 * relying on per-block scene raycasting.
 */
export function raycastVoxels(
  world: World,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
): VoxelHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);

  const tDelta = new THREE.Vector3(
    direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity,
    direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity,
    direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity,
  );

  const boundary = (pos: number, step: number, cell: number) =>
    step > 0 ? cell + 1 - pos : pos - cell;

  const tMax = new THREE.Vector3(
    direction.x !== 0 ? boundary(origin.x, stepX, x) * tDelta.x : Infinity,
    direction.y !== 0 ? boundary(origin.y, stepY, y) * tDelta.y : Infinity,
    direction.z !== 0 ? boundary(origin.z, stepZ, z) * tDelta.z : Infinity,
  );

  let normal = new THREE.Vector3();
  let traveled = 0;

  while (traveled <= maxDistance) {
    const block = world.getBlock(x, y, z);
    if (block !== BlockType.AIR) {
      return {
        block: new THREE.Vector3(x, y, z),
        before: new THREE.Vector3(x - normal.x, y - normal.y, z - normal.z),
        normal: normal.clone(),
      };
    }

    if (tMax.x < tMax.y && tMax.x < tMax.z) {
      x += stepX;
      traveled = tMax.x;
      tMax.x += tDelta.x;
      normal.set(-stepX, 0, 0);
    } else if (tMax.y < tMax.z) {
      y += stepY;
      traveled = tMax.y;
      tMax.y += tDelta.y;
      normal.set(0, -stepY, 0);
    } else {
      z += stepZ;
      traveled = tMax.z;
      tMax.z += tDelta.z;
      normal.set(0, 0, -stepZ);
    }
  }

  return null;
}
