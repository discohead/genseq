import { EventEmitter } from 'events';

export interface ClockConfig {
  bpm: number;
  ppq: number;
  timeSignature?: { numerator: number; denominator: number };
}

export interface ClockPosition {
  bar: number;
  beat: number;
  tick: number;
}

/**
 * T016: High-resolution Clock implementation
 *
 * Performance requirement: <1ms jitter variance over 10 minutes
 * Uses process.hrtime.bigint() for sub-millisecond precision
 */
export class Clock extends EventEmitter {
  private bpm: number;
  private ppq: number;
  private timeSignature: { numerator: number; denominator: number };
  private playing: boolean = false;
  private startTime: bigint | null = null;
  private currentTick: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private lastTickTime: number = 0;

  constructor(config: ClockConfig) {
    super();

    // Validate BPM - must be defined and within reasonable range
    if (config.bpm === undefined || config.bpm === null || config.bpm <= 0 || config.bpm > 999999) {
      throw new Error(`Invalid BPM: ${config.bpm}. Must be between 1 and 999999.`);
    }

    // Validate PPQ
    if (config.ppq === undefined || config.ppq === null || config.ppq <= 0 || !Number.isInteger(config.ppq)) {
      throw new Error(`Invalid PPQ: ${config.ppq}. Must be a positive integer.`);
    }

    this.bpm = config.bpm;
    this.ppq = config.ppq;
    this.timeSignature = config.timeSignature || { numerator: 4, denominator: 4 };
  }

  start(): void {
    if (this.playing) {
      return;
    }

    this.playing = true;
    this.startTime = process.hrtime.bigint();
    this.lastTickTime = performance.now();
    this.currentTick = 0;

    // Calculate interval in milliseconds per tick
    const msPerBeat = (60 * 1000) / this.bpm;
    const msPerTick = msPerBeat / this.ppq;

    // Use precise interval timing
    let expectedNextTick = this.lastTickTime + msPerTick;

    const tick = () => {
      if (!this.playing) {
        return;
      }

      const now = performance.now();

      // Emit tick if we've reached or passed the expected time
      if (now >= expectedNextTick) {
        this.emit('tick', this.currentTick);
        this.currentTick++;

        // Calculate next expected tick time
        expectedNextTick += msPerTick;
      }

      // Schedule next check with high precision
      setTimeout(tick, Math.max(0, expectedNextTick - performance.now() - 0.5));
    };

    tick();
  }

  stop(): void {
    this.playing = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentTick = 0;
  }

  setBpm(bpm: number): void {
    if (bpm <= 0 || bpm > 999999) {
      throw new Error(`Invalid BPM: ${bpm}`);
    }

    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.stop();
    }

    this.bpm = bpm;

    if (wasPlaying) {
      this.start();
    }
  }

  getBpm(): number {
    return this.bpm;
  }

  getPpq(): number {
    return this.ppq;
  }

  getPosition(): ClockPosition {
    const ticksPerBeat = this.ppq;
    const beatsPerBar = this.timeSignature.numerator;
    const ticksPerBar = ticksPerBeat * beatsPerBar;

    const bar = Math.floor(this.currentTick / ticksPerBar) + 1;
    const tickInBar = this.currentTick % ticksPerBar;
    const beat = Math.floor(tickInBar / ticksPerBeat) + 1;
    const tick = tickInBar % ticksPerBeat;

    return { bar, beat, tick };
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
