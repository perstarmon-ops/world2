## The rules around the player: what you carry, what you can dig and place, what
## the controls are, and whether a save comes back the way it went out.
##
##   godot --headless --path godot --script res://tests/rules_test.gd
##
## None of this draws or reads a device. It drives the same classes the game does,
## with the same numbers, so a broken rule is caught here rather than in front of a
## player holding a controller.
##
## Exits non-zero on failure.
extends SceneTree

const STEP := 1.0 / 60.0
const FLOOR := 10
const SAVE_PATH := "user://rules_test_save.json"

var checks := 0
var failures := 0


func _init() -> void:
	print("— rules checks —")
	_inventory()
	_mining()
	_placing()
	_controls()
	_saves()
	print("%d checks, %d failed" % [checks, failures])
	quit(1 if failures > 0 else 0)


func _ok(what: String, good: bool, detail: String = "") -> void:
	checks += 1
	if good:
		print("  ok    %s" % what)
	else:
		failures += 1
		print("  FAIL  %s  %s" % [what, detail])


func _flat_world() -> VoxelWorld:
	var world := VoxelWorld.new(1)
	var empty := PackedByteArray()
	empty.resize(K.WORLD_SIZE * K.WORLD_HEIGHT * K.WORLD_SIZE)
	world.load_blocks(empty)
	for x in K.WORLD_SIZE:
		for z in K.WORLD_SIZE:
			for y in FLOOR:
				world.set_block(x, y, z, Blocks.STONE)
	return world


func _inventory() -> void:
	var inventory := Inventory.new()
	_ok("the four tools start in the first four slots", inventory.selected_tool() == "pickaxe")
	inventory.add(Blocks.STONE, 2)
	inventory.add(Blocks.DIRT, 1)
	inventory.add(Blocks.STONE, 1)
	_ok("blocks of one kind stack in one slot", inventory.get_slot(4)["count"] == 3, "slot 4: %s" % inventory.get_slot(4))
	_ok("a different block takes the next empty slot", inventory.get_slot(5)["block"] == Blocks.DIRT)
	inventory.select(4)
	_ok("the selected slot can be a block", inventory.selected_block() == Blocks.STONE)
	_ok("consuming one takes one from the stack", inventory.consume_selected() and inventory.get_slot(4)["count"] == 2)
	inventory.select(0)
	_ok("a tool cannot be consumed as a block", not inventory.consume_selected())
	inventory.cycle(-1)
	_ok("the hotbar wraps from the first slot to the last", inventory.selected == K.HOTBAR_SIZE - 1)
	inventory.cycle(1)
	_ok("and wraps back", inventory.selected == 0)
	_ok("a placeable block is not counted as a tool", inventory.selected_tool() == "pickaxe")


func _mining() -> void:
	var world := _flat_world()
	var inventory := Inventory.new()
	var interaction := Interaction.new(world, inventory)
	var origin := Vector3(20.5, 12.0, 20.5)
	var down := Vector3.DOWN
	var mined := false
	var frames := 0
	for i in 240:
		var result := interaction.update(STEP, origin, down, true, false)
		frames += 1
		if result["mined"]:
			mined = true
			break
	_ok("holding mine on a block breaks it", mined, "after %d frames" % frames)
	_ok("the broken block is now air", world.get_block(20, FLOOR - 1, 20) == Blocks.AIR)
	_ok("the broken block goes into the inventory", inventory.get_slot(4) != null and inventory.get_slot(4)["block"] == Blocks.STONE)
	var under := world.get_block(20, FLOOR - 2, 20)
	_ok("the block under it is still there", under == Blocks.STONE)


func _placing() -> void:
	var world := _flat_world()
	var inventory := Inventory.new()
	inventory.add(Blocks.BRICK, 2)
	inventory.select(4)
	var interaction := Interaction.new(world, inventory)
	var player := Player.new(world)
	player.teleport(Vector3(20.5, 15.0, 20.5))
	_ok("placing onto a floor puts a block on top of it", interaction.place(Vector3(20.5, 15.0, 20.5), Vector3.DOWN, player))
	_ok("the new block is where the ray said", world.get_block(20, FLOOR, 20) == Blocks.BRICK)
	_ok("placing uses one from the stack", inventory.get_slot(4)["count"] == 1)

	player.teleport(Vector3(20.5, FLOOR, 20.5))
	_ok("placing into the cell you stand in is refused", not interaction.place(Vector3(20.5, FLOOR + 1.5, 20.5), Vector3.DOWN, player))


func _controls() -> void:
	var bound := true
	for action in Bindings.ACTIONS:
		var control: Dictionary = Bindings.CONTROLS.get(action, {})
		if control.is_empty():
			bound = false
	_ok("every action named in ACTIONS has a control", bound)
	_ok("the pad can jump, dig, place and open the menu", Bindings.CONTROLS["jump"].has("buttons") and Bindings.CONTROLS["mine"].has("axes") and Bindings.CONTROLS["pause"].has("buttons"))


func _saves() -> void:
	var world := VoxelWorld.new(77)
	world.set_block(3, 30, 3, Blocks.GLASS)
	var player := Player.new(world)
	player.teleport(Vector3(5.5, 20.0, 5.5))
	player.yaw = 1.2
	var inventory := Inventory.new()
	inventory.add(Blocks.STONE, 5)
	inventory.select(4)

	_ok("a game writes to a file", Saves.write(SAVE_PATH, world, player, inventory))
	var data := Saves.read(SAVE_PATH)
	_ok("the save remembers its seed", int(data.get("seed", -1)) == 77)

	var again := VoxelWorld.new(int(data["seed"]))
	var back := Player.new(again)
	var bag := Inventory.new()
	_ok("the save loads over a fresh world", Saves.apply(data, again, back, bag))
	_ok("the blocks come back exactly", again.blocks_snapshot() == world.blocks_snapshot())
	_ok("the player comes back where they were", back.position.distance_to(player.position) < 0.001, "at %s" % back.position)
	_ok("the view comes back facing the same way", absf(back.yaw - 1.2) < 0.001)
	_ok("the stack comes back, and is still selected", bag.selected_block() == Blocks.STONE and bag.get_slot(4)["count"] == 5)

	_ok("a missing save reads as nothing", Saves.read("user://no_such_save.json").is_empty())
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	file.store_string("this is not json")
	file.close()
	_ok("a damaged save reads as nothing, not a crash", Saves.read(SAVE_PATH).is_empty())
	DirAccess.remove_absolute(SAVE_PATH)
