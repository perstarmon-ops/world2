export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WOOD = 5,
  LEAVES = 6,
  WATER = 7,
  PLANK = 8,
  GLASS = 9,
  BRICK = 10,
}

export interface BlockInfo {
  name: string;
  /** Base RGB color used to procedurally generate the block's texture. */
  color: [number, number, number];
  solid: boolean;
  transparent: boolean;
  /** Whether the player can place this block from the hotbar. */
  placeable: boolean;
}

export const BLOCKS: Record<BlockType, BlockInfo> = {
  [BlockType.AIR]: { name: "Air", color: [0, 0, 0], solid: false, transparent: true, placeable: false },
  [BlockType.GRASS]: { name: "Grass", color: [95, 159, 53], solid: true, transparent: false, placeable: true },
  [BlockType.DIRT]: { name: "Dirt", color: [121, 85, 58], solid: true, transparent: false, placeable: true },
  [BlockType.STONE]: { name: "Stone", color: [130, 130, 130], solid: true, transparent: false, placeable: true },
  [BlockType.SAND]: { name: "Sand", color: [219, 206, 148], solid: true, transparent: false, placeable: true },
  [BlockType.WOOD]: { name: "Wood", color: [107, 79, 49], solid: true, transparent: false, placeable: true },
  [BlockType.LEAVES]: { name: "Leaves", color: [62, 122, 51], solid: true, transparent: true, placeable: true },
  [BlockType.WATER]: { name: "Water", color: [64, 105, 224], solid: false, transparent: true, placeable: false },
  [BlockType.PLANK]: { name: "Plank", color: [172, 134, 84], solid: true, transparent: false, placeable: true },
  [BlockType.GLASS]: { name: "Glass", color: [210, 235, 240], solid: true, transparent: true, placeable: true },
  [BlockType.BRICK]: { name: "Brick", color: [150, 78, 61], solid: true, transparent: false, placeable: true },
};

/** Blocks the player can select in the hotbar, in slot order. */
export const HOTBAR_BLOCKS: BlockType[] = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.SAND,
  BlockType.WOOD,
  BlockType.PLANK,
  BlockType.LEAVES,
  BlockType.GLASS,
  BlockType.BRICK,
];
