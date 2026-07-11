import { Inventory, SlotContent } from "./Inventory";
import { Player } from "./Player";
import { World } from "./World";

const SAVE_KEY = "voxelcraft-save-v1";

export interface SaveData {
  mode: "survival" | "creative";
  dimension: "overworld" | "nether";
  player: { x: number; y: number; z: number; health: number; hunger: number };
  inventory: SlotContent[];
  overworldBlocks: string;
  netherBlocks: string;
}

function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame(
  mode: "survival" | "creative",
  dimension: "overworld" | "nether",
  player: Player,
  inventory: Inventory,
  overworld: World,
  nether: World,
): void {
  const data: SaveData = {
    mode,
    dimension,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      health: player.getHealth(),
      hunger: player.getHunger(),
    },
    inventory: inventory.getSlotsSnapshot(),
    overworldBlocks: toBase64(overworld.getBlocksSnapshot()),
    netherBlocks: toBase64(nether.getBlocksSnapshot()),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

/** Returns the saved game, or null if there is none (or it's unreadable). */
export function loadGame(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

/** Restores world blocks, inventory, and player position/vitals from a save. Caller is responsible for dimension/mesh/UI bookkeeping. */
export function applySave(
  data: SaveData,
  player: Player,
  inventory: Inventory,
  overworld: World,
  nether: World,
): void {
  overworld.loadBlocksSnapshot(fromBase64(data.overworldBlocks));
  nether.loadBlocksSnapshot(fromBase64(data.netherBlocks));
  inventory.loadSlotsSnapshot(data.inventory);
  inventory.setCreativeMode(data.mode === "creative");
  player.teleportTo(data.player.x, data.player.y, data.player.z);
  player.setVitals(data.player.health, data.player.hunger);
}
