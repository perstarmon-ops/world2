## Reads the controller, keyboard and mouse once a frame into one snapshot.
##
## Nothing else reads Input directly. Everything downstream gets a dictionary: which
## actions are held, which were just pressed, the movement and look vectors, and the
## mouse movement since last time. That is what keeps the game playable from a pad
## alone and makes the front end testable without a device plugged in.
class_name GameInput
extends RefCounted

const STICK_DEADZONE := 0.2

var _previous := {}
var _mouse := Vector2.ZERO


## Mouse movement arrives as events, not by polling, so the app forwards it here.
func add_mouse(relative: Vector2) -> void:
	_mouse += relative


## Returns {"held", "pressed", "move", "look", "mouse"}. `pressed` is true only on
## the frame an action goes down, and `mouse` is cleared once it has been read.
func poll() -> Dictionary:
	var held := {}
	var pressed := {}
	for action in Bindings.ACTIONS:
		var down := Bindings.is_down(action)
		held[action] = down
		pressed[action] = down and not bool(_previous.get(action, false))
	_previous = held

	var mouse := _mouse
	_mouse = Vector2.ZERO
	return {
		"held": held,
		"pressed": pressed,
		"move": _move(),
		"look": _look(),
		"mouse": mouse,
	}


## Left stick plus WASD and the arrow keys. Forward is positive Y, so the stick's
## up, which is negative on the axis, is forward.
func _move() -> Vector2:
	var move := Vector2.ZERO
	for pad in Bindings.pads():
		var stick := Vector2(Input.get_joy_axis(pad, JOY_AXIS_LEFT_X), -Input.get_joy_axis(pad, JOY_AXIS_LEFT_Y))
		if stick.length() > STICK_DEADZONE:
			move += stick
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		move.y += 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		move.y -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		move.x += 1.0
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		move.x -= 1.0
	return move.limit_length(1.0)


## Right stick. Up is negative on the axis, and looking up is positive pitch, so the
## Y component is handed back as-is and the caller negates it.
func _look() -> Vector2:
	var look := Vector2.ZERO
	for pad in Bindings.pads():
		var stick := Vector2(Input.get_joy_axis(pad, JOY_AXIS_RIGHT_X), Input.get_joy_axis(pad, JOY_AXIS_RIGHT_Y))
		if stick.length() > STICK_DEADZONE:
			look += stick
	return look.limit_length(1.0)
