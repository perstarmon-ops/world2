import * as THREE from "three";
import { Door } from "./Door";

interface PlacedDoor {
  door: Door;
  /** The door's foot (bottom) cell; its top cell is directly above at y+1. */
  x: number;
  y: number;
  z: number;
}

/**
 * Tracks every placed door: rendering, animated open/close, and mining
 * removal. Each door occupies two vertically-stacked world cells (for real
 * collision/mining) but is a single hand-built visual entity.
 */
export class DoorManager {
  private readonly placed: PlacedDoor[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  place(x: number, y: number, z: number, hingeX: number, hingeZ: number, baseYaw: number, swingSign: 1 | -1): void {
    const door = new Door(hingeX, y, hingeZ, baseYaw, swingSign);
    this.placed.push({ door, x, y, z });
    this.scene.add(door.group);
  }

  private findAt(x: number, y: number, z: number): PlacedDoor | undefined {
    return this.placed.find((p) => p.x === x && p.z === z && (p.y === y || p.y + 1 === y));
  }

  /** Starts the open/closed swing animation for the door occupying (x,y,z) - either its foot or head cell - if any. */
  setOpen(x: number, y: number, z: number, open: boolean): void {
    this.findAt(x, y, z)?.door.setOpen(open);
  }

  /** Removes the door occupying (x,y,z), returning its foot cell coordinates so the caller can clear both world cells, or null if there wasn't one. */
  remove(x: number, y: number, z: number): { x: number; y: number; z: number } | null {
    const index = this.placed.findIndex((p) => p.x === x && p.z === z && (p.y === y || p.y + 1 === y));
    if (index === -1) return null;
    const [entry] = this.placed.splice(index, 1);
    this.scene.remove(entry.door.group);
    return { x: entry.x, y: entry.y, z: entry.z };
  }

  update(dt: number): void {
    for (const { door } of this.placed) door.update(dt);
  }
}
