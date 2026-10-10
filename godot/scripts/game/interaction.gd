## Where the player is pointing, and what that does: mining and placing.
##
## The target is found by walking the view ray through the block grid one cell at
## a time, so the block you aim at is exactly the first solid cell on that line.
## Water is passed through, so you can dig from inside a lake and aim at what is
## under it.
##
## Mining is a timer that runs only while the button is held on the same block. Let
## go, or look away, and the progress is lost, as it is in the web game. Placing is
## a single press, and it refuses a cell you are standing in.
class_name Interaction
extends RefCounted

var world: VoxelWorld
var inventory: Inventory

var _target := Vector3i(0, -1, 0)
var _progress := 0.0


func _init(p_world: VoxelWorld, p_inventory: Inventory) -> void:
	world = p_world
	inventory = p_inventory


## Walks the ray from `origin` along `direction` for up to `max_distance`. Returns
## {"block": the solid cell hit, "before": the empty cell in front of that face}, or
## an empty dictionary if the ray reaches nothing solid.
static func raycast(world: VoxelWorld, origin: Vector3, direction: Vector3, max_distance: float) -> Dictionary:
	var x := floori(origin.x)
	var y := floori(origin.y)
	var z := floori(origin.z)
	var step := Vector3i(int(sign(direction.x)), int(sign(direction.y)), int(sign(direction.z)))
	var t_delta := Vector3(
		absf(1.0 / direction.x) if direction.x != 0.0 else INF,
		absf(1.0 / direction.y) if direction.y != 0.0 else INF,
		absf(1.0 / direction.z) if direction.z != 0.0 else INF,
	)
	var t_max := Vector3(
		_first_crossing(origin.x, x, step.x) * t_delta.x,
		_first_crossing(origin.y, y, step.y) * t_delta.y,
		_first_crossing(origin.z, z, step.z) * t_delta.z,
	)
	var normal := Vector3i.ZERO
	var travelled := 0.0
	while travelled <= max_distance:
		var id := world.get_block(x, y, z)
		if id != Blocks.AIR and id != Blocks.WATER:
			return {"block": Vector3i(x, y, z), "before": Vector3i(x, y, z) + normal}
		if t_max.x < t_max.y and t_max.x < t_max.z:
			travelled = t_max.x
			t_max.x += t_delta.x
			x += step.x
			normal = Vector3i(-step.x, 0, 0)
		elif t_max.y < t_max.z:
			travelled = t_max.y
			t_max.y += t_delta.y
			y += step.y
			normal = Vector3i(0, -step.y, 0)
		else:
			travelled = t_max.z
			t_max.z += t_delta.z
			z += step.z
			normal = Vector3i(0, 0, -step.z)
	return {}


## Distance along a ray, in units of its direction, to the first boundary on one
## axis. A ray that does not move on this axis never reaches one.
static func _first_crossing(origin: float, cell: int, step: int) -> float:
	if step > 0:
		return cell + 1 - origin
	if step < 0:
		return origin - cell
	return INF


## Advances mining by one frame. Returns {"target": the cell under the crosshair or
## null, "progress": 0 to 1 while mining, "mined": true on the frame a block breaks}.
func update(dt: float, origin: Vector3, direction: Vector3, mine_held: bool, in_water: bool) -> Dictionary:
	var hit := raycast(world, origin, direction, K.REACH)
	var result := {"target": null, "progress": 0.0, "mined": false}
	if hit.is_empty():
		_reset()
		return result
	result["target"] = hit["block"]

	var cell: Vector3i = hit["block"]
	var id := world.get_block(cell.x, cell.y, cell.z)
	var tool := inventory.selected_tool()
	if not mine_held or tool == "sword" or not Blocks.is_breakable(id):
		_reset()
		return result

	if cell != _target:
		_target = cell
		_progress = 0.0

	var speed := K.WATER_MINING_SPEED if in_water else 1.0
	if tool == "":
		speed *= K.HAND_MINING_SPEED
	elif Blocks.tool_bonus(tool, id):
		speed *= K.TOOL_BONUS_SPEED
	_progress += dt * speed

	var hardness := Blocks.hardness(id)
	if _progress >= hardness:
		world.set_block(cell.x, cell.y, cell.z, Blocks.AIR)
		inventory.add(Blocks.drop_of(id))
		_reset()
		result["mined"] = true
		return result

	result["progress"] = _progress / hardness
	return result


## Puts the selected block into the empty cell in front of the target. Returns false
## if there is nothing to place, nothing to aim at, the cell is not empty, or the
## player is standing in it.
func place(origin: Vector3, direction: Vector3, player: Player) -> bool:
	var hit := raycast(world, origin, direction, K.REACH)
	if hit.is_empty():
		return false
	var block := inventory.selected_block()
	if block < 0:
		return false
	var before: Vector3i = hit["before"]
	var there := world.get_block(before.x, before.y, before.z)
	if there != Blocks.AIR and there != Blocks.WATER:
		return false
	if player.occupies(before):
		return false
	if not inventory.consume_selected():
		return false
	world.set_block(before.x, before.y, before.z, block)
	return true


## Forgets whatever block was being mined. Called when the game pauses, so a
## resumed game does not finish a dig that was interrupted.
func cancel_mining() -> void:
	_reset()


func _reset() -> void:
	_target = Vector3i(0, -1, 0)
	_progress = 0.0
