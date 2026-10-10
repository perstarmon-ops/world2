## What you are carrying: a hotbar of nine slots, and the storage behind it.
##
## A slot holds one of two things. A tool, which is a name ("pickaxe", "axe",
## "shovel", "sword"), or a stack of one block. The four tools start in the first
## four hotbar slots, as they do in the web game, and mined blocks fill the first
## empty slot, or join a stack of the same block.
class_name Inventory
extends RefCounted

const TOOLS := ["pickaxe", "axe", "shovel", "sword"]
const SLOT_COUNT := 36

var _slots: Array = []
var selected := 0


func _init() -> void:
	_slots.resize(SLOT_COUNT)
	for i in TOOLS.size():
		_slots[i] = {"tool": TOOLS[i]}


func get_slot(index: int) -> Variant:
	if index < 0 or index >= SLOT_COUNT:
		return null
	return _slots[index]


func select(index: int) -> void:
	if index >= 0 and index < K.HOTBAR_SIZE:
		selected = index


## Moves the selection along the hotbar, wrapping at either end.
func cycle(step: int) -> void:
	selected = posmod(selected + step, K.HOTBAR_SIZE)


## The tool in the selected slot, or "" for none. Mining bare-handed is slower.
func selected_tool() -> String:
	var slot = _slots[selected]
	if slot is Dictionary and slot.has("tool"):
		return slot["tool"]
	return ""


## The block in the selected slot, or -1 if it holds a tool or nothing.
func selected_block() -> int:
	var slot = _slots[selected]
	if slot is Dictionary and slot.has("block"):
		return slot["block"]
	return -1


## Adds one of a block. Stacks onto an existing stack first, so the hotbar fills
## with distinct blocks, not one stack per block mined.
func add(block: int, count: int = 1) -> void:
	if count <= 0 or not Blocks.is_placeable(block):
		return
	for i in SLOT_COUNT:
		var slot = _slots[i]
		if slot is Dictionary and slot.get("block", -1) == block:
			slot["count"] += count
			return
	for i in SLOT_COUNT:
		if _slots[i] == null:
			_slots[i] = {"block": block, "count": count}
			return


## Uses one of the selected block. Returns false if there is none to use.
func consume_selected() -> bool:
	var slot = _slots[selected]
	if not (slot is Dictionary and slot.has("block")):
		return false
	slot["count"] -= 1
	if slot["count"] <= 0:
		_slots[selected] = null
	return true


func snapshot() -> Array:
	return _slots.duplicate(true)


## Restores a saved snapshot. Anything that does not fit the slot count is ignored,
## and numbers come back from JSON as floats, so block ids and counts are made
## whole here.
func restore(saved: Array) -> void:
	_slots.fill(null)
	for i in mini(saved.size(), SLOT_COUNT):
		var slot = saved[i]
		if not (slot is Dictionary):
			continue
		if slot.has("tool"):
			_slots[i] = {"tool": String(slot["tool"])}
		elif slot.has("block"):
			_slots[i] = {"block": int(slot["block"]), "count": int(slot.get("count", 1))}
