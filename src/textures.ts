import * as THREE from "three";
import { BlockType, BLOCKS } from "./blocks";

const TEXTURE_SIZE = 16;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(
  [r, g, b]: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    Math.max(0, Math.min(255, r + amount)),
    Math.max(0, Math.min(255, g + amount)),
    Math.max(0, Math.min(255, b + amount)),
  ];
}

/** Procedurally paints a speckled, pixel-art style block texture onto a canvas. */
function paintTexture(
  color: [number, number, number],
  seed: number,
  options: { grain?: number; horizontalBands?: boolean } = {},
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(seed);
  const grain = options.grain ?? 18;

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      let variance = (rand() - 0.5) * grain;
      if (options.horizontalBands) {
        variance += Math.sin(y * 1.3) * 4;
      }
      const [r, g, b] = shade(color, variance);
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function canvasToTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export type MaterialKey =
  | "grass_top"
  | "grass_side"
  | "wood_top"
  | BlockType;

/** Builds one MeshLambertMaterial per distinct block face appearance. */
export function buildMaterials(): Map<MaterialKey, THREE.MeshLambertMaterial> {
  const materials = new Map<MaterialKey, THREE.MeshLambertMaterial>();

  const makeMat = (
    key: MaterialKey,
    canvas: HTMLCanvasElement,
    transparent: boolean,
    opacity = 1,
  ) => {
    materials.set(
      key,
      new THREE.MeshLambertMaterial({
        map: canvasToTexture(canvas),
        transparent,
        opacity,
        alphaTest: transparent && opacity >= 1 ? 0.5 : 0,
        side: transparent ? THREE.DoubleSide : THREE.FrontSide,
      }),
    );
  };

  // Grass needs three distinct faces: top, side (dirt w/ green fringe), bottom (plain dirt).
  makeMat("grass_top", paintTexture(BLOCKS[BlockType.GRASS].color, 1), false);
  makeMat("grass_side", paintGrassSide(), false);
  makeMat(BlockType.DIRT, paintTexture(BLOCKS[BlockType.DIRT].color, 2), false);
  makeMat(BlockType.STONE, paintTexture(BLOCKS[BlockType.STONE].color, 3, { grain: 24 }), false);
  makeMat(BlockType.SAND, paintTexture(BLOCKS[BlockType.SAND].color, 4, { grain: 10 }), false);
  makeMat(BlockType.WOOD, paintWoodSide(), false);
  makeMat("wood_top", paintWoodTop(), false);
  makeMat(BlockType.LEAVES, paintTexture(BLOCKS[BlockType.LEAVES].color, 6, { grain: 30 }), true, 1);
  makeMat(BlockType.WATER, paintTexture(BLOCKS[BlockType.WATER].color, 7, { grain: 12 }), true, 0.7);
  makeMat(BlockType.PLANK, paintTexture(BLOCKS[BlockType.PLANK].color, 8, { horizontalBands: true }), false);
  makeMat(BlockType.GLASS, paintGlass(), true, 0.4);
  makeMat(BlockType.BRICK, paintBrick(), false);
  makeMat(BlockType.MEAT, paintTexture(BLOCKS[BlockType.MEAT].color, 11, { grain: 26 }), false);

  return materials;
}

function paintGrassSide(): HTMLCanvasElement {
  const dirt = BLOCKS[BlockType.DIRT].color;
  const grass = BLOCKS[BlockType.GRASS].color;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(5);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const variance = (rand() - 0.5) * 18;
      const base = y < 4 ? grass : dirt;
      const [r, g, b] = shade(base, variance);
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function paintWoodSide(): HTMLCanvasElement {
  const color = BLOCKS[BlockType.WOOD].color;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(9);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const stripe = Math.sin(x * 2.1) * 10;
      const variance = (rand() - 0.5) * 8 + stripe;
      const [r, g, b] = shade(color, variance);
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function paintWoodTop(): HTMLCanvasElement {
  const color = BLOCKS[BlockType.WOOD].color;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const cx = TEXTURE_SIZE / 2;
  const cy = TEXTURE_SIZE / 2;
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      const ring = Math.sin(dist * 1.4) * 14;
      const [r, g, b] = shade(color, ring);
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function paintGlass(): HTMLCanvasElement {
  const color = BLOCKS[BlockType.GLASS].color;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.strokeRect(0.5, 0.5, TEXTURE_SIZE - 1, TEXTURE_SIZE - 1);
  return canvas;
}

function paintBrick(): HTMLCanvasElement {
  const color = BLOCKS[BlockType.BRICK].color;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const [r, g, b] = color;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  ctx.strokeStyle = `rgba(60,30,25,0.9)`;
  ctx.lineWidth = 1;
  const rowHeight = 4;
  for (let y = 0; y <= TEXTURE_SIZE; y += rowHeight) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(TEXTURE_SIZE, y + 0.5);
    ctx.stroke();
  }
  let offset = 0;
  for (let y = 0; y < TEXTURE_SIZE; y += rowHeight) {
    for (let x = offset; x <= TEXTURE_SIZE; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + rowHeight);
      ctx.stroke();
    }
    offset = offset === 0 ? 4 : 0;
  }
  return canvas;
}
