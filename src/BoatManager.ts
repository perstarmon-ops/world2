import * as THREE from "three";
import { Boat } from "./Boat";
import { Player } from "./Player";

/** How close the player needs to be to mount a boat by pressing F (horizontal distance only, so standing on an elevated shore still counts). */
const MOUNT_RADIUS = 4;
/** Sits the hull just above the water surface instead of half-submerged. */
export const BOAT_FLOAT_OFFSET = 0.15;
/** Soft push-back radius so an unmounted boat isn't walk-through, without needing real voxel-grid collision. */
const PUSH_RADIUS = 0.85;
/** How close a click's crosshair ray needs to pass to a boat's center to count as a hit. */
const HIT_RADIUS = 1.2;

/** Tracks every placed boat in one dimension: rendering, mounting, and lookup. Boats only ever exist in the overworld (the nether has no water). */
export class BoatManager {
  private readonly boats: Boat[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  place(x: number, y: number, z: number): Boat {
    const boat = new Boat(x, y, z);
    this.boats.push(boat);
    this.scene.add(boat.group);
    return boat;
  }

  /** The nearest boat within horizontal mounting range of `origin`, or null. */
  findNearby(origin: THREE.Vector3): Boat | null {
    let closest: Boat | null = null;
    let closestDist = MOUNT_RADIUS;
    for (const boat of this.boats) {
      const dist = Math.hypot(boat.position.x - origin.x, boat.position.z - origin.z);
      if (dist < closestDist) {
        closest = boat;
        closestDist = dist;
      }
    }
    return closest;
  }

  /** The nearest boat whose crosshair ray passes within range, for click-to-mount. */
  raycastHit(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): Boat | null {
    let closest: Boat | null = null;
    let closestT = Infinity;
    for (const boat of this.boats) {
      const center = boat.position.clone();
      center.y += 0.2;
      const toCenter = center.clone().sub(origin);
      const t = toCenter.dot(direction);
      if (t < 0 || t > maxDistance) continue;
      const closestPoint = origin.clone().addScaledVector(direction, t);
      if (closestPoint.distanceTo(center) > HIT_RADIUS) continue;
      if (t < closestT) {
        closest = boat;
        closestT = t;
      }
    }
    return closest;
  }

  /** Shoves the player back if they've walked into an unmounted boat, since boats don't occupy the voxel grid so normal collision doesn't apply. */
  pushPlayerAway(player: Player): void {
    if (player.isRidingBoat()) return;
    for (const boat of this.boats) {
      const dx = player.position.x - boat.position.x;
      const dz = player.position.z - boat.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= PUSH_RADIUS) continue;
      const [ux, uz] = dist < 1e-4 ? [1, 0] : [dx / dist, dz / dist];
      player.push(ux * (PUSH_RADIUS - dist), uz * (PUSH_RADIUS - dist));
    }
  }

  update(): void {
    for (const boat of this.boats) boat.syncMesh();
  }
}
