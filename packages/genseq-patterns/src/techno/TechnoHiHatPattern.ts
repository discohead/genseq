/**
 * TechnoHiHatPattern - Multi-layer hi-hat generator (US2)
 *
 * Creates driving hi-hat patterns with closed, open, and ride layers.
 * Supports swing, ghost notes, and density control.
 */

import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';
import type { TechnoHiHatConfig } from './types';
import { TECHNO_DEFAULTS } from './types';

/**
 * TechnoHiHatPattern class
 *
 * Generates multi-layer hi-hat patterns with:
 * - Closed hi-hat at configurable positions (offbeat, onbeat, all-8th, all-16th)
 * - Open hi-hat on specific beats (overrides closed)
 * - Ride cymbal with density control
 * - Swing for groove
 * - Ghost notes for humanization
 */
export class TechnoHiHatPattern {
  private config: TechnoHiHatConfig;
  private lastStep: number = -1;

  constructor(config: TechnoHiHatConfig) {
    this.config = this.mergeWithDefaults(config);
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: TechnoHiHatConfig): TechnoHiHatConfig {
    return {
      ...TECHNO_DEFAULTS.hiHat,
      ...config,
      closed: { ...TECHNO_DEFAULTS.hiHat.closed, ...config.closed },
      open: { ...TECHNO_DEFAULTS.hiHat.open, ...config.open },
      ride: { ...TECHNO_DEFAULTS.hiHat.ride, ...config.ride },
    };
  }

  /**
   * Get pattern length in bars
   */
  getLength(): number {
    return this.config.length;
  }

  /**
   * Get current swing amount
   */
  getSwing(): number {
    return this.config.swing;
  }

  /**
   * Calculate current step in 16th notes
   */
  private calculateStep(context: PatternContext): number {
    const { position, ppq } = context;
    const ticksPerSixteenth = ppq / 4;
    const ticksPerBar = ppq * 4;

    const totalTicks =
      ((position.bar - 1) * ticksPerBar) +
      ((position.beat - 1) * ppq) +
      position.tick;

    const patternTicks = this.config.length * ticksPerBar;
    const positionInPattern = totalTicks % patternTicks;

    return Math.floor(positionInPattern / ticksPerSixteenth);
  }

  /**
   * Check if step is a closed hi-hat position based on position mode
   */
  private isClosedPosition(step: number): boolean {
    const position = this.config.closed.position;
    const stepInBar = step % 16;

    switch (position) {
      case 'offbeat':
        // Offbeat 8ths: steps 2, 6, 10, 14 (the "and" of each beat)
        return stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14;

      case 'onbeat':
        // On beats 1, 2, 3, 4: steps 0, 4, 8, 12
        return stepInBar % 4 === 0;

      case 'all-8th':
        // All 8th notes: every other 16th (0, 2, 4, 6, 8, 10, 12, 14)
        return stepInBar % 2 === 0;

      case 'all-16th':
        // Every 16th note
        return true;

      default:
        return false;
    }
  }

  /**
   * Check if step is an open hi-hat position
   */
  private isOpenPosition(step: number, context: PatternContext): boolean {
    if (!this.config.open.enabled || this.config.open.pattern.length === 0) {
      return false;
    }

    // Open pattern specifies beats (1-4)
    const stepInBar = step % 16;
    const beat = Math.floor(stepInBar / 4) + 1;

    // Check if this is the first 16th of a beat in the open pattern
    return stepInBar % 4 === 0 && this.config.open.pattern.includes(beat);
  }

  /**
   * Check if density passes probability check
   */
  private passesDensity(density: number): boolean {
    if (density >= 100) return true;
    if (density <= 0) return false;
    return Math.random() * 100 < density;
  }

  /**
   * Apply swing offset to a tick position
   */
  private applySwing(step: number, baseTick: number, ppq: number): number {
    if (this.config.swing === 0) return baseTick;

    const stepInBar = step % 16;
    // Swing applies to every other 8th note (offbeats in 8th note grid)
    // In 16th notes, that's steps 2, 6, 10, 14
    const isSwungStep = stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14;

    if (!isSwungStep) return baseTick;

    // Calculate swing offset
    const maxSwingTicks = ppq / 4; // Max swing is a 16th note
    const swingOffset = Math.floor((this.config.swing / 100) * maxSwingTicks);

    return baseTick + swingOffset;
  }

