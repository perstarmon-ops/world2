import * as THREE from "three";
import { Tool } from "./Inventory";

const REST_ROTATION = new THREE.Euler(-0.35, 0.5, 0.15);
const SWING_ROTATION = new THREE.Euler(-1.35, 0.35, -0.2);
const LOCAL_OFFSET = new THREE.Vector3(0.42, -0.38, -0.65);
const SWINGS_PER_SECOND = 2.6;
const IDLE_SWAY_SPEED = 1.4;
const IDLE_SWAY_AMOUNT = 0.01;

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

/**
 * First-person held tool. Follows the camera every frame (rather than being
 * parented to it) because the renderer only draws objects reachable from the
 * scene graph, and the camera itself isn't added to the scene.
 */
export class ToolView {
  readonly group = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly models: Record<Tool, THREE.Group>;
  private activeTool: Tool = "pickaxe";
  private time = 0;

  constructor() {
    this.models = {
      pickaxe: buildPickaxe(),
      axe: buildAxe(),
    };
    this.pivot.add(this.models.pickaxe, this.models.axe);
    this.pivot.rotation.copy(REST_ROTATION);
    this.group.add(this.pivot);
    this.group.renderOrder = 999;
    this.setTool("pickaxe");
  }

  private setTool(tool: Tool): void {
    this.activeTool = tool;
    this.models.pickaxe.visible = tool === "pickaxe";
    this.models.axe.visible = tool === "axe";
  }

  /** Repositions the view-model relative to the camera and advances its swing/idle animation. */
  update(dt: number, camera: THREE.Camera, mining: boolean, tool: Tool | null): void {
    this.time += dt;
    this.group.visible = tool !== null;
    if (tool !== null && tool !== this.activeTool) this.setTool(tool);

    this.group.position.copy(camera.position);
    this.group.quaternion.copy(camera.quaternion);
    this.group.translateX(LOCAL_OFFSET.x);
    this.group.translateY(LOCAL_OFFSET.y);
    this.group.translateZ(LOCAL_OFFSET.z);

    if (mining) {
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
