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

/**
 * Drives sky color, fog, and lighting through a repeating day/night loop.
 * `daylight` runs 1 (noon) -> 0 (midnight, at the CYCLE_SECONDS/2 mark) -> 1,
 * so night reliably falls twenty minutes after the world loads.
 */
export class DayNightCycle {
  private time = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly fog: THREE.Fog,
    private readonly hemiLight: THREE.HemisphereLight,
    private readonly sunLight: THREE.DirectionalLight,
    private readonly ambientLight: THREE.AmbientLight,
    private readonly orbitRadius: number,
    private readonly cycleSeconds: number = CYCLE_SECONDS,
  ) {}

  update(dt: number): void {
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
