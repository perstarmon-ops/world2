/**
 * Short percussive sound effects synthesized via the Web Audio API (no
 * external audio files): a knock for each mining hit, a crunch when a
 * block breaks, and a soft tap for footsteps.
 */
export class Sfx {
  private readonly ctx = new AudioContext();
  private readonly master: GainNode;
  private started = false;

  constructor() {
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  /** Must be called from a user gesture - browsers block audio until then. */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private noiseBurst(
    time: number,
    dur: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    peak: number,
    q = 1,
  ): void {
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    src.start(time);
    src.stop(time + dur + 0.02);
  }

  /** A single knock against the block being mined. */
  mineHit(): void {
    if (!this.started) return;
    const freq = 900 + Math.random() * 500;
    this.noiseBurst(this.ctx.currentTime, 0.06, freq, "bandpass", 0.35, 1.2);
  }

  /** The crunch when a block finally breaks. */
  blockBreak(): void {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    this.noiseBurst(now, 0.18, 500, "lowpass", 0.4);
    this.noiseBurst(now + 0.01, 0.1, 1800, "bandpass", 0.25, 1.5);
  }

  /** A soft footstep tap. */
  footstep(): void {
    if (!this.started) return;
    const freq = 180 + Math.random() * 60;
    this.noiseBurst(this.ctx.currentTime, 0.08, freq, "lowpass", 0.18);
  }
}
