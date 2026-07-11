import * as THREE from "three";

const REST_ROTATION = new THREE.Euler(-0.35, 0.5, 0.15);
const SWING_ROTATION = new THREE.Euler(-1.35, 0.35, -0.2);
const LOCAL_OFFSET = new THREE.Vector3(0.42, -0.38, -0.65);
const SWINGS_PER_SECOND = 2.6;
const IDLE_SWAY_SPEED = 1.4;
const IDLE_SWAY_AMOUNT = 0.01;

/**
 * First-person held pickaxe. Follows the camera every frame (rather than
 * being parented to it) because the renderer only draws objects reachable
 * from the scene graph, and the camera itself isn't added to the scene.
 */
export class Pickaxe {
  readonly group = new THREE.Group();
  private readonly model = new THREE.Group();
  private time = 0;

  constructor() {
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4f31 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.055), handleMat);
    handle.position.set(0, 0.25, 0);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.11), headMat);
    head.position.set(0, 0.48, 0);
    head.rotation.z = Math.PI / 10;

    const headTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), headMat);
    headTip.position.set(-0.19, 0.51, 0);

    this.model.add(handle, head, headTip);
    this.model.rotation.copy(REST_ROTATION);
    this.group.add(this.model);
    this.group.renderOrder = 999;
  }

  /** Repositions the view-model relative to the camera and advances its swing/idle animation. */
  update(dt: number, camera: THREE.Camera, mining: boolean): void {
    this.time += dt;

    this.group.position.copy(camera.position);
    this.group.quaternion.copy(camera.quaternion);
    this.group.translateX(LOCAL_OFFSET.x);
    this.group.translateY(LOCAL_OFFSET.y);
    this.group.translateZ(LOCAL_OFFSET.z);

    if (mining) {
      const swing = (Math.sin(this.time * SWINGS_PER_SECOND * Math.PI * 2) + 1) / 2;
      this.model.rotation.x = THREE.MathUtils.lerp(REST_ROTATION.x, SWING_ROTATION.x, swing);
      this.model.rotation.y = THREE.MathUtils.lerp(REST_ROTATION.y, SWING_ROTATION.y, swing);
      this.model.rotation.z = THREE.MathUtils.lerp(REST_ROTATION.z, SWING_ROTATION.z, swing);
    } else {
      const sway = Math.sin(this.time * IDLE_SWAY_SPEED) * IDLE_SWAY_AMOUNT;
      this.model.rotation.set(REST_ROTATION.x + sway, REST_ROTATION.y, REST_ROTATION.z);
    }
  }
}
