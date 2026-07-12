import * as THREE from "three";

const BOAT_LENGTH = 1.4;
const BOAT_WIDTH = 0.8;
const BOAT_WALL_HEIGHT = 0.32;

function buildBoatModel(): THREE.Group {
  const hullMat = new THREE.MeshLambertMaterial({ color: 0x8a5a35 });
  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.BoxGeometry(BOAT_WIDTH, 0.14, BOAT_LENGTH), hullMat);
  base.position.y = 0.07;
  group.add(base);

  const sideGeom = new THREE.BoxGeometry(0.08, BOAT_WALL_HEIGHT, BOAT_LENGTH);
  const leftWall = new THREE.Mesh(sideGeom, hullMat);
  leftWall.position.set(-BOAT_WIDTH / 2 + 0.04, BOAT_WALL_HEIGHT / 2, 0);
  const rightWall = new THREE.Mesh(sideGeom, hullMat);
  rightWall.position.set(BOAT_WIDTH / 2 - 0.04, BOAT_WALL_HEIGHT / 2, 0);
  group.add(leftWall, rightWall);

  const endGeom = new THREE.BoxGeometry(BOAT_WIDTH, BOAT_WALL_HEIGHT, 0.08);
  const frontWall = new THREE.Mesh(endGeom, hullMat);
  frontWall.position.set(0, BOAT_WALL_HEIGHT / 2, BOAT_LENGTH / 2 - 0.04);
  const backWall = new THREE.Mesh(endGeom, hullMat);
  backWall.position.set(0, BOAT_WALL_HEIGHT / 2, -BOAT_LENGTH / 2 + 0.04);
  group.add(frontWall, backWall);

  return group;
}

/** A placeable, rideable boat that floats on the water surface. */
export class Boat {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  yaw = 0;

  constructor(x: number, y: number, z: number) {
    this.group = buildBoatModel();
    this.position = new THREE.Vector3(x, y, z);
    this.syncMesh();
  }

  syncMesh(): void {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }
}
