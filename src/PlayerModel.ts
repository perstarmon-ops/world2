import * as THREE from "three";

/** A simple blocky humanoid used as the inventory-screen character preview. */
export function buildPlayerModel(): THREE.Group {
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0ac8e });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0xb33a24 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3a6ea5 });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a4d9e });
  const skirtMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const group = new THREE.Group();

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
  head.position.set(0, 1.6, 0);
  group.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), hairMat);
  hair.position.set(0, 1.83, 0);
  group.add(hair);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), shirtMat);
  body.position.set(0, 1.15, 0);
  group.add(body);

  const armGeom = new THREE.BoxGeometry(0.15, 0.65, 0.15);
  for (const x of [-0.32, 0.32]) {
    const arm = new THREE.Mesh(armGeom, shirtMat);
    arm.position.set(x, 1.15, 0);
    group.add(arm);
  }

  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.22, 0.36), skirtMat);
  skirt.position.set(0, 0.78, 0);
  group.add(skirt);

  for (const x of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), pantsMat);
    leg.position.set(x, 0.36, 0);
    group.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.26), shoeMat);
    shoe.position.set(x, 0.06, 0.02);
    group.add(shoe);
  }

  return group;
}
