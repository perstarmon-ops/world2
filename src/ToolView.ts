import * as THREE from "three";
import { Tool } from "./Inventory";

const REST_ROTATION = new THREE.Euler(-0.35, 0.5, 0.15);
const SWING_ROTATION = new THREE.Euler(-1.35, 0.35, -0.2);
const LOCAL_OFFSET = new THREE.Vector3(0.42, -0.38, -0.65);
const SWINGS_PER_SECOND = 2.6;
const IDLE_SWAY_SPEED = 1.4;
const IDLE_SWAY_AMOUNT = 0.01;
const ATTACK_SWING_DURATION = 0.25;

function buildPickaxe(): THREE.Group {
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4f31 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.055), handleMat);
  handle.position.set(0, 0.25, 0);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.11), headMat);
  head.position.set(0, 0.48, 0);
  head.rotation.z = Math.PI / 10;

  const headTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), headMat);
  headTip.position.set(-0.19, 0.51, 0);

  const group = new THREE.Group();
  group.add(handle, head, headTip);
  return group;
}

function buildAxe(): THREE.Group {
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4f31 });
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.055), handleMat);
  handle.position.set(0, 0.25, 0);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.06), bladeMat);
  blade.position.set(0.11, 0.46, 0);
  blade.rotation.z = -Math.PI / 14;

  const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.09), bladeMat);
  bladeEdge.position.set(0.2, 0.46, 0);

  const group = new THREE.Group();
  group.add(handle, blade, bladeEdge);
  return group;
}

function buildShovel(): THREE.Group {
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4f31 });
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xb0b0b0 });

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), handleMat);
  handle.position.set(0, 0.275, 0);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.03), bladeMat);
  blade.position.set(0, 0.6, 0);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.09), handleMat);
  grip.position.set(0, 0.02, 0);

  const group = new THREE.Group();
  group.add(handle, blade, grip);
  return group;
}

function buildHand(): THREE.Group {
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0ac8e });
  const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x3a6ea5 });

  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.17), sleeveMat);
  sleeve.position.set(0, 0.08, 0);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.13), skinMat);
  arm.position.set(0, 0.32, 0);

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.1), skinMat);
  hand.position.set(0, 0.52, 0.02);

  const group = new THREE.Group();
  group.add(sleeve, arm, hand);
  return group;
}

function buildSword(): THREE.Group {
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xcdd2d8 });
  const guardMat = new THREE.MeshLambertMaterial({ color: 0x8a7040 });
  const gripMat = new THREE.MeshLambertMaterial({ color: 0x4a3324 });

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.03), bladeMat);
  blade.position.set(0, 0.55, 0);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), guardMat);
  guard.position.set(0, 0.26, 0);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), gripMat);
  grip.position.set(0, 0.15, 0);

  const group = new THREE.Group();
  group.add(blade, guard, grip);
  return group;
}

/**
 * First-person held tool. Follows the camera every frame (rather than being
 * parented to it) because the renderer only draws objects reachable from the
 * scene graph, and the camera itself isn't added to the scene.
 */
export class ToolView {
  readonly group = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly models: Record<Tool, THREE.Group>;
  private readonly handModel: THREE.Group;
  private activeTool: Tool | null = "pickaxe";
  private time = 0;
  private attackTimer = 0;

  constructor() {
    this.models = {
      pickaxe: buildPickaxe(),
      axe: buildAxe(),
      shovel: buildShovel(),
      sword: buildSword(),
    };
    this.handModel = buildHand();
    this.pivot.add(this.models.pickaxe, this.models.axe, this.models.shovel, this.models.sword, this.handModel);
    this.pivot.rotation.copy(REST_ROTATION);
    this.group.add(this.pivot);
    this.group.renderOrder = 999;
    this.setActive("pickaxe");
  }

  /** Shows the held tool's model, or the bare hand/arm when no tool is selected. */
  private setActive(tool: Tool | null): void {
    this.activeTool = tool;
    for (const key of Object.keys(this.models) as Tool[]) {
      this.models[key].visible = key === tool;
    }
    this.handModel.visible = tool === null;
  }

  /** Repositions the view-model relative to the camera and advances its swing/idle animation. */
  update(dt: number, camera: THREE.Camera, mining: boolean, tool: Tool | null, attacked: boolean): void {
    this.time += dt;
    if (attacked) this.attackTimer = ATTACK_SWING_DURATION;
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    if (tool !== this.activeTool) this.setActive(tool);

    this.group.position.copy(camera.position);
    this.group.quaternion.copy(camera.quaternion);
    this.group.translateX(LOCAL_OFFSET.x);
    this.group.translateY(LOCAL_OFFSET.y);
    this.group.translateZ(LOCAL_OFFSET.z);

    if (this.attackTimer > 0) {
      const progress = 1 - this.attackTimer / ATTACK_SWING_DURATION;
      const swing = Math.sin(progress * Math.PI);
      this.pivot.rotation.x = THREE.MathUtils.lerp(REST_ROTATION.x, SWING_ROTATION.x, swing);
      this.pivot.rotation.y = THREE.MathUtils.lerp(REST_ROTATION.y, SWING_ROTATION.y, swing);
      this.pivot.rotation.z = THREE.MathUtils.lerp(REST_ROTATION.z, SWING_ROTATION.z, swing);
    } else if (mining) {
      const swing = (Math.sin(this.time * SWINGS_PER_SECOND * Math.PI * 2) + 1) / 2;
      this.pivot.rotation.x = THREE.MathUtils.lerp(REST_ROTATION.x, SWING_ROTATION.x, swing);
      this.pivot.rotation.y = THREE.MathUtils.lerp(REST_ROTATION.y, SWING_ROTATION.y, swing);
      this.pivot.rotation.z = THREE.MathUtils.lerp(REST_ROTATION.z, SWING_ROTATION.z, swing);
    } else {
      const sway = Math.sin(this.time * IDLE_SWAY_SPEED) * IDLE_SWAY_AMOUNT;
      this.pivot.rotation.set(REST_ROTATION.x + sway, REST_ROTATION.y, REST_ROTATION.z);
    }
  }
}
