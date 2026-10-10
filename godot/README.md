# Mine And Craft — the Godot port, for a Steam Machine

A Godot 4.3 port of the voxel sandbox in the repository root, built to run on
SteamOS and on the TV with a controller. The web game (Three.js) is unchanged and
still deploys from `main`; this is a separate build of the same world.

The shape follows [`perstarmon-ops/mario`](https://github.com/perstarmon-ops/mario):
text-only, every asset drawn or generated at runtime, the rules kept apart from the
drawing, the pad as the primary device, and checks that run headless in CI.

## Running it

```
godot --headless --path godot --import     # once, to write the class cache
godot --path godot                          # play
```

Godot 4.3 is required; the CI pins that version.

## Controls

| Action        | Controller                       | Keyboard / mouse            |
|---------------|----------------------------------|-----------------------------|
| Walk          | Left stick                       | WASD or arrows              |
| Look          | Right stick                      | Mouse                       |
| Jump          | A                                | Space                       |
| Sprint        | Press left stick                 | Shift                       |
| Crouch        | B                                | Ctrl                        |
| Dig           | Right trigger (hold)             | Left mouse (hold)           |
| Place         | Left trigger                     | Right mouse                 |
| Hotbar        | Bumpers, or D-pad left and right | Mouse wheel, or keys 1–9    |
| Pause         | Start                            | Escape or Enter             |
| Save          | Back (or Select)                 | F5                          |
| Save and quit | Y, while paused                  | Q, while paused             |

The grips on the back of a Steam Controller are paddles, and they match the buttons
beside them: Paddle 1 jumps, Paddle 2 sprints, Paddle 3 crouches. They are in
`scripts/core/bindings.gd`, alongside the buttons they match.

Every control is listed in `scripts/core/bindings.gd`. Change a button there and
nothing else needs to know.

## Steam Machine

The export is a single Linux x86-64 executable with the game embedded. To put it
in the library, add it through *Games → Add a Non-Steam Game* and pick the file.
Steam Input reads the controller and presents it as an Xbox pad, which is the
layout the bindings use.

The window starts fullscreen, because the Steam Machine is a TV. On a desktop it
fills the screen as well; `window/size/mode` in `project.godot` changes that.

## What is here, and what is not yet

Ported from the web game:

- The overworld: seeded terrain from two octaves of noise, stone and the diamond
  and gold ore beneath it, caves carved through the stone with entrances in the
  hillsides, trees, red and yellow flowers, a village of five houses on paths.
- Mining with the right tool, bare-handed, and in water, with the web game's
  speeds and hardness values. Placing into empty cells, never into yourself.
- The hotbar and the four starting tools, stacking blocks, selecting with the
  bumpers, the D-pad, the wheel or the number keys.
- A forty-minute day with its sun, sky and fog; the clock is on screen.
- Save and load to `user://save.json`, saved on demand and when the window closes.
- The controller, end to end, as the input test drives it.

Not yet ported, and left out rather than stubbed:

- The nether and its portal. Only the overworld is generated.
- Animals, zombies and the sword's attacks.
- Boats, beds, doors you can open, chests and their loot, furnaces, crafting.
- Health and hunger. Nothing can hurt you yet.
- The easter egg in the caves.
- Sound. The web game synthesises its own; this build is silent.
- Rebinding the controller from inside the game. The mapping is data, so it
  can be edited, but there is no screen for it yet.

The terrain uses Godot's noise, so the land has the web game's shape without being
the same land. The seed is the same number, 1337.

## Checks

```
godot --headless --path godot --script res://tests/world_test.gd     # terrain, features, mesh winding
godot --headless --path godot --script res://tests/physics_test.gd   # jumps, walls, step-ups, landing
godot --headless --path godot --script res://tests/rules_test.gd     # inventory, mining, placing, saves
godot --headless --path godot --script res://tests/input_test.gd     # a controller, end to end
```

Each exits non-zero on failure. CI (`.github/workflows/godot-checks.yml`) runs all
four, then runs the main scene for a few hundred frames, and fails the build on any
engine error in any of the logs. A warning that the game printed and carried on
from would otherwise pass every assertion and break on the TV.

## Releasing

`.github/workflows/godot-release.yml` reads `godot/VERSION`. A commit to `main`
that changes it to a version with no release yet builds the Linux export and
attaches it to a new GitHub Release. An ordinary commit publishes nothing.
