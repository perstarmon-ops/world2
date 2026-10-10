## What each block is: its name, its colour, and what it does to the rules.
##
## The ids are the web game's BlockType numbers for every block this port knows
## about, so a block means the same thing in both. Blocks the port has not brought
## over (animals' meat, chests, the nether) are left out rather than reserved as
## placeholders, so nothing here refers to a thing that does not exist yet.
##
## Nothing in here draws. Colours are data the mesher reads; the rules read the
## flags.
class_name Blocks
extends RefCounted

enum {
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
	DIAMOND_ORE = 12,
	DIAMOND = 13,
	FLOWER_RED = 14,
	FLOWER_YELLOW = 15,
	GOLD_ORE = 16,
	GOLD = 17,
	WOOL = 18,
	PATH = 19,
	DOOR = 20,
	COBBLESTONE = 29,
	SANDSTONE = 30,
	RED_WOOL = 31,
	YELLOW_WOOL = 32,
}

## solid: the player collides with it. transparent: light and sight pass through,
## so a face next to it is still drawn. A solid, opaque neighbour is the only thing
## that hides a face. placeable: it can come out of the hotbar. hardness: seconds
## of mining at speed 1. cross: a plant, drawn as two crossed quads. drop: what
## mining it gives you, when that is not the block itself.
const INFO := {
	AIR: {"name": "Air", "rgb": [0, 0, 0], "solid": false, "transparent": true, "placeable": false, "breakable": false, "hardness": 0.0},
	GRASS: {"name": "Grass", "rgb": [95, 159, 53], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.5},
	DIRT: {"name": "Dirt", "rgb": [121, 85, 58], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.4},
	STONE: {"name": "Stone", "rgb": [130, 130, 130], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 1.1},
	SAND: {"name": "Sand", "rgb": [219, 206, 148], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.4},
	WOOD: {"name": "Wood", "rgb": [107, 79, 49], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.75},
	LEAVES: {"name": "Leaves", "rgb": [62, 122, 51], "solid": true, "transparent": true, "placeable": true, "breakable": true, "hardness": 0.25},
	WATER: {"name": "Water", "rgb": [64, 105, 224], "solid": false, "transparent": true, "placeable": false, "breakable": false, "hardness": 0.0},
	PLANK: {"name": "Plank", "rgb": [172, 134, 84], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.6},
	GLASS: {"name": "Glass", "rgb": [210, 235, 240], "solid": true, "transparent": true, "placeable": true, "breakable": true, "hardness": 0.35},
	BRICK: {"name": "Brick", "rgb": [150, 78, 61], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 1.0},
	DIAMOND_ORE: {"name": "Diamond Ore", "rgb": [120, 122, 126], "solid": true, "transparent": false, "placeable": false, "breakable": true, "hardness": 1.4, "drop": DIAMOND},
	DIAMOND: {"name": "Diamond", "rgb": [110, 226, 220], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.5},
	FLOWER_RED: {"name": "Red Flower", "rgb": [206, 48, 48], "solid": false, "transparent": true, "placeable": true, "breakable": true, "hardness": 0.1, "cross": true},
	FLOWER_YELLOW: {"name": "Yellow Flower", "rgb": [227, 201, 42], "solid": false, "transparent": true, "placeable": true, "breakable": true, "hardness": 0.1, "cross": true},
	GOLD_ORE: {"name": "Gold Ore", "rgb": [188, 168, 110], "solid": true, "transparent": false, "placeable": false, "breakable": true, "hardness": 1.2, "drop": GOLD},
	GOLD: {"name": "Gold", "rgb": [244, 202, 66], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.5},
	WOOL: {"name": "Wool", "rgb": [235, 232, 224], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.3},
	PATH: {"name": "Path", "rgb": [176, 150, 105], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.4},
	DOOR: {"name": "Door", "rgb": [140, 104, 66], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.6},
	COBBLESTONE: {"name": "Cobblestone", "rgb": [116, 116, 112], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 1.1},
	SANDSTONE: {"name": "Sandstone", "rgb": [223, 210, 165], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.9},
	RED_WOOL: {"name": "Red Wool", "rgb": [200, 52, 48], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.3},
	YELLOW_WOOL: {"name": "Yellow Wool", "rgb": [222, 195, 56], "solid": true, "transparent": false, "placeable": true, "breakable": true, "hardness": 0.3},
}

## Which tool mines which block at the bonus speed. The shovel's list is short on
## purpose: it is for dirt, not for digging the world apart.
const TOOL_BONUS := {
	"pickaxe": [STONE, DIAMOND_ORE, GOLD_ORE, COBBLESTONE],
	"axe": [WOOD, LEAVES, DOOR],
	"shovel": [DIRT],
	"sword": [],
}

static func info(id: int) -> Dictionary:
	return INFO.get(id, INFO[AIR])

static func name_of(id: int) -> String:
	return info(id)["name"]

static func is_solid(id: int) -> bool:
	return info(id)["solid"]

## Whether a face of a neighbour of this block is hidden by it: a solid block that
## light cannot pass through. Glass and leaves do not hide the faces beside them.
static func occludes(id: int) -> bool:
	var block := info(id)
	return block["solid"] and not block["transparent"]

static func is_cross(id: int) -> bool:
	return info(id).get("cross", false)

static func is_placeable(id: int) -> bool:
	return info(id)["placeable"]

static func is_breakable(id: int) -> bool:
	return info(id)["breakable"]

static func hardness(id: int) -> float:
	return info(id)["hardness"]

## What you get for breaking this block. Ore gives the gem, everything else gives
## itself.
static func drop_of(id: int) -> int:
	return info(id).get("drop", id)

static func color(id: int) -> Color:
	var rgb: Array = info(id)["rgb"]
	return Color(rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0)

static func tool_bonus(tool: String, id: int) -> bool:
	return TOOL_BONUS.get(tool, []).has(id)
