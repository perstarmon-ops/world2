## Everything drawn over the game: the crosshair, the hotbar, mining progress, the
## clock, and the pause screen.
##
## It reads what it is given and draws it. It does not know what a block is worth
## or whether you may mine it. The app pushes values in each frame and this redraws.
class_name Hud
extends Control

const SLOT := 72.0
const SLOT_GAP := 10.0
const TOOL_LABELS := {"pickaxe": "PICK", "axe": "AXE", "shovel": "SPADE", "sword": "SWORD"}
const TEXT := Color(1, 1, 1, 0.95)
const DIM := Color(0.0, 0.0, 0.0, 0.55)

var inventory: Inventory
var clock := ""
var mining := 0.0
var status := ""
var message := ""
var paused := false
var pause_lines: Array[String] = []


func _draw() -> void:
	var view := get_rect().size
	var centre := view * 0.5
	var font := ThemeDB.fallback_font

	_draw_crosshair(centre)
	if mining > 0.0:
		_draw_bar(centre + Vector2(-60, 34), 120.0, mining)
	if inventory != null:
		_draw_hotbar(view)
	draw_string(font, Vector2(24, 44), clock, HORIZONTAL_ALIGNMENT_LEFT, -1, 30, TEXT)
	if not message.is_empty():
		draw_string(font, Vector2(24, 84), message, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, TEXT)
	draw_string(font, Vector2(24, view.y - 24), status, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1, 1, 1, 0.6))
	if paused:
		_draw_pause(view)


func _draw_crosshair(centre: Vector2) -> void:
	var gap := 5.0
	var length := 12.0
	for direction in [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN]:
		draw_line(centre + direction * gap, centre + direction * (gap + length), TEXT, 2.0)


func _draw_bar(at: Vector2, width: float, fraction: float) -> void:
	draw_rect(Rect2(at, Vector2(width, 8)), DIM)
	draw_rect(Rect2(at, Vector2(width * clampf(fraction, 0.0, 1.0), 8)), TEXT)


func _draw_hotbar(view: Vector2) -> void:
	var font := ThemeDB.fallback_font
	var total := K.HOTBAR_SIZE * SLOT + (K.HOTBAR_SIZE - 1) * SLOT_GAP
	var left := (view.x - total) * 0.5
	var top := view.y - SLOT - 36.0
	for i in K.HOTBAR_SIZE:
		var box := Rect2(left + i * (SLOT + SLOT_GAP), top, SLOT, SLOT)
		draw_rect(box, DIM)
		var selected := i == inventory.selected
		draw_rect(box, Color(1, 0.9, 0.3) if selected else Color(1, 1, 1, 0.35), false, 4.0 if selected else 2.0)

		var slot = inventory.get_slot(i)
		if slot is Dictionary and slot.has("tool"):
			var label: String = TOOL_LABELS.get(slot["tool"], "")
			draw_string(font, box.position + Vector2(6, SLOT * 0.6), label, HORIZONTAL_ALIGNMENT_LEFT, SLOT - 12, 16, TEXT)
		elif slot is Dictionary and slot.has("block"):
			draw_rect(box.grow(-14), Blocks.color(slot["block"]))
			draw_string(font, box.position + Vector2(SLOT - 6, SLOT - 8), str(slot["count"]), HORIZONTAL_ALIGNMENT_RIGHT, -1, 18, TEXT)


func _draw_pause(view: Vector2) -> void:
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, view), Color(0, 0, 0, 0.6))
	draw_string(font, Vector2(view.x * 0.5 - 200, view.y * 0.36), "Mine And Craft", HORIZONTAL_ALIGNMENT_CENTER, 400, 56, TEXT)
	var y := view.y * 0.36 + 80.0
	for line in pause_lines:
		draw_string(font, Vector2(view.x * 0.5 - 300, y), line, HORIZONTAL_ALIGNMENT_LEFT, 600, 26, TEXT)
		y += 40.0
