## The voxel world: block storage, and the terrain it starts from.
##
## It holds block ids and nothing else. There are no meshes in here, no input and
## no clock. The mesher reads it and the rules read it, and a change is announced
## with a signal rather than by the world knowing who is listening.
##
## Generation follows the web game's order and its numbers: a terrain height from
## two octaves of noise, stone and ore below it, caves carved through the stone,
## then trees, flowers and a small village of houses joined by paths. The noise is
## Godot's own, so the land has the same shape as the web game's without being the
## same land.
class_name VoxelWorld
extends RefCounted

## Emitted for every block that changes, so the mesher knows which chunk to redraw.
signal block_changed(x: int, y: int, z: int)

const TERRAIN_HEIGHT_BIAS := 8
const DIAMOND_MAX_Y := 14
const DIAMOND_CHANCE := 0.0015
const GOLD_MAX_Y := 22
const GOLD_CHANCE := 0.0025
const CAVE_MIN_Y := 3
## Caves stay this far below the surface, so they never undermine the village.
const CAVE_SURFACE_BUFFER := 5
## Only columns this tall are cave-eligible: sea level plus three.
const CAVE_MIN_SURFACE_HEIGHT := 20
const CAVE_ENTRANCE_CHANCE := 0.06
const CAVE_SCALE_XZ := 0.09
const CAVE_SCALE_Y := 0.12
## Higher means thinner, sparser tunnels.
const CAVE_THRESHOLD := 0.62

var seed_value: int
var _blocks := PackedByteArray()
var _heights := PackedInt32Array()


func _init(world_seed: int = K.DEFAULT_SEED) -> void:
	seed_value = world_seed
	_blocks.resize(K.WORLD_SIZE * K.WORLD_HEIGHT * K.WORLD_SIZE)
	_heights.resize(K.WORLD_SIZE * K.WORLD_SIZE)
	_generate_overworld()


func _index(x: int, y: int, z: int) -> int:
	return (y * K.WORLD_SIZE + z) * K.WORLD_SIZE + x


func in_bounds(x: int, y: int, z: int) -> bool:
	return x >= 0 and x < K.WORLD_SIZE and y >= 0 and y < K.WORLD_HEIGHT and z >= 0 and z < K.WORLD_SIZE


func get_block(x: int, y: int, z: int) -> int:
	if not in_bounds(x, y, z):
		return Blocks.AIR
	return _blocks[_index(x, y, z)]


func set_block(x: int, y: int, z: int, id: int) -> bool:
	if not in_bounds(x, y, z):
		return false
	_blocks[_index(x, y, z)] = id
	block_changed.emit(x, y, z)
	return true


func height_at(x: int, z: int) -> int:
	return _heights[z * K.WORLD_SIZE + x]


## The top of the highest block a player could stand on, which is the height the
## surface is at once trees and houses are counted. Water does not count.
func surface_top(x: int, z: int) -> int:
	for y in range(K.WORLD_HEIGHT - 1, -1, -1):
		var id := get_block(x, y, z)
		if id != Blocks.AIR and id != Blocks.WATER:
			return y + 1
	return 1


## Dry land nearest the middle of the map, spiralling outwards. Returns the middle
## if there is no dry land at all, which the generator does not produce.
func find_spawn() -> Vector2i:
	var centre := Vector2i(K.WORLD_SIZE / 2, K.WORLD_SIZE / 2)
	var max_radius := K.WORLD_SIZE / 2 - 1
	for radius in range(max_radius + 1):
		for dx in range(-radius, radius + 1):
			for dz in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dz)) != radius:
					continue
				var x := centre.x + dx
				var z := centre.y + dz
				if not in_bounds(x, 0, z):
					continue
				if height_at(x, z) > K.SEA_LEVEL:
					return Vector2i(x, z)
	return centre


## Where a player appears when the world begins or they fall out of it: the
## middle of the spawn column, standing on whatever is there.
func spawn_position() -> Vector3:
	var spawn := find_spawn()
	return Vector3(spawn.x + 0.5, surface_top(spawn.x, spawn.y), spawn.y + 0.5)


## A copy of every block, for saving. Not the heightmap: that only exists to build
## the world and is never read again once it is built.
func blocks_snapshot() -> PackedByteArray:
	return _blocks.duplicate()


## Replaces every block with a saved copy. Returns false and changes nothing if the
## copy is the wrong size, which is what a save from a different world size looks
## like.
func load_blocks(data: PackedByteArray) -> bool:
	if data.size() != _blocks.size():
		return false
	_blocks = data.duplicate()
	return true


static func _noise(noise_seed: int) -> FastNoiseLite:
	var noise := FastNoiseLite.new()
	noise.seed = noise_seed
	noise.frequency = 1.0
	return noise


static func _rng(rng_seed: int) -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = rng_seed
	return rng


