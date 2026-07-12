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

/** Painted canvases keyed the same as the materials, kept around so UI icons can reuse the exact in-world texture. */
const iconCanvases = new Map<MaterialKey, HTMLCanvasElement>();
const iconUrlCache = new Map<BlockType, string>();

/** Picks which face's texture best represents a block as a flat inventory icon. */
function iconKeyFor(block: BlockType): MaterialKey {
  if (block === BlockType.GRASS) return "grass_top";
  if (block === BlockType.WOOD) return "wood_top";
  return block;
}

/** A data URL of the block's real in-world texture, for painting inventory slot icons. */
export function getBlockIconUrl(block: BlockType): string {
  const cached = iconUrlCache.get(block);
  if (cached) return cached;
  const canvas = iconCanvases.get(iconKeyFor(block));
  const url = canvas ? canvas.toDataURL() : "";
  iconUrlCache.set(block, url);
  return url;
}

/** Builds one MeshLambertMaterial per distinct block face appearance. */
export function buildMaterials(): Map<MaterialKey, THREE.MeshLambertMaterial> {
  const materials = new Map<MaterialKey, THREE.MeshLambertMaterial>();

  const makeMat = (
    key: MaterialKey,
    canvas: HTMLCanvasElement,
    transparent: boolean,
    opacity = 1,
  ) => {
    iconCanvases.set(key, canvas);
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
  makeMat(BlockType.DIAMOND_ORE, paintDiamondOre(), false);
  makeMat(BlockType.DIAMOND, paintTexture(BLOCKS[BlockType.DIAMOND].color, 13, { grain: 14 }), false);
  makeMat(BlockType.FLOWER_RED, paintFlower(BLOCKS[BlockType.FLOWER_RED].color), true, 1);
  makeMat(BlockType.FLOWER_YELLOW, paintFlower(BLOCKS[BlockType.FLOWER_YELLOW].color), true, 1);
  makeMat(BlockType.GOLD_ORE, paintGoldOre(), false);
  makeMat(BlockType.GOLD, paintTexture(BLOCKS[BlockType.GOLD].color, 15, { grain: 14 }), false);
  makeMat(BlockType.WOOL, paintTexture(BLOCKS[BlockType.WOOL].color, 16, { grain: 22 }), false);
  makeMat(BlockType.PATH, paintTexture(BLOCKS[BlockType.PATH].color, 17, { horizontalBands: true }), false);
  makeMat(BlockType.DOOR_CLOSED, paintDoorClosed(), false);
  makeMat(BlockType.DOOR_OPEN, paintDoorOpen(), true, 1);
  makeMat(BlockType.OBSIDIAN, paintObsidian(), false);
  makeMat(BlockType.PORTAL, paintPortal(), true, 0.85);
  makeMat(BlockType.NETHERRACK, paintTexture(BLOCKS[BlockType.NETHERRACK].color, 21, { grain: 26 }), false);
  makeMat(BlockType.MUSHROOM_STEM, paintTexture(BLOCKS[BlockType.MUSHROOM_STEM].color, 22, { grain: 8 }), false);
  makeMat(BlockType.MUSHROOM_CAP, paintMushroomCap(), false);
  makeMat(BlockType.FIRE, paintFire(), true, 1);
  makeMat(BlockType.BED, paintBed(), false);
  makeMat(BlockType.COBBLESTONE, paintTexture(BLOCKS[BlockType.COBBLESTONE].color, 26, { grain: 42 }), false);
  makeMat(BlockType.SANDSTONE, paintTexture(BLOCKS[BlockType.SANDSTONE].color, 27, { horizontalBands: true }), false);
  makeMat(BlockType.RED_WOOL, paintTexture(BLOCKS[BlockType.RED_WOOL].color, 28, { grain: 22 }), false);
  makeMat(BlockType.YELLOW_WOOL, paintTexture(BLOCKS[BlockType.YELLOW_WOOL].color, 29, { grain: 22 }), false);
  makeMat(BlockType.BOAT, paintTexture(BLOCKS[BlockType.BOAT].color, 30, { horizontalBands: true }), false);
  makeMat(BlockType.FURNACE, paintFurnace(), false);
  makeMat(BlockType.COOKED_MEAT, paintTexture(BLOCKS[BlockType.COOKED_MEAT].color, 31, { grain: 22 }), false);
  makeMat(BlockType.CHEST, paintChest(), false);

  return materials;
}

/** Wooden planks with a dark seam down the middle and a small metal latch, like a closed chest lid. */
function paintChest(): HTMLCanvasElement {
  const canvas = paintTexture(BLOCKS[BlockType.CHEST].color, 33, { horizontalBands: true });
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "rgba(50, 32, 16, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(1.5, 1.5, TEXTURE_SIZE - 3, TEXTURE_SIZE - 3);
  ctx.beginPath();
  ctx.moveTo(0, 7.5);
  ctx.lineTo(TEXTURE_SIZE, 7.5);
  ctx.stroke();
  ctx.fillStyle = "rgb(214, 190, 90)";
  ctx.fillRect(7, 6, 2, 3);
  return canvas;
}

/** Stone-gray block with a dark firebox opening, like an unlit furnace. */
function paintFurnace(): HTMLCanvasElement {
  const canvas = paintTexture(BLOCKS[BlockType.FURNACE].color, 32, { grain: 20 });
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(30, 28, 26)";
  ctx.fillRect(5, 5, 6, 6);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeRect(4.5, 4.5, 7, 7);
  return canvas;
}

/** Overlapping jagged orange/yellow flame licks on an otherwise transparent canvas, for cross-billboard fire. */
function paintFire(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(214, 84, 20)";
  ctx.beginPath();
  ctx.moveTo(3, 16);
  ctx.lineTo(2, 9);
  ctx.lineTo(5, 5);
  ctx.lineTo(4, 10);
  ctx.lineTo(8, 1);
  ctx.lineTo(7, 8);
  ctx.lineTo(11, 4);
  ctx.lineTo(9, 10);
  ctx.lineTo(13, 7);
  ctx.lineTo(11, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgb(250, 190, 60)";
  ctx.beginPath();
  ctx.moveTo(5, 16);
  ctx.lineTo(5, 11);
  ctx.lineTo(7, 7);
  ctx.lineTo(7, 12);
  ctx.lineTo(9, 8);
  ctx.lineTo(8, 16);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

/** Red blanket with a pale pillow stripe along one edge. */
function paintBed(): HTMLCanvasElement {
  const canvas = paintTexture(BLOCKS[BlockType.BED].color, 25, { grain: 10 });
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(232, 228, 220)";
  ctx.fillRect(1, 1, TEXTURE_SIZE - 2, 4);
  return canvas;
}

function paintMushroomCap(): HTMLCanvasElement {
  const canvas = paintTexture(BLOCKS[BlockType.MUSHROOM_CAP].color, 23, { grain: 12 });
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(124);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rand() * (TEXTURE_SIZE - 1));
    const y = Math.floor(rand() * (TEXTURE_SIZE - 1));
    ctx.fillStyle = "rgba(238, 232, 214, 0.9)";
    ctx.fillRect(x, y, 2, 2);
  }
  return canvas;
}

function paintObsidian(): HTMLCanvasElement {
  const color = BLOCKS[BlockType.OBSIDIAN].color;
  const canvas = paintTexture(color, 20, { grain: 14 });
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(122);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * TEXTURE_SIZE);
    const y = Math.floor(rand() * TEXTURE_SIZE);
    ctx.fillStyle = "rgba(150, 90, 220, 0.7)";
    ctx.fillRect(x, y, 1, 1);
  }
  return canvas;
}

