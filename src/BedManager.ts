import * as THREE from "three";
import { Bed } from "./Bed";

/** How close a click's crosshair ray needs to pass to a bed's center to count as a hit. */
const HIT_RADIUS = 1.1;

interface PlacedBed {
  bed: Bed;
  footX: number;
  footY: number;
  footZ: number;
  headX: number;
  headZ: number;
}

/** Tracks every placed bed in one dimension: rendering, mining removal, and click-to-mount lookup. */
export class BedManager {
  private readonly placed: PlacedBed[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  place(footX: number, footY: number, footZ: number, headX: number, headZ: number, centerX: number, centerZ: number, yaw: number): void {
    const bed = new Bed(centerX, footY, centerZ, yaw);
    this.placed.push({ bed, footX, footY, footZ, headX, headZ });
    this.scene.add(bed.group);
  }

  /** If (x,y,z) is either cell of a placed bed, removes it and returns the paired cell so the caller can clear that from the world grid too. */
  removeAt(x: number, y: number, z: number): { x: number; y: number; z: number } | null {
    const index = this.placed.findIndex(
      (p) => p.footY === y && ((p.footX === x && p.footZ === z) || (p.headX === x && p.headZ === z)),
    );
    if (index === -1) return null;
    const [entry] = this.placed.splice(index, 1);
    this.scene.remove(entry.bed.group);
    const isFoot = entry.footX === x && entry.footZ === z;
    return isFoot ? { x: entry.headX, y: entry.footY, z: entry.headZ } : { x: entry.footX, y: entry.footY, z: entry.footZ };
  }

  /** The nearest bed whose crosshair ray passes within range, for click-to-mount. */
  raycastHit(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): Bed | null {
    let closest: Bed | null = null;
    let closestT = Infinity;
    for (const { bed } of this.placed) {
      const center = bed.group.position.clone();
      center.y += 0.3;
      const toCenter = center.clone().sub(origin);
      const t = toCenter.dot(direction);
      if (t < 0 || t > maxDistance) continue;
      const closestPoint = origin.clone().addScaledVector(direction, t);
      if (closestPoint.distanceTo(center) > HIT_RADIUS) continue;
      if (t < closestT) {
        closest = bed;
        closestT = t;
      }
    }
    return closest;
  }
}
