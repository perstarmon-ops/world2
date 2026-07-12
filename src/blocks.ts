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
  MEAT = 11,
  DIAMOND_ORE = 12,
  DIAMOND = 13,
  FLOWER_RED = 14,
  FLOWER_YELLOW = 15,
  GOLD_ORE = 16,
  GOLD = 17,
  WOOL = 18,
  PATH = 19,
  DOOR_CLOSED = 20,
  DOOR_OPEN = 21,
  OBSIDIAN = 22,
  PORTAL = 23,
  NETHERRACK = 24,
  MUSHROOM_STEM = 25,
  MUSHROOM_CAP = 26,
  FIRE = 27,
  BED = 28,
  COBBLESTONE = 29,
  SANDSTONE = 30,
  RED_WOOL = 31,
  YELLOW_WOOL = 32,
  BOAT = 33,
  FURNACE = 34,
  COOKED_MEAT = 35,
}

export interface BlockInfo {
  name: string;
  /** Base RGB color used to procedurally generate the block's texture. */
  color: [number, number, number];
  solid: boolean;
  transparent: boolean;
  /** Whether the player can place this block from the hotbar. */
  placeable: boolean;
  /** Whether the player can mine this block out at all. */
  breakable: boolean;
  /** Seconds of continuous mining (with the pickaxe) needed to break this block. */
  hardness: number;
  /** Renders as a thin cross-shaped billboard plant instead of a solid cube. */
  renderAsCross?: boolean;
}

export const BLOCKS: Record<BlockType, BlockInfo> = {
  [BlockType.AIR]: { name: "Air", color: [0, 0, 0], solid: false, transparent: true, placeable: false, breakable: false, hardness: 0 },
  [BlockType.GRASS]: { name: "Grass", color: [95, 159, 53], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.5 },
  [BlockType.DIRT]: { name: "Dirt", color: [121, 85, 58], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.4 },
  [BlockType.STONE]: { name: "Stone", color: [130, 130, 130], solid: true, transparent: false, placeable: true, breakable: true, hardness: 1.1 },
  [BlockType.SAND]: { name: "Sand", color: [219, 206, 148], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.4 },
  [BlockType.WOOD]: { name: "Wood", color: [107, 79, 49], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.75 },
  [BlockType.LEAVES]: { name: "Leaves", color: [62, 122, 51], solid: true, transparent: true, placeable: true, breakable: true, hardness: 0.25 },
  [BlockType.WATER]: { name: "Water", color: [64, 105, 224], solid: false, transparent: true, placeable: false, breakable: false, hardness: 0 },
  [BlockType.PLANK]: { name: "Plank", color: [172, 134, 84], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.6 },
  [BlockType.GLASS]: { name: "Glass", color: [210, 235, 240], solid: true, transparent: true, placeable: true, breakable: true, hardness: 0.35 },
  [BlockType.BRICK]: { name: "Brick", color: [150, 78, 61], solid: true, transparent: false, placeable: true, breakable: true, hardness: 1.0 },
  [BlockType.MEAT]: { name: "Meat", color: [186, 92, 84], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.3 },
  [BlockType.DIAMOND_ORE]: { name: "Diamond Ore", color: [120, 122, 126], solid: true, transparent: false, placeable: false, breakable: true, hardness: 1.4 },
  [BlockType.DIAMOND]: { name: "Diamond", color: [110, 226, 220], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.5 },
  [BlockType.FLOWER_RED]: { name: "Red Flower", color: [206, 48, 48], solid: false, transparent: true, placeable: true, breakable: true, hardness: 0.1, renderAsCross: true },
  [BlockType.FLOWER_YELLOW]: { name: "Yellow Flower", color: [227, 201, 42], solid: false, transparent: true, placeable: true, breakable: true, hardness: 0.1, renderAsCross: true },
  [BlockType.GOLD_ORE]: { name: "Gold Ore", color: [188, 168, 110], solid: true, transparent: false, placeable: false, breakable: true, hardness: 1.2 },
  [BlockType.GOLD]: { name: "Gold", color: [244, 202, 66], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.5 },
  [BlockType.WOOL]: { name: "Wool", color: [235, 232, 224], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.3 },
  [BlockType.PATH]: { name: "Path", color: [176, 150, 105], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.4 },
  [BlockType.DOOR_CLOSED]: { name: "Door", color: [140, 104, 66], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.6 },
  [BlockType.DOOR_OPEN]: { name: "Door (Open)", color: [140, 104, 66], solid: false, transparent: true, placeable: false, breakable: true, hardness: 0.6 },
  [BlockType.OBSIDIAN]: { name: "Obsidian", color: [38, 20, 54], solid: true, transparent: false, placeable: true, breakable: true, hardness: 3.0 },
  [BlockType.PORTAL]: { name: "Portal", color: [160, 62, 224], solid: false, transparent: true, placeable: false, breakable: false, hardness: 0 },
  [BlockType.NETHERRACK]: { name: "Netherrack", color: [111, 46, 40], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.9 },
  [BlockType.MUSHROOM_STEM]: { name: "Mushroom Stem", color: [178, 32, 32], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.5 },
  [BlockType.MUSHROOM_CAP]: { name: "Red Mushroom Cap", color: [178, 32, 32], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.5 },
  [BlockType.FIRE]: { name: "Fire", color: [230, 120, 30], solid: false, transparent: true, placeable: true, breakable: true, hardness: 0.1, renderAsCross: true },
  // Never actually becomes a world block - placing it spawns a two-block-long Bed entity instead (see Interaction.place).
  [BlockType.BED]: { name: "Bed", color: [188, 54, 54], solid: false, transparent: false, placeable: true, breakable: false, hardness: 0 },
  [BlockType.COBBLESTONE]: { name: "Cobblestone", color: [116, 116, 112], solid: true, transparent: false, placeable: true, breakable: true, hardness: 1.1 },
  [BlockType.SANDSTONE]: { name: "Sandstone", color: [223, 210, 165], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.9 },
  [BlockType.RED_WOOL]: { name: "Red Wool", color: [200, 52, 48], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.3 },
  [BlockType.YELLOW_WOOL]: { name: "Yellow Wool", color: [222, 195, 56], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.3 },
  // Never actually becomes a world block - placing it spawns a rideable Boat entity instead (see Interaction.place).
  [BlockType.BOAT]: { name: "Boat", color: [140, 96, 55], solid: false, transparent: false, placeable: true, breakable: false, hardness: 0 },
  [BlockType.FURNACE]: { name: "Furnace", color: [96, 96, 92], solid: true, transparent: false, placeable: true, breakable: true, hardness: 1.4 },
  [BlockType.COOKED_MEAT]: { name: "Cooked Meat", color: [122, 66, 46], solid: true, transparent: false, placeable: true, breakable: true, hardness: 0.3 },
};