/** Swirling purple portal surface, painted as concentric wavy bands so it reads as an energy field rather than a flat panel. */
function paintPortal(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const cx = TEXTURE_SIZE / 2;
  const cy = TEXTURE_SIZE / 2;
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      const wave = Math.sin(dist * 1.1 - x * 0.4 + y * 0.4) * 30;
      const [r, g, b] = shade(BLOCKS[BlockType.PORTAL].color, wave);
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function paintDoorClosed(): HTMLCanvasElement {
  const color = BLOCKS[BlockType.DOOR_CLOSED].color;
  const canvas = paintTexture(color, 19, { grain: 8 });
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "rgba(60, 40, 20, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(1.5, 1.5, TEXTURE_SIZE - 3, TEXTURE_SIZE - 3);
  ctx.strokeRect(3.5, 2.5, TEXTURE_SIZE - 7, 5);
  ctx.strokeRect(3.5, 9.5, TEXTURE_SIZE - 7, 5);
  ctx.fillStyle = "rgb(230, 210, 120)";
  ctx.fillRect(11, 8, 1, 1);
  return canvas;
}

/** Mostly-transparent so an open door reads as a passable gap, with a thin strip standing in for the door pushed against the frame. */
function paintDoorOpen(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const color = BLOCKS[BlockType.DOOR_CLOSED].color;
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  ctx.fillRect(0, 0, 3, TEXTURE_SIZE);
  return canvas;
}

function paintGoldOre(): HTMLCanvasElement {
  const stoneColor = BLOCKS[BlockType.STONE].color;
  const goldColor = BLOCKS[BlockType.GOLD].color;
  const canvas = paintTexture(stoneColor, 18, { grain: 20 });
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(121);

  const clusterCount = 4 + Math.floor(rand() * 2);
  for (let c = 0; c < clusterCount; c++) {
    const cx = Math.floor(rand() * TEXTURE_SIZE);
    const cy = Math.floor(rand() * TEXTURE_SIZE);
    const speckles = [
      [cx, cy],
      [cx + 1, cy],
      [cx, cy + 1],
    ];
    for (const [sx, sy] of speckles) {
      if (sx < 0 || sx >= TEXTURE_SIZE || sy < 0 || sy >= TEXTURE_SIZE) continue;
      const [r, g, b] = shade(goldColor, (rand() - 0.5) * 20);
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
  return canvas;
}

/** Paints a small stem + petals on an otherwise transparent canvas, for cross-billboard plants. */
function paintFlower(color: [number, number, number]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;

  const stem = BLOCKS[BlockType.LEAVES].color;
  ctx.fillStyle = `rgb(${stem[0]}, ${stem[1]}, ${stem[2]})`;
  ctx.fillRect(7, 8, 2, 8);

  const [r, g, b] = color;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(6, 3, 4, 2);
  ctx.fillRect(5, 5, 2, 3);
  ctx.fillRect(9, 5, 2, 3);
  ctx.fillRect(7, 5, 2, 4);

  ctx.fillStyle = "rgb(255, 221, 92)";
  ctx.fillRect(7, 6, 2, 2);

  return canvas;
}

/** Plain dirt on every side face - only the top face reads as grass. */
function paintGrassSide(): HTMLCanvasElement {
  return paintTexture(BLOCKS[BlockType.DIRT].color, 5, { grain: 18 });
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

function paintDiamondOre(): HTMLCanvasElement {
  const stoneColor = BLOCKS[BlockType.STONE].color;
  const gemColor = BLOCKS[BlockType.DIAMOND].color;
  const canvas = paintTexture(stoneColor, 12, { grain: 20 });
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(120);

  const clusterCount = 4 + Math.floor(rand() * 2);
  for (let c = 0; c < clusterCount; c++) {
    const cx = Math.floor(rand() * TEXTURE_SIZE);
    const cy = Math.floor(rand() * TEXTURE_SIZE);
    const speckles = [
      [cx, cy],
      [cx + 1, cy],
      [cx, cy + 1],
    ];
    for (const [sx, sy] of speckles) {
      if (sx < 0 || sx >= TEXTURE_SIZE || sy < 0 || sy >= TEXTURE_SIZE) continue;
      const [r, g, b] = shade(gemColor, (rand() - 0.5) * 20);
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
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
