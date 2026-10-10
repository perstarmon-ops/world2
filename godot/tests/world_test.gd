## The world, measured.
##
##   godot --headless --path godot --script res://tests/world_test.gd
##
## Checks that a seed always makes the same world, that the land is where a player
## can stand, that every feature the generator promises actually appears, that
## blocks change through the one door they are supposed to, and that the mesher
## emits triangles facing the way Godot draws them. A mesh whose faces wind the
## wrong way is invisible from the front and looks fine from inside, so a screenshot
## can miss it. This does not.
##
## Exits non-zero on failure.
extends SceneTree

var checks := 0
var failures := 0


func _init() -> void:
	print("— world checks —")
	_determinism()
	_spawn()
	_features()
	_editing()
	_raycast()
	_mesh_winding()
	print("%d checks, %d failed" % [checks, failures])
	quit(1 if failures > 0 else 0)


func _ok(what: String, good: bool, detail: String = "") -> void:
	checks += 1
	if good:
		print("  ok    %s" % what)
	else:
		failures += 1
		print("  FAIL  %s  %s" % [what, detail])


func _determinism() -> void:
	var a := VoxelWorld.new(42)
	var b := VoxelWorld.new(42)
	_ok("the same seed makes the same blocks", a.blocks_snapshot() == b.blocks_snapshot())
	var c := VoxelWorld.new(43)
	_ok("a different seed makes a different world", a.blocks_snapshot() != c.blocks_snapshot())


func _spawn() -> void:
	var world := VoxelWorld.new(1337)
	var spawn := world.spawn_position()
	_ok("spawn is on dry land, above sea level", spawn.y > K.SEA_LEVEL, "y=%s" % spawn.y)
	var floor_id := world.get_block(floori(spawn.x), floori(spawn.y) - 1, floori(spawn.z))
	_ok("spawn stands on a solid block", Blocks.is_solid(floor_id), "floor is %s" % Blocks.name_of(floor_id))
	_ok("spawn is inside the map", world.in_bounds(floori(spawn.x), 0, floori(spawn.z)))


func _features() -> void:
	var world := VoxelWorld.new(1337)
	var counts := {}
	for id in world.blocks_snapshot():
		counts[id] = counts.get(id, 0) + 1
	for id in [Blocks.GRASS, Blocks.DIRT, Blocks.STONE, Blocks.WATER, Blocks.SAND, Blocks.WOOD, Blocks.LEAVES, Blocks.PATH, Blocks.PLANK, Blocks.BRICK, Blocks.GLASS, Blocks.DOOR]:
		_ok("the world contains %s" % Blocks.name_of(id), counts.get(id, 0) > 0)
	_ok("the world contains a flower", counts.get(Blocks.FLOWER_RED, 0) + counts.get(Blocks.FLOWER_YELLOW, 0) > 0)
	var caves := 0
	for x in K.WORLD_SIZE:
		for z in K.WORLD_SIZE:
			if world.height_at(x, z) < VoxelWorld.CAVE_MIN_SURFACE_HEIGHT:
				continue
			for y in range(VoxelWorld.CAVE_MIN_Y, world.height_at(x, z) - VoxelWorld.CAVE_SURFACE_BUFFER):
				if world.get_block(x, y, z) == Blocks.AIR:
					caves += 1
	_ok("the stone is carved by caves", caves > 0, "carved cells: %d" % caves)


func _editing() -> void:
	var world := VoxelWorld.new(7)
	var heard := [0]
	world.block_changed.connect(func(_x: int, _y: int, _z: int) -> void: heard[0] += 1)
	world.set_block(5, 30, 5, Blocks.GLASS)
	_ok("set_block changes the block", world.get_block(5, 30, 5) == Blocks.GLASS)
	_ok("set_block announces the change", heard[0] == 1, "announced %d times" % heard[0])
	_ok("set_block outside the map is refused", not world.set_block(-1, 0, 0, Blocks.STONE))
	_ok("get_block outside the map is air", world.get_block(-1, 0, 0) == Blocks.AIR)


func _raycast() -> void:
	var world := VoxelWorld.new(7)
	for z in range(4, 12):
		world.set_block(10, 40, z, Blocks.AIR)
	world.set_block(10, 40, 10, Blocks.STONE)
	var hit := Interaction.raycast(world, Vector3(10.5, 40.5, 4.5), Vector3(0, 0, 1), 10.0)
	_ok("a ray hits the first solid block on its line", hit.get("block") == Vector3i(10, 40, 10), "got %s" % hit)
	_ok("the cell in front of the hit face is the one a block goes into", hit.get("before") == Vector3i(10, 40, 9), "got %s" % hit)
	var miss := Interaction.raycast(world, Vector3(10.5, 40.5, 4.5), Vector3(0, 0, -1), 10.0)
	_ok("a ray that finds nothing solid returns nothing", miss.is_empty())


## Every solid face must be front-facing: its triangles wind clockwise as Godot
## reads them, so the cross product points against the face normal.
func _mesh_winding() -> void:
	var world := VoxelWorld.new(1337)
	var root := Node3D.new()
	get_root().add_child(root)
	var mesher := ChunkMesher.new(world, root)
	mesher.build_all()

	var triangles := 0
	var backwards := 0
	for instance in root.get_children():
		var mesh: ArrayMesh = instance.mesh
		var arrays := mesh.surface_get_arrays(0) if mesh.get_surface_count() > 0 else []
		if arrays.is_empty():
			continue
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		for i in range(0, verts.size(), 3):
			var winding := (verts[i + 1] - verts[i]).cross(verts[i + 2] - verts[i])
			triangles += 1
			if winding.dot(normals[i]) >= 0.0:
				backwards += 1
	_ok("the mesher emits triangles", triangles > 1000, "triangles: %d" % triangles)
	_ok("every solid triangle faces its normal", backwards == 0, "%d of %d wind backwards" % [backwards, triangles])
	# Torn down in order, while the renderer still runs: a mesh is detached from its
	# node before the node is freed. Left to the engine's shutdown, a mesh still on
	# a node is freed after the renderer that owns it, and the dummy renderer says so.
	mesher.release()
	for instance in root.get_children():
		root.remove_child(instance)
		instance.free()
	root.free()
	mesher = null
