## Numbers that more than one file has an opinion about.
##
## The world has the same shape as the web game it was ported from: 8 by 8 chunks
## of 16 blocks, 48 blocks tall, with sea level at 17. Seed 1337 is the web game's
## seed too, though the noise differs, so the land is shaped the same but not
## identical.
##
## The movement numbers are the web player's, kept as they were. The arithmetic
## is written beside each one, because the next person who nudges one should be
## able to see what it changes.
class_name K
extends RefCounted

## World shape.
const CHUNK_SIZE := 16
const WORLD_HEIGHT := 48
const WORLD_CHUNKS := 8
const WORLD_SIZE := CHUNK_SIZE * WORLD_CHUNKS
const SEA_LEVEL := 17
const DEFAULT_SEED := 1337

## Movement. A tapped jump clears JUMP_SPEED² / (2 · GRAVITY) = 81 / 56 ≈ 1.45
## blocks. Falling never exceeds FALL_SPEED_MAX, which at 60 Hz is under one block
## a step, so a body cannot tunnel through a floor.
const GRAVITY := 28.0
const JUMP_SPEED := 9.0
const WALK_SPEED := 5.2
const SPRINT_SPEED := 8.2
const CROUCH_SPEED := 2.6
const SWIM_SPEED := 3.2
const SWIM_ACCEL := 16.0
const SWIM_RISE_MAX := 3.2
const WATER_GRAVITY_SCALE := 0.25
const FALL_SPEED_MAX := 40.0
const PLAYER_RADIUS := 0.3
const PLAYER_HEIGHT := 1.8
const EYE_HEIGHT := 1.62
const CROUCH_EYE_OFFSET := 0.3
const STEP_HEIGHT := 1.02
const GROUND_PROBE := 0.02
const VOID_Y := -10.0

## Interaction. A mined block takes hardness ÷ speed seconds; speed is 1 by hand,
## TOOL_BONUS_SPEED with the right tool, and HAND_MINING_SPEED with nothing held.
const REACH := 6.0
const TOOL_BONUS_SPEED := 2.0
const HAND_MINING_SPEED := 0.6
const WATER_MINING_SPEED := 0.35
const HOTBAR_SIZE := 9

## Look. Radians per second for the stick, radians per pixel for the mouse.
const STICK_LOOK_SPEED := 2.6
const MOUSE_LOOK_SENSITIVITY := 0.0025
const PITCH_LIMIT := 1.5

## Rendering. The sky and fog begin and end at the same fractions of the render
## distance the web game used.
const RENDER_DISTANCE := 220.0
const FOG_BEGIN := 66.0
const FOG_END := 120.0

## A full day is forty minutes. Noon is at the start, midnight at the halfway mark.
const DAY_CYCLE_SECONDS := 40.0 * 60.0
