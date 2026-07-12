import * as THREE from "three";
import { Bed } from "./Bed";

/** Tracks every placed bed in one dimension. Purely decorative - no collision, no sleep interaction. */
export class BedManager {
  private readonly beds: Bed[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  place(centerX: number, y: number, centerZ: number, yaw: number): void {
    const bed = new Bed(centerX, y, centerZ, yaw);
    this.beds.push(bed);
    this.scene.add(bed.group);
  }
}
