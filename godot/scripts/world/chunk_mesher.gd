## Turns the voxel world into triangles, one mesh per chunk.
##
## Each chunk is three surfaces: solid blocks, water, and plants. Solid faces are
## culled when a solid opaque block is behind them, or the same block, so the
## inside of a hill is never drawn. Water and plants get their own surfaces with
## their own materials, because a translucent surface cannot share a draw call
## with an opaque one.
##
## The mesher reads the world and writes meshes. It never changes a block, and it
## learns of changes only through the world's signal, rebuilding the chunk that
## changed and any neighbour whose faces it touches.
class_name ChunkMesher
extends RefCounted

const FACES := [
	Vector3i(1, 0, 0),
	Vector3i(-1, 0, 0),
	Vector3i(0, 1, 0),
	Vector3i(0, -1, 0),
	Vector3i(0, 0, 1),
	Vector3i(0, 0, -1),
]

## Water is drawn at this opacity. It goes in the vertex colour's alpha, which the
## water material reads.
const WATER_ALPHA := 0.62
## How much a block's colour varies from one to the next, so a grass field is not a
## single flat colour. A fraction of the colour either side of itself.
const TINT_VARIATION := 0.12

var _world: VoxelWorld
var _root: Node3D
var _chunks := {}
var _pending: Array[Vector2i] = []
var _pending_set := {}
var _opaque_material := StandardMaterial3D.new()
var _water_material := StandardMaterial3D.new()
var _plant_material := StandardMaterial3D.new()


func _init(world: VoxelWorld, root: Node3D) -> void:
	_world = world
	_root = root
	_opaque_material.vertex_color_use_as_albedo = true
	_opaque_material.roughness = 1.0
	_water_material.vertex_color_use_as_albedo = true
	_water_material.roughness = 0.2
	_water_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_water_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_plant_material.vertex_color_use_as_albedo = true
	_plant_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_plant_material.roughness = 1.0
	_world.block_changed.connect(_on_block_changed)


## Queues every chunk and builds them all now. Used once, at start-up and after a
## save is loaded, when the whole world has changed.
func build_all() -> void:
	for cx in K.WORLD_CHUNKS:
		for cz in K.WORLD_CHUNKS:
			_queue(Vector2i(cx, cz))
	flush(-1)


## Lets go of every chunk mesh before the engine shuts down. A mesh still attached to
## a node when the renderer goes away is freed after it, and the headless renderer
## reports that as an error on every run.
func release() -> void:
	for instance in _chunks.values():
		instance.mesh = null
	_chunks.clear()


## Rebuilds up to `budget` queued chunks, or all of them if the budget is negative.
## Returns how many are still waiting, so the caller can keep going next frame.
func flush(budget: int = 2) -> int:
	var done := 0
	while not _pending.is_empty() and (budget < 0 or done < budget):
		var chunk: Vector2i = _pending.pop_front()
		_pending_set.erase(chunk)
		_build_chunk(chunk)
		done += 1
	return _pending.size()


func _on_block_changed(x: int, y: int, z: int) -> void:
	var cx := floori(float(x) / K.CHUNK_SIZE)
	var cz := floori(float(z) / K.CHUNK_SIZE)
	var lx := x - cx * K.CHUNK_SIZE
	var lz := z - cz * K.CHUNK_SIZE
	_queue(Vector2i(cx, cz))
	# A block on the edge of a chunk changes the faces of the chunk beside it too.
	if lx == 0:
		_queue(Vector2i(cx - 1, cz))
	elif lx == K.CHUNK_SIZE - 1:
		_queue(Vector2i(cx + 1, cz))
	if lz == 0:
		_queue(Vector2i(cx, cz - 1))
	elif lz == K.CHUNK_SIZE - 1:
		_queue(Vector2i(cx, cz + 1))


func _queue(chunk: Vector2i) -> void:
	if chunk.x < 0 or chunk.y < 0 or chunk.x >= K.WORLD_CHUNKS or chunk.y >= K.WORLD_CHUNKS:
		return
	if _pending_set.has(chunk):
		return
	_pending_set[chunk] = true
	_pending.append(chunk)


