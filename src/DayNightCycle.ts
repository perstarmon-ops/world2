import * as THREE from "three";

/** Full day+night loop length. Night falls at the halfway point. */
const CYCLE_SECONDS = 40 * 60;

const DAY_SKY = new THREE.Color(0x8fd0ff);
const NIGHT_SKY = new THREE.Color(0x060a18);
const DAY_HEMI_SKY = new THREE.Color(0xbfe3ff);
const NIGHT_HEMI_SKY = new THREE.Color(0x1a2340);
const DAY_HEMI_GROUND = new THREE.Color(0x4a6b3a);
const NIGHT_HEMI_GROUND = new THREE.Color(0x0e1710);
const SUN_COLOR = new THREE.Color(0xfff3d6);
const MOON_COLOR = new THREE.Color(0xaebfe0);

// Visible sun/moon discs are billboards placed far from the camera along the
// same direction each frame, like a skybox, so they never appear to move
// relative to the horizon as the player walks around.
const SKY_DISTANCE = 180;
const SUN_SIZE = 26;
const MOON_SIZE = 20;

function makeGlowSprite(
  coreColor: string,
  glowColor: string,
  size: number,
): { sprite: THREE.Sprite; material: THREE.SpriteMaterial } {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, coreColor);
  gradient.addColorStop(0.35, coreColor);
  gradient.addColorStop(0.6, glowColor);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return { sprite, material };
}

/**
 * Drives sky color, fog, and lighting through a repeating day/night loop.
 * `daylight` runs 1 (noon) -> 0 (midnight, at the CYCLE_SECONDS/2 mark) -> 1,
 * so night reliably falls twenty minutes after the world loads.
 */
export class DayNightCycle {
  private time = 0;
  private readonly sunSprite: THREE.Sprite;
  private readonly sunMaterial: THREE.SpriteMaterial;
  private readonly moonSprite: THREE.Sprite;
  private readonly moonMaterial: THREE.SpriteMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly fog: THREE.Fog,
    private readonly hemiLight: THREE.HemisphereLight,
    private readonly sunLight: THREE.DirectionalLight,
    private readonly ambientLight: THREE.AmbientLight,
    private readonly orbitRadius: number,
    private readonly cycleSeconds: number = CYCLE_SECONDS,
  ) {
    const sun = makeGlowSprite("rgba(255,250,230,1)", "rgba(255,214,120,0.6)", SUN_SIZE);
    this.sunSprite = sun.sprite;
    this.sunMaterial = sun.material;
    const moon = makeGlowSprite("rgba(235,240,255,1)", "rgba(180,195,230,0.5)", MOON_SIZE);
    this.moonSprite = moon.sprite;
    this.moonMaterial = moon.material;
    this.scene.add(this.sunSprite);
    this.scene.add(this.moonSprite);
  }

  update(dt: number, cameraPosition?: THREE.Vector3): void {
    this.time += dt;
    const phase = (this.time % this.cycleSeconds) / this.cycleSeconds;
    const daylight = (Math.cos(phase * Math.PI * 2) + 1) / 2;

    const skyColor = DAY_SKY.clone().lerp(NIGHT_SKY, 1 - daylight);
    this.scene.background = skyColor;
    this.fog.color.copy(skyColor);

    this.hemiLight.color.copy(DAY_HEMI_SKY).lerp(NIGHT_HEMI_SKY, 1 - daylight);
    this.hemiLight.groundColor.copy(DAY_HEMI_GROUND).lerp(NIGHT_HEMI_GROUND, 1 - daylight);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.15, 0.9, daylight);

    this.ambientLight.intensity = THREE.MathUtils.lerp(0.08, 0.25, daylight);

    const azimuth = phase * Math.PI * 2;
    const height = THREE.MathUtils.lerp(-30, this.orbitRadius * 0.6, daylight);
    this.sunLight.position.set(
      Math.cos(azimuth) * this.orbitRadius,
      height,
      Math.sin(azimuth) * this.orbitRadius * 0.4 + this.orbitRadius * 0.2,
    );
    this.sunLight.color.copy(SUN_COLOR).lerp(MOON_COLOR, 1 - daylight);
    this.sunLight.intensity = THREE.MathUtils.lerp(0.12, 1.1, daylight);

    // Sun/moon travel a great circle overhead: at phase 0 (noon) the sun sits
    // at zenith with daylight=1; at phase 0.5 (midnight) it's at nadir and the
    // moon (the opposite direction) is at zenith instead.
    const skyAngle = phase * Math.PI * 2;
    const dx = Math.sin(skyAngle);
    const dy = Math.cos(skyAngle);
    const dz = 0.15;
    const len = Math.hypot(dx, dy, dz);
    const ux = dx / len;
    const uy = dy / len;
    const uz = dz / len;

    const origin = cameraPosition ?? this.sunLight.target.position;
    this.sunSprite.position.set(origin.x + ux * SKY_DISTANCE, origin.y + uy * SKY_DISTANCE, origin.z + uz * SKY_DISTANCE);
    this.moonSprite.position.set(origin.x - ux * SKY_DISTANCE, origin.y - uy * SKY_DISTANCE, origin.z - uz * SKY_DISTANCE);
    this.sunMaterial.opacity = Math.max(0, daylight);
    this.moonMaterial.opacity = Math.max(0, 1 - daylight);
  }

  /** A 24-hour clock reading where phase 0 (world load) is noon and the halfway point is midnight. */
  getClockText(): string {
    const phase = (this.time % this.cycleSeconds) / this.cycleSeconds;
    const hour24 = (phase * 24 + 12) % 24;
    const h = Math.floor(hour24);
    const m = Math.floor((hour24 - h) * 60);
    const icon = h >= 6 && h < 18 ? "☀" : "🌙";
    return `${icon} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}
