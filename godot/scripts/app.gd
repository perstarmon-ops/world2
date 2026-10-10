## The whole game, wired together.
##
## Owns the frame loop, the camera and the menus, and nothing else. It does not know
## how a jump works (player.gd does) or what a block is worth (blocks.gd). Its job is
## to decide what runs this frame and what is drawn over the top of it.
##
## Nothing in here reads Input directly. Everything goes through GameInput, which is
## what lets a test drive this exact code with a controller that is not plugged in.
##
## The game starts paused, on the title, so the first thing a player sees is how to
## start. A save, if there is one, is loaded underneath it.
class_name App
extends Node3D

const MESSAGE_SECONDS := 2.5
## How many chunks are rebuilt per frame. A block change queues at most a few, so
## this spreads the cost of a big edit rather than hitching on it.
const CHUNKS_PER_FRAME := 2

var world: VoxelWorld
var inventory: Inventory
var player: Player
var interaction: Interaction
var mesher: ChunkMesher
var day_night: DayNight
var camera: Camera3D
var hud: Hud

var paused := true
var _game_input := GameInput.new()
var _intent := {}
var _sun: DirectionalLight3D
var _terrain: Node3D
var _outline: MeshInstance3D
var _message_left := 0.0


func _ready() -> void:
	var save := Saves.read()
	world = VoxelWorld.new(int(save.get("seed", K.DEFAULT_SEED)))
	inventory = Inventory.new()
	player = Player.new(world)
	player.teleport(world.spawn_position())
	var loaded := not save.is_empty() and Saves.apply(save, world, player, inventory)

	_build_environment()
	_terrain = Node3D.new()
	add_child(_terrain)
	mesher = ChunkMesher.new(world, _terrain)
	mesher.build_all()
	interaction = Interaction.new(world, inventory)
	_build_outline()
	_build_hud()
	camera.position = player.eye_position()
	show_message("Loaded your saved world" if loaded else "New world")


func _build_environment() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.fog_enabled = true
	environment.fog_mode = Environment.FOG_MODE_DEPTH
	environment.fog_depth_begin = K.FOG_BEGIN
	environment.fog_depth_end = K.FOG_END
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_energy = 1.0
	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)

	_sun = DirectionalLight3D.new()
	_sun.shadow_enabled = false
	add_child(_sun)
	day_night = DayNight.new(_sun, environment)

	camera = Camera3D.new()
	camera.fov = 75.0
	camera.near = 0.1
	camera.far = K.RENDER_DISTANCE
	camera.current = true
	add_child(camera)


## A dark translucent box over the block under the crosshair, so you can see what a
## click will hit before you click.
func _build_outline() -> void:
	var box := BoxMesh.new()
	box.size = Vector3.ONE * 1.01
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color = Color(0, 0, 0, 0.3)
	_outline = MeshInstance3D.new()
	_outline.mesh = box
	_outline.material_override = material
	_outline.visible = false
	add_child(_outline)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Hud.new()
	hud.inventory = inventory
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud)


func _physics_process(delta: float) -> void:
	if paused or _intent.is_empty():
		return
	player.step(delta, _intent)
	if player.position.y < K.VOID_Y:
		player.teleport(world.spawn_position())


func _process(delta: float) -> void:
	var state := _game_input.poll()
	var pressed: Dictionary = state["pressed"]
	var held: Dictionary = state["held"]

	_handle_menus(pressed)
	if not paused:
		_turn(state, delta)
		_intent = {
			"move": state["move"],
			"jump": held["jump"],
			"sprint": held["sprint"],
			"crouch": held["crouch"],
		}
		if pressed["next_slot"]:
			inventory.cycle(1)
		if pressed["prev_slot"]:
			inventory.cycle(-1)

		var eye := player.eye_position()
		var aim := player.look_direction()
		var mining := interaction.update(delta, eye, aim, held["mine"], player.is_in_water())
		if pressed["place"]:
			interaction.place(eye, aim, player)
		hud.mining = mining["progress"]
		_show_target(mining["target"])
		day_night.update(delta)
	else:
		_show_target(null)
		hud.mining = 0.0

	camera.position = player.eye_position()
	camera.basis = Basis.from_euler(Vector3(player.pitch, player.yaw, 0.0), EULER_ORDER_YXZ)
	mesher.flush(CHUNKS_PER_FRAME)

	if _message_left > 0.0:
		_message_left -= delta
		if _message_left <= 0.0:
			hud.message = ""
	_refresh_hud()


