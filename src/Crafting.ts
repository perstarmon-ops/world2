import { BlockType } from "./blocks";

export interface RecipeInput {
  block: BlockType;
  count: number;
}

export interface Recipe {
  inputs: RecipeInput[];
  output: BlockType;
  outputCount: number;
}

/** Turns raw-material blocks into the processed decorative blocks otherwise only found by demolishing village houses, plus a few multi-ingredient items. */
export const RECIPES: Recipe[] = [
  { inputs: [{ block: BlockType.WOOD, count: 1 }], output: BlockType.PLANK, outputCount: 4 },
  { inputs: [{ block: BlockType.STONE, count: 4 }], output: BlockType.BRICK, outputCount: 4 },
  { inputs: [{ block: BlockType.SAND, count: 4 }], output: BlockType.GLASS, outputCount: 4 },
  {
    inputs: [
      { block: BlockType.WOOL, count: 3 },
      { block: BlockType.PLANK, count: 3 },
    ],
    output: BlockType.BED,
    outputCount: 1,
  },
  { inputs: [{ block: BlockType.PLANK, count: 3 }], output: BlockType.DOOR_CLOSED, outputCount: 1 },
];