func _build_chunk(chunk: Vector2i) -> void:
	var opaque := MeshBuffer.new()
	var water := MeshBuffer.new()
	var plants := MeshBuffer.new()
	var ox := chunk.x * K.CHUNK_SIZE
	var oz := chunk.y * K.CHUNK_SIZE

	for y in K.WORLD_HEIGHT:
		for lz in K.CHUNK_SIZE:
			for lx in K.CHUNK_SIZE:
				var x := ox + lx
				var z := oz + lz
				var id := _world.get_block(x, y, z)
				if id == Blocks.AIR:
					continue
				var cell := Vector3(lx, y, lz)
				var color := _tinted(id, x, y, z)
				if Blocks.is_cross(id):
					plants.add_cross(cell, color)
					continue
				var buffer := water if id == Blocks.WATER else opaque
				for face in FACES:
					var neighbour := _world.get_block(x + face.x, y + face.y, z + face.z)
					if neighbour == id or Blocks.occludes(neighbour):
						continue
					buffer.add_face(cell, Vector3(face), color)

	var mesh := ArrayMesh.new()
	_add_surface(mesh, opaque, _opaque_material)
	_add_surface(mesh, water, _water_material)
	_add_surface(mesh, plants, _plant_material)

	var instance: MeshInstance3D = _chunks.get(chunk)
	if instance == null:
		instance = MeshInstance3D.new()
		instance.position = Vector3(ox, 0, oz)
		_root.add_child(instance)
		_chunks[chunk] = instance
	instance.mesh = mesh


static func _add_surface(mesh: ArrayMesh, buffer: MeshBuffer, material: Material) -> void:
	if buffer.vertices.is_empty():
		return
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = buffer.vertices
	arrays[Mesh.ARRAY_NORMAL] = buffer.normals
	arrays[Mesh.ARRAY_COLOR] = buffer.colors
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(mesh.get_surface_count() - 1, material)


## A block's colour nudged by a hash of its position, so neighbouring blocks of one
## kind differ slightly. The hash is of the position, not a generator, so the same
## world always looks the same.
func _tinted(id: int, x: int, y: int, z: int) -> Color:
	var base := Blocks.color(id)
	var shift := (_hash01(x, y, z) - 0.5) * TINT_VARIATION * 2.0
	var alpha := WATER_ALPHA if id == Blocks.WATER else 1.0
	return Color(
		clampf(base.r * (1.0 + shift), 0.0, 1.0),
		clampf(base.g * (1.0 + shift), 0.0, 1.0),
		clampf(base.b * (1.0 + shift), 0.0, 1.0),
		alpha,
	)


static func _hash01(x: int, y: int, z: int) -> float:
	var h := x * 374761393 + y * 668265263 + z * 1442695041
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0xffff) / 65535.0


## Accumulates triangles for one surface. Faces are built from their centre and
## the two axes across them, so there is one piece of geometry for every face
## direction rather than six hand-written quads.
class MeshBuffer:
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()

	func add_face(cell: Vector3, normal: Vector3, color: Color) -> void:
		var centre := cell + Vector3(0.5, 0.5, 0.5) + normal * 0.5
		var across := Vector3(normal.y, normal.z, normal.x)
		var up := normal.cross(across)
		_quad(
			[
				centre - across * 0.5 - up * 0.5,
				centre + across * 0.5 - up * 0.5,
				centre + across * 0.5 + up * 0.5,
				centre - across * 0.5 + up * 0.5,
			],
			normal,
			color,
		)

	## Two quads crossing in the middle of the cell, for flowers: seen from any side,
	## they look like a plant rather than a flat card.
	func add_cross(cell: Vector3, color: Color) -> void:
		var lo := 0.1
		var hi := 0.9
		var top := 0.9
		_quad(
			[cell + Vector3(lo, 0, lo), cell + Vector3(hi, 0, hi), cell + Vector3(hi, top, hi), cell + Vector3(lo, top, lo)],
			Vector3.UP,
			color,
		)
		_quad(
			[cell + Vector3(hi, 0, lo), cell + Vector3(lo, 0, hi), cell + Vector3(lo, top, hi), cell + Vector3(hi, top, lo)],
			Vector3.UP,
			color,
		)

	## Godot treats a triangle as front-facing when it winds clockwise as seen from
	## the front, which means its cross product points away from the face's normal.
	## The winding is decided here from the normal instead of by hand, so a quad that
	## is wound the wrong way is corrected rather than silently culled.
	func _quad(corners: Array, normal: Vector3, color: Color) -> void:
		var order := [0, 1, 2, 0, 2, 3]
		var winding: Vector3 = (corners[1] - corners[0]).cross(corners[2] - corners[0])
		if winding.dot(normal) > 0.0:
			order = [0, 2, 1, 0, 3, 2]
		for i in order:
			vertices.append(corners[i])
			normals.append(normal)
			colors.append(color)
