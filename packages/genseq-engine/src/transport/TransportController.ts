import { EventEmitter } from 'events';
import type { Clock } from '../clock/Clock';
import type { Scheduler } from '../scheduler/Scheduler';

/**
 * T032: TransportController - manages transport state (start/stop/continue)
 *
 * Responsibilities:
 * - Control transport state (stopped, playing, paused)
 * - Coordinate Clock and Scheduler
 * - Handle position changes
 * - Support tap tempo
 * - Emit transport events
 */

export enum TransportState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused'
}

export interface TransportPosition {
  bar: number;
  beat: number;
  tick: number;
}

export interface TransportControllerConfig {
  clock: Clock;
  scheduler: Scheduler;
}

export class TransportController extends EventEmitter {
  private clock: Clock;
  private scheduler: Scheduler;
  private state: TransportState = TransportState.STOPPED;
  private startTime: number = 0;

  constructor(config: TransportControllerConfig) {
    super();
    this.clock = config.clock;
    this.scheduler = config.scheduler;
  }

  /**
   * Start transport from beginning
   */
  start(): void {
    if (this.state === TransportState.PLAYING) {
      return;
    }

    this.state = TransportState.PLAYING;
    this.startTime = performance.now();

    // Start clock and scheduler
    this.clock.start();
    this.scheduler.start();

    this.emit('start', { time: this.startTime });
  }

  /**
   * Stop transport and reset to beginning
   */
  stop(): void {
    if (this.state === TransportState.STOPPED) {
      return;
    }

    const previousState = this.state;
    this.state = TransportState.STOPPED;

    // Stop clock and scheduler
    this.clock.stop();
    this.scheduler.stop();

    // Clear scheduled events
    this.scheduler.clearAll();

    this.emit('stop', { previousState, time: performance.now() });
  }

  /**
   * Continue transport from current position (pause/resume)
   */
  continue(): void {
    if (this.state === TransportState.STOPPED) {
      // Same as start if stopped
      this.start();
      return;
    }

    if (this.state === TransportState.PAUSED) {
      this.state = TransportState.PLAYING;
      this.scheduler.resume();
      this.emit('continue', { time: performance.now() });
    }
  }

  /**
   * Pause transport at current position
   */
  pause(): void {
    if (this.state !== TransportState.PLAYING) {
      return;
    }

    this.state = TransportState.PAUSED;
    this.scheduler.pause();

    this.emit('pause', { time: performance.now() });
  }

  /**
   * Toggle between playing and paused
   */
  toggle(): void {
    if (this.state === TransportState.PLAYING) {
      this.pause();
    } else if (this.state === TransportState.PAUSED) {
      this.continue();
    } else {
      this.start();
    }
  }

  /**
   * Get current transport state
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Check if transport is playing
   */
  isPlaying(): boolean {
    return this.state === TransportState.PLAYING;
  }

  /**
   * Check if transport is stopped
   */
  isStopped(): boolean {
    return this.state === TransportState.STOPPED;
  }

  /**
   * Check if transport is paused
   */
  isPaused(): boolean {
    return this.state === TransportState.PAUSED;
  }

  /**
   * Get current position
   */
  getPosition(): TransportPosition {
    return this.clock.getPosition();
  }

  /**
   * Set BPM
   */
  setBpm(bpm: number): void {
    const wasPlaying = this.isPlaying();

    this.clock.setBpm(bpm);

    this.emit('bpmChanged', { bpm, wasPlaying });
  }

  /**
   * Get current BPM
   */
  getBpm(): number {
    return this.clock.getBpm();
  }

  /**
   * Get transport uptime in milliseconds
   */
  getUptime(): number {
    if (this.state === TransportState.STOPPED) {
      return 0;
    }

    return performance.now() - this.startTime;
  }

  /**
   * Tap tempo - call repeatedly to set BPM based on timing
   */
  private lastTapTime: number = 0;
  private tapTimes: number[] = [];

  tapTempo(): void {
    const now = performance.now();

    if (now - this.lastTapTime > 2000) {
      // Reset if more than 2 seconds since last tap
      this.tapTimes = [];
    }

    this.tapTimes.push(now);
    this.lastTapTime = now;

    if (this.tapTimes.length >= 2) {
      // Calculate average interval
      const intervals: number[] = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);

      if (bpm >= 20 && bpm <= 300) {
        this.setBpm(bpm);
        this.emit('tapTempo', { bpm, taps: this.tapTimes.length });
      }
    }

    // Keep only last 4 taps
    if (this.tapTimes.length > 4) {
      this.tapTimes.shift();
    }
  }
}
