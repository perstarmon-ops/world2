## Which control does what. The mapping is data, not code.
##
## Every action is named for the job it does ("jump", "mine"), never for the button
## it happens to sit on, so moving one is a one-line change here and nothing else
## has to know. A control is a pad button, a pad trigger (an axis, which counts as
## pressed past half-travel), a key or a mouse button.
##
## The pad layout is the Xbox one. Steam Input presents a Steam Controller and most
## other pads this way, so a Steam Machine needs no special case.
##
## A Steam Controller's grips are paddles, and they report above that layout. Each
## action lists its paddles after its ordinary buttons, so a grip does the same job
## as the button it sits beside, and a pad with no paddles simply never presses them.
class_name Bindings
extends RefCounted

const ACTIONS := ["jump", "sprint", "crouch", "mine", "place", "next_slot", "prev_slot", "pause", "save", "quit"]

## Triggers and sticks read as "pressed" beyond this much travel.
const AXIS_THRESHOLD := 0.5

const CONTROLS := {
	"jump": {"buttons": [JOY_BUTTON_A, JOY_BUTTON_PADDLE1], "keys": [KEY_SPACE]},
	"sprint": {"buttons": [JOY_BUTTON_LEFT_STICK, JOY_BUTTON_PADDLE2], "keys": [KEY_SHIFT]},
	"crouch": {"buttons": [JOY_BUTTON_B, JOY_BUTTON_PADDLE3], "keys": [KEY_CTRL]},
	"mine": {"axes": [[JOY_AXIS_TRIGGER_RIGHT, 1.0]], "mouse": [MOUSE_BUTTON_LEFT]},
	"place": {"axes": [[JOY_AXIS_TRIGGER_LEFT, 1.0]], "mouse": [MOUSE_BUTTON_RIGHT]},
	"next_slot": {"buttons": [JOY_BUTTON_RIGHT_SHOULDER, JOY_BUTTON_DPAD_RIGHT]},
	"prev_slot": {"buttons": [JOY_BUTTON_LEFT_SHOULDER, JOY_BUTTON_DPAD_LEFT]},
	"pause": {"buttons": [JOY_BUTTON_START], "keys": [KEY_ESCAPE, KEY_ENTER]},
	"save": {"buttons": [JOY_BUTTON_BACK], "keys": [KEY_F5]},
	# Only acts while paused, so it cannot quit by accident mid-jump. It saves first.
	"quit": {"buttons": [JOY_BUTTON_Y], "keys": [KEY_Q]},
}


## The pads to read. Every connected pad is read. With none connected, device 0 is
## read anyway: on real hardware that costs nothing and reads as released, and it
## lets a test inject a pad's events and have the game see them.
static func pads() -> Array:
	var connected := Input.get_connected_joypads()
	return connected if not connected.is_empty() else [0]


static func is_down(action: String) -> bool:
	var control: Dictionary = CONTROLS[action]
	for key in control.get("keys", []):
		if Input.is_key_pressed(key):
			return true
	for button in control.get("mouse", []):
		if Input.is_mouse_button_pressed(button):
			return true
	for pad in pads():
		for button in control.get("buttons", []):
			if Input.is_joy_button_pressed(pad, button):
				return true
		for axis in control.get("axes", []):
			if Input.get_joy_axis(pad, axis[0]) * axis[1] > AXIS_THRESHOLD:
				return true
	return false