func _generate_overworld() -> void:
	var base_noise := _noise(seed_value)
	var detail_noise := _noise(seed_value + 1)
	var cave_noise := _noise(seed_value + 7)
	var tree_rand := _rng(seed_value + 2)
	var ore_rand := _rng(seed_value + 3)
	var flower_rand := _rng(seed_value + 4)
	var village_rand := _rng(seed_value + 5)
	var entrance_rand := _rng(seed_value + 10)
	var size := K.WORLD_SIZE

	for x in size:
		for z in size:
			var base := base_noise.get_noise_2d(x * 0.012, z * 0.012)
			var detail := detail_noise.get_noise_2d(x * 0.05, z * 0.05)
			var h := floori(K.SEA_LEVEL + TERRAIN_HEIGHT_BIAS + base * 14.0 + detail * 4.0)
			var height := clampi(h, 3, K.WORLD_HEIGHT - 6)
			_heights[z * size + x] = height
			# A few cave-eligible columns skip the surface buffer, so a tunnel
			# breaches the hillside as a visible entrance.
			var entrance := height >= CAVE_MIN_SURFACE_HEIGHT and entrance_rand.randf() < CAVE_ENTRANCE_CHANCE

			for y in K.WORLD_HEIGHT:
				var type := Blocks.AIR
				if y < height - 4:
					if y < DIAMOND_MAX_Y and ore_rand.randf() < DIAMOND_CHANCE:
						type = Blocks.DIAMOND_ORE
					elif y < GOLD_MAX_Y and ore_rand.randf() < GOLD_CHANCE:
						type = Blocks.GOLD_ORE
					else:
						type = Blocks.STONE
				elif y < height - 1:
					type = Blocks.DIRT
				elif y == height - 1:
					type = Blocks.SAND if height <= K.SEA_LEVEL + 1 else Blocks.GRASS
				elif y < K.SEA_LEVEL:
					type = Blocks.WATER

				var carvable := type == Blocks.STONE or type == Blocks.DIAMOND_ORE or type == Blocks.GOLD_ORE or type == Blocks.DIRT or type == Blocks.GRASS
				var cave_ceiling := height - (0 if entrance else CAVE_SURFACE_BUFFER)
				if height >= CAVE_MIN_SURFACE_HEIGHT and y >= CAVE_MIN_Y and y < cave_ceiling and carvable:
					if absf(cave_noise.get_noise_3d(x * CAVE_SCALE_XZ, y * CAVE_SCALE_Y, z * CAVE_SCALE_XZ)) > CAVE_THRESHOLD:
						type = Blocks.AIR

				if type != Blocks.AIR:
					_blocks[_index(x, y, z)] = type

	_scatter_trees(tree_rand)
	_scatter_flowers(flower_rand)
	_build_village(village_rand)


## One candidate per 5×5 cell, so trees stay spread out.
func _scatter_trees(rand: RandomNumberGenerator) -> void:
	var spacing := 5
	for cx in range(1, K.WORLD_SIZE - 1, spacing):
		for cz in range(1, K.WORLD_SIZE - 1, spacing):
			if rand.randf() > 0.35:
				continue
			var x := cx + rand.randi_range(0, spacing - 1)
			var z := cz + rand.randi_range(0, spacing - 1)
			if x < 2 or x >= K.WORLD_SIZE - 2 or z < 2 or z >= K.WORLD_SIZE - 2:
				continue
			var h := height_at(x, z)
			if h <= K.SEA_LEVEL:
				continue
			if get_block(x, h - 1, z) != Blocks.GRASS:
				continue
			_plant_tree(x, h, z, rand)


## One candidate per 3×3 cell: dense enough to notice, spread enough not to clump.
func _scatter_flowers(rand: RandomNumberGenerator) -> void:
	var spacing := 3
	for cx in range(0, K.WORLD_SIZE, spacing):
		for cz in range(0, K.WORLD_SIZE, spacing):
			if rand.randf() > 0.3:
				continue
			var x := cx + rand.randi_range(0, spacing - 1)
			var z := cz + rand.randi_range(0, spacing - 1)
			if not in_bounds(x, 0, z):
				continue
			var h := height_at(x, z)
			if h <= K.SEA_LEVEL:
				continue
			if get_block(x, h - 1, z) != Blocks.GRASS or get_block(x, h, z) != Blocks.AIR:
				continue
			var type := Blocks.FLOWER_RED if rand.randf() < 0.5 else Blocks.FLOWER_YELLOW
			set_block(x, h, z, type)


