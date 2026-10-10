## Saving the world, and loading it back.
##
## One JSON file. The blocks are the only large part, and they are base64 of the
## raw bytes, so a save is a little larger than the world but reads and writes in a
## single pass. The seed is kept too, so a load rebuilds the same terrain shape
## before the saved blocks are laid over it.
##
## Paths are arguments rather than constants, so a test can write somewhere scratch
## and never over a real save.
class_name Saves
extends RefCounted

const PATH := "user://save.json"
const VERSION := 1


static func exists(path: String = PATH) -> bool:
	return FileAccess.file_exists(path)


## Writes the game to `path`. Returns false if the file could not be opened.
static func write(path: String, world: VoxelWorld, player: Player, inventory: Inventory) -> bool:
	var data := {
		"version": VERSION,
		"seed": world.seed_value,
		"player": {"x": player.position.x, "y": player.position.y, "z": player.position.z, "yaw": player.yaw},
		"selected": inventory.selected,
		"inventory": inventory.snapshot(),
		"blocks": Marshalls.raw_to_base64(world.blocks_snapshot()),
	}
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(data))
	return true


## Reads the save at `path`. Returns an empty dictionary if there is none, or it is
## not a readable save, so a damaged file starts a new game rather than crashing.
static func read(path: String = PATH) -> Dictionary:
	if not exists(path):
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary and parsed.has("blocks"):
		return parsed
	return {}


## Lays a read save over a world, player and inventory. The world must already have
## been built from the saved seed. Returns false, and changes nothing, if the blocks
## do not fit.
static func apply(data: Dictionary, world: VoxelWorld, player: Player, inventory: Inventory) -> bool:
	if not world.load_blocks(Marshalls.base64_to_raw(data["blocks"])):
		return false
	inventory.restore(data.get("inventory", []))
	inventory.select(int(data.get("selected", 0)))
	var at: Dictionary = data.get("player", {})
	player.teleport(Vector3(float(at.get("x", 0.0)), float(at.get("y", 0.0)), float(at.get("z", 0.0))))
	player.yaw = float(at.get("yaw", 0.0))
	return true