  /**
   * Get velocity, possibly applying ghost note reduction
   */
  private getVelocity(baseVelocity: number): number {
    if (this.config.ghostProbability > 0) {
      if (Math.random() * 100 < this.config.ghostProbability) {
        return this.config.ghostVelocity;
      }
    }
    return baseVelocity;
  }

  /**
   * Generate MIDI events for current tick
   */
  tick(context: PatternContext): MidiEvent[] {
    const events: MidiEvent[] = [];
    const step = this.calculateStep(context);
    const { position, ppq } = context;

    // Only generate events on step change
    if (step === this.lastStep) {
      return [];
    }
    this.lastStep = step;

    // Calculate base tick
    const ticksPerBar = ppq * 4;
    const baseTick =
      ((position.bar - 1) * ticksPerBar) +
      ((position.beat - 1) * ppq) +
      position.tick;

    // Check for open hi-hat first (it overrides closed)
    const isOpenStep = this.isOpenPosition(step, context);

    if (isOpenStep) {
      const velocity = this.getVelocity(this.config.open.velocity);

      events.push({
        tick: baseTick,
        type: 'noteOn',
        note: this.config.open.note,
        velocity,
        channel: this.config.channel,
      });

      // Short duration for hi-hat
      const duration = Math.floor(ppq / 8);
      events.push({
        tick: baseTick + duration,
        type: 'noteOff',
        note: this.config.open.note,
        velocity: 0,
        channel: this.config.channel,
      });
    } else {
      // Closed hi-hat
      if (this.config.closed.enabled && this.isClosedPosition(step)) {
        if (this.passesDensity(this.config.closed.density)) {
          const velocity = this.getVelocity(this.config.closed.velocity);
          const swungTick = this.applySwing(step, baseTick, ppq);

          events.push({
            tick: swungTick,
            type: 'noteOn',
            note: this.config.closed.note,
            velocity,
            channel: this.config.channel,
          });

          const duration = Math.floor(ppq / 16);
          events.push({
            tick: swungTick + duration,
            type: 'noteOff',
            note: this.config.closed.note,
            velocity: 0,
            channel: this.config.channel,
          });
        }
      }
    }

    // Ride layer (independent of closed/open)
    if (this.config.ride.enabled && this.config.ride.density > 0) {
      // Ride typically plays on 8th notes
      const stepInBar = step % 16;
      if (stepInBar % 2 === 0 && this.passesDensity(this.config.ride.density)) {
        events.push({
          tick: baseTick,
          type: 'noteOn',
          note: this.config.ride.note,
          velocity: this.config.ride.velocity,
          channel: this.config.channel,
        });

        const duration = Math.floor(ppq / 8);
        events.push({
          tick: baseTick + duration,
          type: 'noteOff',
          note: this.config.ride.note,
          velocity: 0,
          channel: this.config.channel,
        });
      }
    }

    return events;
  }

  /**
   * Update configuration (for hot-reload)
   */
  updateConfig(config: Partial<TechnoHiHatConfig>): void {
    // Deep merge for nested layer configs
    if (config.closed) {
      this.config.closed = { ...this.config.closed, ...config.closed };
    }
    if (config.open) {
      this.config.open = { ...this.config.open, ...config.open };
    }
    if (config.ride) {
      this.config.ride = { ...this.config.ride, ...config.ride };
    }

    // Top-level properties
    if (config.enabled !== undefined) this.config.enabled = config.enabled;
    if (config.length !== undefined) this.config.length = config.length;
    if (config.bus !== undefined) this.config.bus = config.bus;
    if (config.channel !== undefined) this.config.channel = config.channel;
    if (config.swing !== undefined) this.config.swing = config.swing;
    if (config.ghostVelocity !== undefined) this.config.ghostVelocity = config.ghostVelocity;
    if (config.ghostProbability !== undefined) this.config.ghostProbability = config.ghostProbability;
  }

  /**
   * Reset pattern to beginning
   */
  reset(): void {
    this.lastStep = -1;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // No resources to clean up
  }
}

/**
 * Factory function for creating TechnoHiHat pattern generator
 */
export function createTechnoHiHatPattern(
  config: TechnoHiHatConfig
): PatternGeneratorFn {
  const pattern = new TechnoHiHatPattern(config);

  return (context: PatternContext): MidiEvent[] => {
    return pattern.tick(context);
  };
}
