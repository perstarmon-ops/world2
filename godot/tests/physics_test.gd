## The movement, measured.
##
##   godot --headless --path godot --script res://tests/physics_test.gd
##
## Every number here is a measurement rather than an opinion. The simulation is a
## fixed step with no renderer attached, so a jump is either 1.45 blocks tall or it
## is not, and a constant changed in constants.gd fails here on the commit rather
## than in a player's hands.
##
## The checks that matter most are the ones that pin the collision: a body that
## walks into a wall must stop at the wall, and one that meets a single block must
## step up onto it rather than stopping dead.
##
## Exits non-zero on failure.
extends SceneTree

const STEP := 1.0 / 60.0
const FLOOR := 10

var checks := 0
var failures := 0


func _init() -> void:
	print("— movement checks —")
	_landing()
	_jump()
	_walls()
	_step_up()
	_occupancy()
	print("%d checks, %d failed" % [checks, failures])
	quit(1 if failures > 0 else 0)


func _ok(what: String, good: bool, detail: String = "") -> void:
	checks += 1
	if good:
		print("  ok    %s" % what)
	else:
		failures += 1
		print("  FAIL  %s  %s" % [what, detail])


## A world that is solid stone below FLOOR and air above it, so every check here
## stands on a surface it knows the height of.
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


func _run(player: Player, seconds: float, intent: Dictionary) -> void:
	for i in roundi(seconds / STEP):
		player.step(STEP, intent)


func _landing() -> void:
	var world := _flat_world()
	var player := Player.new(world)
	player.teleport(Vector3(20.5, 25.0, 20.5))
	_run(player, 2.0, {})
	_ok("a body dropped from the sky lands on the floor", absf(player.position.y - FLOOR) < 0.001, "y=%f" % player.position.y)
	_ok("a body that has landed is on the ground", player.on_ground)


func _jump() -> void:
	var world := _flat_world()
	var player := Player.new(world)
	player.teleport(Vector3(20.5, FLOOR, 20.5))
	_run(player, 0.2, {})
	var peak := player.position.y
	player.step(STEP, {"jump": true})
	for i in 120:
		player.step(STEP, {})
		peak = maxf(peak, player.position.y)
	var expected := K.JUMP_SPEED * K.JUMP_SPEED / (2.0 * K.GRAVITY)
	var height := peak - FLOOR
	_ok("a tapped jump clears about 1.45 blocks", absf(height - expected) < 0.02, "measured %.3f, expected %.3f" % [height, expected])
	_ok("the body lands again after a jump", player.on_ground and absf(player.position.y - FLOOR) < 0.001)


func _walls() -> void:
	var world := _flat_world()
	for y in range(FLOOR, FLOOR + 3):
		world.set_block(25, y, 20, Blocks.STONE)
	var player := Player.new(world)
	player.teleport(Vector3(20.5, FLOOR, 20.5))
	_run(player, 0.2, {})
	_run(player, 3.0, {"move": Vector2(1, 0)})
	_ok("a body walking into a wall stops at the wall", player.position.x + K.PLAYER_RADIUS <= 25.001, "x=%f" % player.position.x)
	_ok("and it does not stop short of it", player.position.x > 24.0, "x=%f" % player.position.x)


func _step_up() -> void:
	var world := _flat_world()
	world.set_block(25, FLOOR, 20, Blocks.STONE)
	var player := Player.new(world)
	player.teleport(Vector3(20.5, FLOOR, 20.5))
	_run(player, 0.2, {})
	var top_while_crossing := 0.0
	for i in roundi(2.5 / STEP):
		player.step(STEP, {"move": Vector2(1, 0)})
		if player.position.x > 24.5 and player.position.x < 26.5:
			top_while_crossing = maxf(top_while_crossing, player.position.y)
	_ok("a body meets a single block and steps up onto it", absf(top_while_crossing - (FLOOR + K.STEP_HEIGHT)) < 0.01, "highest while crossing %f" % top_while_crossing)
	_ok("and it carries on past the block", player.position.x > 27.0 and absf(player.position.y - FLOOR) < 0.001, "x=%f y=%f" % [player.position.x, player.position.y])


func _occupancy() -> void:
	var world := _flat_world()
	var player := Player.new(world)
	player.teleport(Vector3(20.5, FLOOR, 20.5))
	_run(player, 0.2, {})
	_ok("a body occupies the cell it stands in", player.occupies(Vector3i(20, FLOOR, 20)))
	_ok("a body does not occupy a cell two over", not player.occupies(Vector3i(22, FLOOR, 20)))
	_ok("a body does not occupy the floor it stands on", not player.occupies(Vector3i(20, FLOOR - 1, 20)))
