const OVERWORLD_SCALE = [0, 2, 4, 7, 9, 12, 16, 19];
const NETHER_SCALE = [0, 1, 3, 6, 7, 10];
const OVERWORLD_ROOT = 220;
const NETHER_ROOT = 110;

function semitoneToFreq(root: number, semitones: number): number {
  return root * Math.pow(2, semitones / 12);
}

type Mood = "overworld" | "nether";

/**
 * Fully synthesized ambient soundtrack (no external audio files) in the
 * spirit of a calm block-game score: a soft sustained pad under sparse
 * plucked notes, with long quiet gaps between pieces like the real thing.
 * The nether mood swaps in a darker scale and lower register.
 */
export class Music {
  private readonly ctx = new AudioContext();
  private readonly master: GainNode;
  private mood: Mood = "overworld";
  private started = false;
  private muted = false;
  private timer: number | null = null;

  constructor() {
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
  }

  /** Must be called from a user gesture - browsers block audio until then. */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.scheduleNext(1.5);
  }

  setMood(mood: Mood): void {
    this.mood = mood;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.32, this.ctx.currentTime, 0.2);
    return this.muted;
  }

  private scheduleNext(delaySeconds: number): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.playPiece(), delaySeconds * 1000);
  }

  private playPiece(): void {
    const duration = this.mood === "overworld" ? this.playOverworldPiece() : this.playNetherPiece();
    const silence = this.mood === "overworld" ? 25 + Math.random() * 35 : 15 + Math.random() * 20;
    this.scheduleNext(duration + silence);
  }

  private playPad(freqs: number[], time: number, dur: number, peak: number): void {
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = (i - freqs.length / 2) * 4;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peak, time + dur * 0.3);
      gain.gain.linearRampToValueAtTime(peak, time + dur * 0.7);
      gain.gain.linearRampToValueAtTime(0, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      osc.start(time);
      osc.stop(time + dur + 0.1);
    });
  }

  private playPluck(freq: number, time: number, dur: number, peak: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq * 4;
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private playOverworldPiece(): number {
    const now = this.ctx.currentTime;
    const duration = 30 + Math.random() * 16;
    const keyOffset = [0, -5, 3, -3][Math.floor(Math.random() * 4)];
    const root = OVERWORLD_ROOT * Math.pow(2, keyOffset / 12);

    this.playPad([0, 7, 12, 16].map((s) => semitoneToFreq(root, s)), now, duration, 0.05);

    let t = now + 1 + Math.random() * 2;
    while (t < now + duration - 2) {
      const degree = OVERWORLD_SCALE[Math.floor(Math.random() * OVERWORLD_SCALE.length)];
      const freq = semitoneToFreq(root * 2, degree);
      this.playPluck(freq, t, 1.6 + Math.random() * 1.2, 0.09 + Math.random() * 0.05);
      t += 1.6 + Math.random() * 2.2;
    }

    return duration;
  }

  private playNetherPiece(): number {
    const now = this.ctx.currentTime;
    const duration = 20 + Math.random() * 10;
    const keyOffset = [0, -2, 1][Math.floor(Math.random() * 3)];
    const root = NETHER_ROOT * Math.pow(2, keyOffset / 12);

    this.playPad([0, 1, 6, 12].map((s) => semitoneToFreq(root, s)), now, duration, 0.045);

    let t = now + 2 + Math.random() * 3;
    while (t < now + duration - 3) {
      const degree = NETHER_SCALE[Math.floor(Math.random() * NETHER_SCALE.length)];
      const freq = semitoneToFreq(root, degree);
      this.playPluck(freq, t, 2.5 + Math.random() * 2, 0.06 + Math.random() * 0.04);
      t += 3 + Math.random() * 4;
    }

    return duration;
  }
}
