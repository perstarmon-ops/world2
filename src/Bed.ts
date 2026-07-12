import * as THREE from "three";

/** Spans two blocks along its facing axis, slightly short of 2 so it doesn't clip into whatever's beyond the head/foot cells. */
const BED_LENGTH = 1.9;
const BED_WIDTH = 0.9;
const LEG_HEIGHT = 0.15;
const MATTRESS_HEIGHT = 0.35;
const PILLOW_LENGTH = 0.5;
const PILLOW_HEIGHT = 0.16;

function buildBedModel(): THREE.Group {
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x5a3a26 });
  const mattressMat = new THREE.MeshLambertMaterial({ color: 0xbc3630 });
  const pillowMat = new THREE.MeshLambertMaterial({ color: 0xe8e4d8 });

  const group = new THREE.Group();

  const legGeom = new THREE.BoxGeometry(0.1, LEG_HEIGHT, 0.1);
  const legOffsetX = BED_WIDTH / 2 - 0.08;
  const legOffsetZ = BED_LENGTH / 2 - 0.08;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeom, frameMat);
      leg.position.set(sx * legOffsetX, LEG_HEIGHT / 2, sz * legOffsetZ);
      group.add(leg);
    }
  }

  const mattress = new THREE.Mesh(new THREE.BoxGeometry(BED_WIDTH, MATTRESS_HEIGHT, BED_LENGTH), mattressMat);
  mattress.position.set(0, LEG_HEIGHT + MATTRESS_HEIGHT / 2, 0);
  group.add(mattress);

  // Sits at local +Z, which becomes the "head" end once the group is yawed to face the placement direction.
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(BED_WIDTH * 0.75, PILLOW_HEIGHT, PILLOW_LENGTH), pillowMat);
  pillow.position.set(0, LEG_HEIGHT + MATTRESS_HEIGHT + PILLOW_HEIGHT / 2, BED_LENGTH / 2 - PILLOW_LENGTH / 2 - 0.05);
  group.add(pillow);

  return group;
}

/** A placed bed: purely decorative (no collision or sleep interaction), spanning two blocks with the pillow at the head end. */
export class Bed {
  readonly group: THREE.Group;

  /** (centerX, centerZ) is the midpoint between the two occupied cells; y is the bottom of the cell the bed sits on; yaw points the pillow toward the head-end direction. */
  constructor(centerX: number, y: number, centerZ: number, yaw: number) {
    this.group = buildBedModel();
    this.group.position.set(centerX, y, centerZ);
    this.group.rotation.y = yaw;
  }
}
