## The controller, end to end.
##
##   godot --headless --path godot --script res://tests/input_test.gd
##
## Drives the real game with a pad that is not plugged in: events are injected the way
## a controller sends them. It starts from the title with Start, walks with the left
## stick while jumping with A, looks down with the right stick, digs with the right
## trigger, and pauses again with Start.
##
## Nothing here reads a file or a frame count. Each step waits for real time, so a
## slow machine is given as long as a fast one.
##
## Exits non-zero on failure.
extends SceneTree

var app
var checks := 0
var failures := 0
var _phase := -1
var _until := 0
var _changes := 0
var _changes_before := 0
var _x_before := 0.0


func _initialize() -> void:
	app = load("res://scenes/main.tscn").instantiate()
	get_root().add_child(app)


func _process(_delta: float) -> bool:
	# The game builds its world in _ready, which runs on the first frame after it is
	# added, so nothing can be connected to it before then.
	if _phase == -1:
		if app.world == null:
			return false
		app.world.block_changed.connect(func(_x: int, _y: int, _z: int) -> void: _changes += 1)
		print("— controller checks —")
		_button(JOY_BUTTON_START, true)
		_next(0, 400)
		return false
	if Time.get_ticks_msec() < _until:
		return false
	match _phase:
		0:
			_ok("Start begins the game from the title", not app.paused)
			_button(JOY_BUTTON_START, false)
			_x_before = app.player.position.x
			_axis(JOY_AXIS_LEFT_X, 1.0)
			_button(JOY_BUTTON_A, true)
			_next(1, 1500)
		1:
			_axis(JOY_AXIS_LEFT_X, 0.0)
			_button(JOY_BUTTON_A, false)
			var walked: float = Vector2(app.player.position.x - _x_before, app.player.position.z).length()
			_ok("the left stick walks the player", absf(app.player.position.x - _x_before) > 0.5, "moved %.2f" % walked)
			_axis(JOY_AXIS_RIGHT_Y, 1.0)
			_next(2, 800)
		2:
			_axis(JOY_AXIS_RIGHT_Y, 0.0)
			_ok("the right stick looks down", app.player.pitch < -0.4, "pitch %.2f" % app.player.pitch)
			_changes_before = _changes
			_axis(JOY_AXIS_TRIGGER_RIGHT, 1.0)
			_next(3, 4000)
		3:
			_axis(JOY_AXIS_TRIGGER_RIGHT, 0.0)
			_ok("the right trigger digs a block", _changes > _changes_before, "%d block changes" % (_changes - _changes_before))
			_button(JOY_BUTTON_START, true)
			_next(4, 400)
		4:
			_button(JOY_BUTTON_START, false)
			_ok("Start pauses the game again", app.paused)
			print("%d checks, %d failed" % [checks, failures])
			quit(1 if failures > 0 else 0)
	return false


func _next(phase: int, milliseconds: int) -> void:
	_phase = phase
	_wait(milliseconds)


func _wait(milliseconds: int) -> void:
	_until = Time.get_ticks_msec() + milliseconds


func _ok(what: String, good: bool, detail: String = "") -> void:
	checks += 1
	if good:
		print("  ok    %s" % what)
	else:
		failures += 1
		print("  FAIL  %s  %s" % [what, detail])


func _button(button: int, down: bool) -> void:
	var event := InputEventJoypadButton.new()
	event.device = 0
	event.button_index = button
	event.pressed = down
	Input.parse_input_event(event)


func _axis(axis: int, value: float) -> void:
	var event := InputEventJoypadMotion.new()
	event.device = 0
	event.axis = axis
	event.axis_value = value
	Input.parse_input_event(event)
