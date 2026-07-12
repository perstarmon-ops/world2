import * as THREE from "three";
import { Boat } from "./Boat";

/** How close the player needs to be to mount a boat by pressing F (horizontal distance only, so standing on an elevated shore still counts). */
const MOUNT_RADIUS = 4;
/** Sits the hull just above the water surface instead of half-submerged. */
export const BOAT_FLOAT_OFFSET = 0.15;

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

  update(): void {
    for (const boat of this.boats) boat.syncMesh();
  }
}
