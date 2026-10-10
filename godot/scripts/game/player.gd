## You, as the rules see you: a box that walks, jumps, swims and falls through a
## voxel world.
##
## Nothing in here reads a device, a clock or the camera. Each step takes a fixed
## time and an intent: a direction, and whether you are jumping, sprinting or
## crouching. That is what makes the physics testable without a window, and what
## lets the simulation run at a fixed 60 steps a second whatever the frame rate.
##
## Movement is resolved one axis at a time against the block grid. A move that
## would end inside a solid block is cut short on that axis, so a body cannot pass
## through a wall however fast it is going. Walking into a single block's height
## lifts you onto it, which is what makes a stepped hillside walkable.
class_name Player
extends RefCounted

## How far the feet are allowed to hover above a floor and still count as standing.
const EPS := 0.0001

var world: VoxelWorld
var position := Vector3.ZERO
var velocity := Vector3.ZERO
## Heading, in radians around the vertical axis. Zero faces down the negative Z axis.
var yaw := 0.0
## Tilt, in radians. Positive looks up.
var pitch := 0.0
var on_ground := false
var crouching := false


func _init(p_world: VoxelWorld) -> void:
	world = p_world


func teleport(to: Vector3) -> void:
	position = to
	velocity = Vector3.ZERO
	on_ground = false


## Turns the view. Clamped short of straight up or down, so the camera never
## flips over the top of the player.
func look(delta_yaw: float, delta_pitch: float) -> void:
	yaw = fposmod(yaw + delta_yaw, TAU)
	pitch = clampf(pitch + delta_pitch, -K.PITCH_LIMIT, K.PITCH_LIMIT)


func forward() -> Vector3:
	return Vector3(-sin(yaw), 0.0, -cos(yaw))


func right() -> Vector3:
	return Vector3(cos(yaw), 0.0, -sin(yaw))


## The unit vector the view points along, including the tilt.
func look_direction() -> Vector3:
	return Vector3(-sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch))


func eye_position() -> Vector3:
	var height := K.EYE_HEIGHT - (K.CROUCH_EYE_OFFSET if crouching else 0.0)
	return position + Vector3(0.0, height, 0.0)


func is_in_water() -> bool:
	var mid_y := position.y + K.PLAYER_HEIGHT * 0.5
	return world.get_block(floori(position.x), floori(mid_y), floori(position.z)) == Blocks.WATER


## Whether this body overlaps the block at a cell. Placing a block into the cell
## you are standing in would trap you inside it, so placement asks this first.
func occupies(cell: Vector3i) -> bool:
	return position.x + K.PLAYER_RADIUS > cell.x and position.x - K.PLAYER_RADIUS < cell.x + 1 \
		and position.y + K.PLAYER_HEIGHT > cell.y and position.y < cell.y + 1 \
		and position.z + K.PLAYER_RADIUS > cell.z and position.z - K.PLAYER_RADIUS < cell.z + 1


## One fixed step of movement.
##
## `intent` has: move (a Vector2: x to the right, y forward, each -1 to 1),
## jump (bool), sprint (bool) and crouch (bool).
func step(dt: float, intent: Dictionary) -> void:
	var water := is_in_water()
	crouching = bool(intent.get("crouch", false)) and on_ground and not water
	var sprinting := bool(intent.get("sprint", false)) and not crouching and not water
	var jumping := bool(intent.get("jump", false))

	var speed := K.SWIM_SPEED if water else K.CROUCH_SPEED if crouching else K.SPRINT_SPEED if sprinting else K.WALK_SPEED
	var move: Vector2 = intent.get("move", Vector2.ZERO)
	if move.length() > 1.0:
		move = move.normalized()
	var wish := forward() * move.y + right() * move.x
	velocity.x = wish.x * speed
	velocity.z = wish.z * speed

	# Vertical distance is the average of the speed before and after this step, so
	# a jump's arc is the parabola it should be rather than one biased high by
	# half a step's worth of climb.
	var speed_before := velocity.y
	if water:
		velocity.y -= K.GRAVITY * K.WATER_GRAVITY_SCALE * dt
		if jumping:
			velocity.y = minf(velocity.y + K.SWIM_ACCEL * dt, K.SWIM_RISE_MAX)
		velocity.y = maxf(velocity.y, -K.SWIM_SPEED)
	else:
		if jumping and on_ground:
			velocity.y = K.JUMP_SPEED
			speed_before = velocity.y
			on_ground = false
		velocity.y = maxf(velocity.y - K.GRAVITY * dt, -K.FALL_SPEED_MAX)

	_move_axis(0, velocity.x * dt)
	_move_axis(2, velocity.z * dt)
	_move_axis(1, (speed_before + velocity.y) * 0.5 * dt)
	on_ground = _has_floor()


func _move_axis(axis: int, delta: float) -> void:
	if is_zero_approx(delta):
		return
	var target := position
	target[axis] += delta
	if not _collides(target):
		position = target
		return
	# A low step: a block in the way, but only one block high, and room above it.
	if axis != 1 and on_ground:
		var raised := target + Vector3(0.0, K.STEP_HEIGHT, 0.0)
		if not _collides(raised):
			position = raised
			return
	# Stop flush against the block that was hit, not a sliver short of it. A body
	# left a few thousandths above a floor would never quite count as standing on it.
	position[axis] = _flush_against(axis, target[axis], delta)
	velocity[axis] = 0.0


## The position on an axis that touches the block a blocked move ran into.
func _flush_against(axis: int, value: float, delta: float) -> float:
	if axis == 1:
		if delta < 0.0:
			return floorf(value) + 1.0
		return floorf(value + K.PLAYER_HEIGHT) - K.PLAYER_HEIGHT
	if delta > 0.0:
		return floorf(value + K.PLAYER_RADIUS - EPS) - K.PLAYER_RADIUS
	return floorf(value - K.PLAYER_RADIUS) + 1.0 + K.PLAYER_RADIUS


## Whether a body at `at` overlaps any solid block.
func _collides(at: Vector3) -> bool:
	var lo_x := floori(at.x - K.PLAYER_RADIUS)
	var hi_x := floori(at.x + K.PLAYER_RADIUS - EPS)
	var lo_y := floori(at.y)
	var hi_y := floori(at.y + K.PLAYER_HEIGHT - EPS)
	var lo_z := floori(at.z - K.PLAYER_RADIUS)
	var hi_z := floori(at.z + K.PLAYER_RADIUS - EPS)
	for x in range(lo_x, hi_x + 1):
		for y in range(lo_y, hi_y + 1):
			for z in range(lo_z, hi_z + 1):
				if Blocks.is_solid(world.get_block(x, y, z)):
					return true
	return false


## Whether there is a solid block just under the feet.
func _has_floor() -> bool:
	var y := floori(position.y - K.GROUND_PROBE)
	for x in range(floori(position.x - K.PLAYER_RADIUS), floori(position.x + K.PLAYER_RADIUS - EPS) + 1):
		for z in range(floori(position.z - K.PLAYER_RADIUS), floori(position.z + K.PLAYER_RADIUS - EPS) + 1):
			if Blocks.is_solid(world.get_block(x, y, z)):
				return true
	return false
