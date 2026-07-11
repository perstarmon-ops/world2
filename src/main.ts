import * as THREE from "three";
import { AnimalManager, NETHER_SPAWNS } from "./AnimalManager";
import { BlockType } from "./blocks";
import { ChunkMesher } from "./ChunkMesher";
import { DayNightCycle } from "./DayNightCycle";
import { Interaction } from "./Interaction";
import { Inventory } from "./Inventory";
import { Music } from "./Music";
import { Player } from "./Player";
import { PlayerPreview } from "./PlayerPreview";
import { ToolView } from "./ToolView";
import { UI } from "./ui";
import { World, WORLD_SIZE_X, WORLD_SIZE_Z } from "./World";

// Legacy (non-color-managed) pipeline: our block colors/textures are
// authored as plain sRGB bytes with no HDR workflow, so skip the
// linear-working-space conversions and render them as specified.
THREE.ColorManagement.enabled = false;

const RENDER_DISTANCE = 220;

const app = document.getElementById("app")!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const SKY_COLOR = 0x8fd0ff;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, RENDER_DISTANCE * 0.55, RENDER_DISTANCE);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  RENDER_DISTANCE,
);

const hemiLight = new THREE.HemisphereLight(0xbfe3ff, 0x4a6b3a, 0.9);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff3d6, 1.1);
sunLight.position.set(WORLD_SIZE_X * 0.4, 120, WORLD_SIZE_Z * 0.2);
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambientLight);

const dayNight = new DayNightCycle(
  scene,
  scene.fog as THREE.Fog,
  hemiLight,
  sunLight,
  ambientLight,
  Math.max(WORLD_SIZE_X, WORLD_SIZE_Z),
);

const overworld = new World(1337, "overworld");
const overworldMesher = new ChunkMesher(overworld, scene);
overworldMesher.buildAll();
const overworldAnimals = new AnimalManager(overworld, scene);

const nether = new World(4242, "nether");
const netherMesher = new ChunkMesher(nether, scene);
netherMesher.buildAll();
netherMesher.setVisible(false);
const netherAnimals = new AnimalManager(nether, scene, [BlockType.NETHERRACK], NETHER_SPAWNS, false);
netherAnimals.setActive(false);

const NETHER_SKY = new THREE.Color(0x2a0f0a);

const player = new Player(camera, renderer.domElement, overworld);
const music = new Music();

const inventory = new Inventory();
const ui = new UI(app, inventory, (mode) => player.setFlying(mode === "creative"));
const playerPreview = new PlayerPreview(ui.getPreviewCanvas());

const interaction = new Interaction(
  camera,
  player.controls,
  overworld,
  overworldMesher,
  player,
  inventory,
  overworldAnimals,
  renderer.domElement,
);

let inNether = false;
let portalCooldown = 0;
const PORTAL_COOLDOWN_SECONDS = 2;

/** Swaps which dimension the player, interaction, mesher visibility, and animals target. */
function enterDimension(next: World, nextMesher: ChunkMesher, nextAnimals: AnimalManager, goingToNether: boolean): void {
  const spawn = next.getPortalPosition();
  if (!spawn) return;

  player.setWorld(next);
  player.teleportTo(spawn[0], spawn[1], spawn[2]);
  interaction.setDimension(next, nextMesher, nextAnimals);

  overworldMesher.setVisible(!goingToNether);
  netherMesher.setVisible(goingToNether);
  overworldAnimals.setActive(!goingToNether);
  netherAnimals.setActive(goingToNether);

  inNether = goingToNether;
  portalCooldown = PORTAL_COOLDOWN_SECONDS;
  music.setMood(goingToNether ? "nether" : "overworld");
}

const toolView = new ToolView();
scene.add(toolView.group);

const targetOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
);
targetOutline.visible = false;
scene.add(targetOutline);

app.addEventListener("click", () => {
  music.start();
  if (ui.isModeChosen() && !ui.isInventoryOpen()) player.controls.lock();
});
player.controls.addEventListener("lock", () => ui.setLocked(true));
player.controls.addEventListener("unlock", () => {
  if (!ui.isInventoryOpen()) ui.setLocked(false);
});

window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyE") return;
  if (ui.isInventoryOpen()) {
    ui.toggleInventory();
    player.controls.lock();
  } else if (player.controls.isLocked) {
    ui.toggleInventory();
    player.controls.unlock();
  }
});

let musicMuted = false;
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") musicMuted = music.toggleMute();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let debugAccum = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  player.update(dt);

  if (inNether) {
    scene.background = NETHER_SKY;
    (scene.fog as THREE.Fog).color.copy(NETHER_SKY);
    netherAnimals.update(dt, player, 0);
  } else {
    dayNight.update(dt, camera.position);
    overworldAnimals.update(dt, player, dayNight.getDaylight());
  }

  portalCooldown = Math.max(0, portalCooldown - dt);
  if (portalCooldown === 0) {
    const activeWorld = inNether ? nether : overworld;
    const p = player.position;
    const block = activeWorld.getBlock(Math.floor(p.x), Math.floor(p.y + 0.9), Math.floor(p.z));
    if (block === BlockType.PORTAL) {
      if (inNether) enterDimension(overworld, overworldMesher, overworldAnimals, false);
      else enterDimension(nether, netherMesher, netherAnimals, true);
    }
  }

  const state = interaction.update(dt);
  toolView.update(dt, camera, state.mining, inventory.getSelectedTool(), state.attacked, inventory.getSelectedBlock());
  ui.setMiningProgress(state.mining ? state.progress : null);
  ui.refreshInventory();
  if (ui.isInventoryOpen()) playerPreview.update(dt);
  if (state.targetBlock) {
    targetOutline.position.set(state.targetBlock.x + 0.5, state.targetBlock.y + 0.5, state.targetBlock.z + 0.5);
    targetOutline.visible = true;
  } else {
    targetOutline.visible = false;
  }

  renderer.render(scene, camera);

  debugAccum += dt;
  if (debugAccum > 0.2) {
    debugAccum = 0;
    const p = player.getEyePosition();
    const fps = dt > 0 ? Math.round(1 / dt) : 0;
    ui.setDebugText(
      `VoxelCraft\nFPS ~${fps}\nX ${p.x.toFixed(1)}  Y ${p.y.toFixed(1)}  Z ${p.z.toFixed(1)}\nMusic ${musicMuted ? "off" : "on"} (M)`,
    );
    ui.setClock(dayNight.getClockText());
  }
}

animate();
