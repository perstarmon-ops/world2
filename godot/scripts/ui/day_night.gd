## The sun, the sky and the light, through a forty-minute day.
##
## Time is a single number that wraps. Its phase, from zero to one, drives everything
## else: the sun's height, how bright the light is, and how blue or dark the sky and
## fog are. Noon is at the start, so a new world begins in full daylight, and
## midnight falls at the halfway mark.
##
## Nothing in here decides anything about the world. It only paints it, so it runs
## in the frame loop and not in the fixed simulation step.
class_name DayNight
extends RefCounted

const DAY_SKY := Color(0.56, 0.82, 1.0)
const NIGHT_SKY := Color(0.024, 0.039, 0.094)
const DAY_AMBIENT := Color(0.75, 0.89, 1.0)
const NIGHT_AMBIENT := Color(0.12, 0.16, 0.27)
const SUN_COLOR := Color(1.0, 0.95, 0.84)
## The sun's heading around the world, so shadows-free light still falls from one
## side rather than straight down.
const SUN_AZIMUTH := 0.6

var time_seconds := 0.0
## 1 at noon, 0 at midnight.
var daylight := 1.0

var _sun: DirectionalLight3D
var _environment: Environment


func _init(sun: DirectionalLight3D, environment: Environment) -> void:
	_sun = sun
	_environment = environment


func update(dt: float) -> void:
	time_seconds = fposmod(time_seconds + dt, K.DAY_CYCLE_SECONDS)
	var phase := phase_of(time_seconds)
	daylight = clampf(0.5 + 0.5 * cos(TAU * phase), 0.0, 1.0)

	# A DirectionalLight3D shines down its own -Z, so tilting it by -90° points it
	# straight down at noon and by +90° points it up through the ground at midnight.
	_sun.rotation = Vector3(-(PI / 2.0 - TAU * phase), SUN_AZIMUTH, 0.0)
	_sun.light_energy = daylight
	_sun.light_color = SUN_COLOR

	var sky := NIGHT_SKY.lerp(DAY_SKY, daylight)
	_environment.background_color = sky
	_environment.fog_light_color = sky
	_environment.ambient_light_color = NIGHT_AMBIENT.lerp(DAY_AMBIENT, daylight)


static func phase_of(seconds: float) -> float:
	return seconds / K.DAY_CYCLE_SECONDS


## The time of day as a clock, starting at noon. A day is twenty-four in-world hours
## over forty real minutes.
func clock_text() -> String:
	var hour := fposmod(12.0 + 24.0 * phase_of(time_seconds), 24.0)
	var whole := floori(hour)
	var minute := floori((hour - whole) * 60.0)
	return "%02d:%02d" % [whole, minute]
