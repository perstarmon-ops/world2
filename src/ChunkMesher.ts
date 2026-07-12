import * as THREE from "three";
import { BlockType, BLOCKS } from "./blocks";
import { CHUNK_SIZE, World, WORLD_HEIGHT, chunkKey } from "./World";
import { MaterialKey, buildMaterials } from "./textures";

interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
}

// Unit-cube faces, each wound counter-clockwise as seen from outside (outward normal).
const FACES: FaceDef[] = [
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    dir: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  {
    dir: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
];

const FACE_UVS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

// Two diagonal quads forming an X shape, for thin cross-billboard plants (flowers).
// Always emitted regardless of neighbors, and rendered with a double-sided material
// so each single quad is visible from both directions.
const CROSS_QUADS: [number, number, number][][] = [
  [
    [0, 0, 0],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 0],
  ],
  [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
    [1, 1, 0],
  ],
];

function materialKeyFor(block: BlockType, faceDir: [number, number, number]): MaterialKey {
  if (block === BlockType.GRASS) {
    if (faceDir[1] === 1) return "grass_top";
    if (faceDir[1] === -1) return BlockType.DIRT;
    return "grass_side";
  }
  if (block === BlockType.WOOD) {
    if (faceDir[1] !== 0) return "wood_top";
    return BlockType.WOOD;
  }
  return block;
}

interface FaceBuffer {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

function emptyBuffer(): FaceBuffer {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

/**
 * Builds one THREE.Group per chunk, with one mesh per material so faces of
 * the same block "skin" are batched into a single draw call.
 */
export class ChunkMesher {
  private readonly materials: Map<MaterialKey, THREE.MeshLambertMaterial>;
  private readonly chunkGroups = new Map<string, THREE.Group>();

  constructor(private readonly world: World, private readonly scene: THREE.Scene) {
    this.materials = buildMaterials();
  }

  buildAll(): void {
    const chunksX = Math.ceil(this.world.sizeX / CHUNK_SIZE);
    const chunksZ = Math.ceil(this.world.sizeZ / CHUNK_SIZE);
    for (let cx = 0; cx < chunksX; cx++) {
      for (let cz = 0; cz < chunksZ; cz++) {
        this.rebuildChunk(cx, cz);
      }
    }
  }

  /** Rebuild (or remove, if empty) the mesh for a single chunk in place. */
  rebuildChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const existing = this.chunkGroups.get(key);
    if (existing) {
      this.scene.remove(existing);
      existing.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      this.chunkGroups.delete(key);
    }

    const buffers = new Map<MaterialKey, FaceBuffer>();
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;
    const endX = Math.min(startX + CHUNK_SIZE, this.world.sizeX);
    const endZ = Math.min(startZ + CHUNK_SIZE, this.world.sizeZ);

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const block = this.world.getBlock(x, y, z);
          if (block === BlockType.AIR || BLOCKS[block].hideMesh) continue;

          if (BLOCKS[block].renderAsCross) {
            const key2 = materialKeyFor(block, [0, 1, 0]);
            let buf = buffers.get(key2);
            if (!buf) {
              buf = emptyBuffer();
              buffers.set(key2, buf);
            }
            for (const quad of CROSS_QUADS) {
              const vertStart = buf.positions.length / 3;
              for (let i = 0; i < 4; i++) {
                const corner = quad[i];
                buf.positions.push(x + corner[0], y + corner[1], z + corner[2]);
                buf.normals.push(0, 1, 0);
                buf.uvs.push(FACE_UVS[i][0], FACE_UVS[i][1]);
              }
              buf.indices.push(vertStart, vertStart + 1, vertStart + 2, vertStart, vertStart + 2, vertStart + 3);
            }
            continue;
          }

          for (const face of FACES) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            const neighbor = this.world.getBlock(nx, ny, nz);
            if (neighbor === block) continue;
            if (neighbor !== BlockType.AIR && !BLOCKS[neighbor].transparent) continue;

            const key2 = materialKeyFor(block, face.dir);
            let buf = buffers.get(key2);
            if (!buf) {
              buf = emptyBuffer();
              buffers.set(key2, buf);
            }
            const vertStart = buf.positions.length / 3;
            for (let i = 0; i < 4; i++) {
              const corner = face.corners[i];
              buf.positions.push(x + corner[0], y + corner[1], z + corner[2]);
              buf.normals.push(face.dir[0], face.dir[1], face.dir[2]);
              buf.uvs.push(FACE_UVS[i][0], FACE_UVS[i][1]);
            }
            buf.indices.push(vertStart, vertStart + 1, vertStart + 2, vertStart, vertStart + 2, vertStart + 3);
          }
        }
      }
    }

    if (buffers.size === 0) return;

    const group = new THREE.Group();
    group.name = key;
    for (const [matKey, buf] of buffers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(buf.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buf.normals, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uvs, 2));
      geometry.setIndex(buf.indices);
      const material = this.materials.get(matKey)!;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
    }
    this.scene.add(group);
    this.chunkGroups.set(key, group);
  }

  /** Rebuild the chunk containing (x,z) plus neighbors if the edit was on a chunk boundary. */
  rebuildAround(x: number, z: number): void {
    const [cx, cz] = this.world.chunkCoordFor(x, z);
    const localX = x - cx * CHUNK_SIZE;
    const localZ = z - cz * CHUNK_SIZE;
    const touched = new Set<string>();
    const add = (dx: number, dz: number) => touched.add(`${cx + dx},${cz + dz}`);
    add(0, 0);
    if (localX === 0) add(-1, 0);
    if (localX === CHUNK_SIZE - 1) add(1, 0);
    if (localZ === 0) add(0, -1);
    if (localZ === CHUNK_SIZE - 1) add(0, 1);
    for (const key of touched) {
      const [tx, tz] = key.split(",").map(Number);
      this.rebuildChunk(tx, tz);
    }
  }

  /** Shows/hides every chunk mesh, for switching between dimensions sharing one scene. */
  setVisible(visible: boolean): void {
    for (const group of this.chunkGroups.values()) {
      group.visible = visible;
    }
  }
}
