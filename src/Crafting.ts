import { BlockType } from "./blocks";

export interface Recipe {
  input: BlockType;
  inputCount: number;
  output: BlockType;
  outputCount: number;
}

/** Turns raw-material blocks into the processed decorative blocks otherwise only found by demolishing village houses. */
export const RECIPES: Recipe[] = [
  { input: BlockType.WOOD, inputCount: 1, output: BlockType.PLANK, outputCount: 4 },
  { input: BlockType.STONE, inputCount: 4, output: BlockType.BRICK, outputCount: 4 },
  { input: BlockType.SAND, inputCount: 4, output: BlockType.GLASS, outputCount: 4 },
];