func _plant_tree(x: int, y: int, z: int, rand: RandomNumberGenerator) -> void:
	var trunk_height := 4 + rand.randi_range(0, 1)
	for i in trunk_height:
		set_block(x, y + i, z, Blocks.WOOD)
	var canopy_base := y + trunk_height - 2
	for ly in 3:
		var radius := 2 if ly == 1 else 1
		for dx in range(-radius, radius + 1):
			for dz in range(-radius, radius + 1):
				if absi(dx) == radius and absi(dz) == radius and radius == 2:
					continue
				var bx := x + dx
				var by := canopy_base + ly
				var bz := z + dz
				if get_block(bx, by, bz) == Blocks.AIR:
					set_block(bx, by, bz, Blocks.LEAVES)
	set_block(x, canopy_base + 3, z, Blocks.LEAVES)


## Five houses in a ring around the spawn, each joined to it by a path.
func _build_village(rand: RandomNumberGenerator) -> void:
	var spawn := find_spawn()
	var size := 5
	var spacing := 9
	var offsets := [
		Vector2i(-spacing, -spacing),
		Vector2i(spacing, -spacing),
		Vector2i(-spacing, spacing),
		Vector2i(spacing, spacing),
		Vector2i(0, spacing * 2),
	]
	var doors: Array[Vector2i] = []
	for offset in offsets:
		var spot = _find_build_spot(spawn.x + offset.x, spawn.y + offset.y, size, size, K.SEA_LEVEL)
		if spot == null:
			continue
		_build_house(spot.x, spot.y, size, rand)
		doors.append(Vector2i(spot.x + size / 2, spot.y))
	for door in doors:
		_carve_path(spawn.x, spawn.y, door.x, spawn.y)
		_carve_path(door.x, spawn.y, door.x, door.y)


## Searches outwards in rings for a footprint on land above the given height.
## Returns the corner as a Vector2i, or null if nothing fits.
func _find_build_spot(x: int, z: int, width: int, depth: int, min_ground_y: int) -> Variant:
	for ring in range(5):
		for dx in range(-ring, ring + 1):
			for dz in range(-ring, ring + 1):
				if maxi(absi(dx), absi(dz)) != ring:
					continue
				var hx := x + dx * 2
				var hz := z + dz * 2
				if not in_bounds(hx - 1, 0, hz - 1) or not in_bounds(hx + width, 0, hz + depth):
					continue
				var cx := hx + width / 2
				var cz := hz + depth / 2
				if height_at(cx, cz) <= min_ground_y:
					continue
				return Vector2i(hx, hz)
	return null


func _build_house(x: int, z: int, size: int, rand: RandomNumberGenerator) -> void:
	var cx := x + size / 2
	var cz := z + size / 2
	var ground_y := height_at(cx, cz)
	if ground_y <= K.SEA_LEVEL:
		return
	var wall_height := 3 + rand.randi_range(0, 1)
	var floor_y := ground_y - 1
	var roof_y := ground_y + wall_height

	# Clear any tree parts that overlap the footprint first.
	for dx in range(-1, size + 1):
		for dz in range(-1, size + 1):
			for y in range(floor_y, roof_y + 3):
				var bx := x + dx
				var bz := z + dz
				if not in_bounds(bx, y, bz):
					continue
				var id := get_block(bx, y, bz)
				if id == Blocks.WOOD or id == Blocks.LEAVES:
					set_block(bx, y, bz, Blocks.AIR)

	for dx in size:
		for dz in size:
			set_block(x + dx, floor_y, z + dz, Blocks.PLANK)

	var door_x := size / 2
	var window_z := size / 2
	for dy in wall_height:
		var y := ground_y + dy
		for dx in size:
			for dz in size:
				var on_edge := dx == 0 or dx == size - 1 or dz == 0 or dz == size - 1
				if not on_edge:
					continue
				if dz == 0 and dx == door_x and dy < 2:
					set_block(x + dx, y, z + dz, Blocks.DOOR)
					continue
				var is_window := dy == 1 and (dx == 0 or dx == size - 1) and dz == window_z
				set_block(x + dx, y, z + dz, Blocks.GLASS if is_window else Blocks.PLANK)

	for dx in range(-1, size + 1):
		for dz in range(-1, size + 1):
			set_block(x + dx, roof_y, z + dz, Blocks.BRICK)


## Lays a path of packed earth between two points, on natural ground only, so it
## never overwrites a wall that sits beside the raw terrain height.
func _carve_path(x0: int, z0: int, x1: int, z1: int) -> void:
	var steps := maxi(absi(x1 - x0), absi(z1 - z0))
	for i in range(steps + 1):
		var t := 0.0 if steps == 0 else float(i) / steps
		var x := roundi(x0 + (x1 - x0) * t)
		var z := roundi(z0 + (z1 - z0) * t)
		if not in_bounds(x, 0, z):
			continue
		var y := height_at(x, z)
		if y <= K.SEA_LEVEL:
			continue
		var surface := get_block(x, y - 1, z)
		if surface != Blocks.GRASS and surface != Blocks.DIRT and surface != Blocks.SAND:
			continue
		set_block(x, y - 1, z, Blocks.PATH)
