import * as THREE from "three";
import { buildPlayerModel } from "./PlayerModel";

/**
 * A small self-contained Three.js scene rendered into the inventory
 * screen's preview canvas, showing the player's own character model -
 * separate from the main renderer since it needs its own camera/lighting
 * and only needs to render while the inventory is open.
 */
export class PlayerPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly model: THREE.Group;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(140, 200, false);

    this.camera = new THREE.PerspectiveCamera(30, 140 / 200, 0.1, 10);
    this.camera.position.set(0, 1.0, 4.2);
    this.camera.lookAt(0, 0.95, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(2, 3, 2);
    this.scene.add(dirLight);

    this.model = buildPlayerModel();
    this.scene.add(this.model);
  }

  update(dt: number): void {
    this.time += dt;
    this.model.rotation.y = Math.sin(this.time * 0.6) * 0.5;
    this.renderer.render(this.scene, this.camera);
  }
}
