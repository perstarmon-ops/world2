import * as THREE from "three";
import { BlockType } from "./blocks";
import { getBlockIconUrl } from "./textures";

const sandGeometry = new THREE.BoxGeometry(1, 1, 1);
let sandMaterial: THREE.MeshLambertMaterial | null = null;

/** Lazily built so the texture (a data URL canvas) only has to be decoded once, the first time sand actually falls. */
function getSandMaterial(): THREE.MeshLambertMaterial {
  if (!sandMaterial) {
    const texture = new THREE.TextureLoader().load(getBlockIconUrl(BlockType.SAND));
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    sandMaterial = new THREE.MeshLambertMaterial({ map: texture });
  }
  return sandMaterial;
}

/** A sand block that has lost its support and is falling under gravity until it lands and rejoins the world grid as a real block. */
export class FallingSand {
  readonly mesh: THREE.Mesh;
  /** Center of the block; only Y changes as it falls. */
  readonly position: THREE.Vector3;
  velocityY = 0;

  constructor(x: number, y: number, z: number) {
    this.mesh = new THREE.Mesh(sandGeometry, getSandMaterial());
    this.position = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
    this.mesh.position.copy(this.position);
  }

  syncMesh(): void {
    this.mesh.position.copy(this.position);
  }
}