## Applies the look stick and the mouse to the view. The stick is a rate and the
## mouse is a distance, so they are scaled differently.
func _turn(state: Dictionary, delta: float) -> void:
	var look: Vector2 = state["look"]
	var mouse: Vector2 = state["mouse"]
	player.look(
		-look.x * K.STICK_LOOK_SPEED * delta - mouse.x * K.MOUSE_LOOK_SENSITIVITY,
		-look.y * K.STICK_LOOK_SPEED * delta - mouse.y * K.MOUSE_LOOK_SENSITIVITY,
	)


func _show_target(cell) -> void:
	_outline.visible = cell != null
	if cell != null:
		_outline.position = Vector3(cell) + Vector3(0.5, 0.5, 0.5)


func _handle_menus(pressed: Dictionary) -> void:
	if pressed["pause"]:
		set_paused(not paused)
	if pressed["save"]:
		_save_game()
	if paused and pressed["quit"]:
		_save_game()
		get_tree().quit()


## Pausing frees the mouse so the menu can be reached. Resuming captures it again
## only if the player clicks, so a controller-only player never has the cursor
## grabbed out from under them.
func set_paused(value: bool) -> void:
	paused = value
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if paused else Input.MOUSE_MODE_CAPTURED
	if paused:
		interaction.cancel_mining()


func _unhandled_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.pressed:
		if paused and button.button_index == MOUSE_BUTTON_LEFT:
			set_paused(false)
		elif not paused and button.button_index == MOUSE_BUTTON_WHEEL_UP:
			inventory.cycle(-1)
		elif not paused and button.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			inventory.cycle(1)
	var motion := event as InputEventMouseMotion
	if motion != null and not paused and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_game_input.add_mouse(motion.relative)
	var key := event as InputEventKey
	if key != null and key.pressed and not key.echo and not paused:
		if key.keycode >= KEY_1 and key.keycode < KEY_1 + K.HOTBAR_SIZE:
			inventory.select(key.keycode - KEY_1)


func _save_game() -> void:
	if Saves.write(Saves.PATH, world, player, inventory):
		show_message("Saved")
	else:
		show_message("Could not save")


func show_message(text: String) -> void:
	hud.message = text
	_message_left = MESSAGE_SECONDS


func _refresh_hud() -> void:
	hud.clock = day_night.clock_text()
	hud.paused = paused
	hud.status = _status_text()
	if paused:
		hud.pause_lines = _pause_lines()
	else:
		hud.pause_lines.clear()
	hud.queue_redraw()


func _status_text() -> String:
	var pads := Input.get_connected_joypads()
	var pad := "Controller: " + Input.get_joy_name(pads[0]) if not pads.is_empty() else "No controller detected"
	return "%s   |   %d FPS" % [pad, Engine.get_frames_per_second()]


func _pause_lines() -> Array[String]:
	var lines: Array[String] = []
	lines.append("Resume: Start / Enter, or click")
	lines.append("Save: Back / F5")
	lines.append("Save and quit: Y / Q")
	lines.append("Dig: right trigger, or hold left mouse   Place: left trigger, or right mouse")
	lines.append("Move: left stick, WASD   Look: right stick, mouse   Jump: A, Space")
	lines.append("Hotbar: bumpers, D-pad, mouse wheel, or 1-9")
	return lines


func _exit_tree() -> void:
	if mesher != null:
		mesher.release()
	if _outline != null:
		_outline.mesh = null


## Saving on the window's close button, not only from the menu, so closing the game
## never loses what was done since the last save.
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST and world != null:
		_save_game()
