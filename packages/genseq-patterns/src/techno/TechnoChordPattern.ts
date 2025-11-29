/**
 * TechnoChordPattern - Sparse syncopated chord stab generator (US3)
 *
 * Creates chord voicings with scale quantization and sparse rhythmic placement.
 * Supports inversions, spread control, and velocity curves.
 */

import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';
import type { TechnoChordConfig, VelocityCurve } from './types';
import { TECHNO_DEFAULTS } from './types';

/**
 * Scale intervals for quantization
 */
const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/**
 * TechnoChordPattern class
 *
 * Generates sparse chord stabs with scale quantization and velocity curves.
 */
export class TechnoChordPattern {
  private config: TechnoChordConfig;
  private lastStep: number = -1;

  constructor(config: TechnoChordConfig) {
    this.config = this.mergeWithDefaults(config);
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: TechnoChordConfig): TechnoChordConfig {
    return {
      ...TECHNO_DEFAULTS.chord,
      ...config,
      voicing: { ...TECHNO_DEFAULTS.chord.voicing, ...config.voicing },
      rhythm: { ...TECHNO_DEFAULTS.chord.rhythm, ...config.rhythm },
    };
  }

  /**
   * Get pattern length in bars
   */
  getLength(): number {
    return this.config.length;
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
   * Check if current step is a trigger position (1-indexed positions)
   */
  private isTriggerPosition(step: number): boolean {
    if (this.config.rhythm.positions.length === 0) {
      return false;
    }
    // Positions are 1-indexed, steps are 0-indexed
    const position = step + 1;
    return this.config.rhythm.positions.includes(position);
  }

  /**
   * Check if density probability passes
   */
  private passesDensity(): boolean {
    const density = this.config.rhythm.density;
    if (density >= 100) return true;
    if (density <= 0) return false;
    return Math.random() * 100 < density;
  }

  /**
   * Quantize a note to the configured scale
   */
  private quantizeToScale(note: number): number {
    const { root, scale } = this.config.voicing;
    const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.minor;

    // Get semitone offset from root
    const semitone = ((note - root) % 12 + 12) % 12;

    // Find nearest scale degree
    let nearestInterval = intervals[0];
    let minDistance = 12;

    for (const interval of intervals) {
      const distance = Math.min(
        Math.abs(semitone - interval),
        12 - Math.abs(semitone - interval)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestInterval = interval;
      }
    }

    // Calculate octave and return quantized note
    const octave = Math.floor((note - root) / 12);
    return root + (octave * 12) + nearestInterval;
  }

  /**
   * Generate chord notes based on voicing configuration
   */
  private generateChordNotes(): number[] {
    const { notes, root, spread, inversion } = this.config.voicing;
    const noteCount = Math.max(1, Math.min(notes, 4)); // Clamp to 1-4

    // Generate basic chord tones using spread
    const chordNotes: number[] = [];
    for (let i = 0; i < noteCount; i++) {
      const rawNote = root + (i * spread);
      chordNotes.push(this.quantizeToScale(rawNote));
    }

    // Apply inversion
    if (inversion > 0 && chordNotes.length > 1) {
      for (let i = 0; i < inversion && i < chordNotes.length - 1; i++) {
        // Move lowest note up an octave
        const lowest = chordNotes.shift()!;
        chordNotes.push(lowest + 12);
      }
    }

    // Sort for consistent ordering
    return chordNotes.sort((a, b) => a - b);
  }

  /**
   * Apply velocity curve to chord notes
   */
  private applyVelocityCurve(notes: number[], baseVelocity: number): number[] {
    const curve = this.config.velocityCurve;

    if (curve === 'flat' || notes.length <= 1) {
      return notes.map(() => baseVelocity);
    }

    const velocities: number[] = [];
    const count = notes.length;

    switch (curve) {
      case 'decay':
        // Highest velocity on bass, decreasing to treble
        for (let i = 0; i < count; i++) {
          const factor = 1 - (i / count) * 0.4; // Decay to 60%
          velocities.push(Math.round(baseVelocity * factor));
        }
        break;

      case 'accent-first':
        // First note accented, others softer
        for (let i = 0; i < count; i++) {
          const factor = i === 0 ? 1 : 0.75;
          velocities.push(Math.round(baseVelocity * factor));
        }
        break;

      default:
        return notes.map(() => baseVelocity);
    }

    return velocities;
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

    // Check if this step should trigger
    if (!this.isTriggerPosition(step)) {
      return [];
    }

    // Check density probability
    if (!this.passesDensity()) {
      return [];
    }

    // Calculate base tick with syncopation offset
    const ticksPerBar = ppq * 4;
    const baseTick =
      ((position.bar - 1) * ticksPerBar) +
      ((position.beat - 1) * ppq) +
      position.tick +
      this.config.rhythm.syncopation;

    // Generate chord notes
    const chordNotes = this.generateChordNotes();
    const velocities = this.applyVelocityCurve(chordNotes, this.config.velocity);

    // Duration in ticks
    const durationTicks = Math.floor(this.config.duration * ppq);

    // Generate note events
    for (let i = 0; i < chordNotes.length; i++) {
      const note = chordNotes[i];
      const velocity = velocities[i];

      // Note On
      events.push({
        tick: baseTick,
        type: 'noteOn',
        note,
        velocity,
        channel: this.config.channel,
      });

      // Note Off
      events.push({
        tick: baseTick + durationTicks,
        type: 'noteOff',
        note,
        velocity: 0,
        channel: this.config.channel,
      });
    }

    return events;
  }

  /**
   * Update configuration (for hot-reload)
   */
  updateConfig(config: Partial<TechnoChordConfig>): void {
    // Deep merge for nested configs
    if (config.voicing) {
      this.config.voicing = { ...this.config.voicing, ...config.voicing };
    }
    if (config.rhythm) {
      this.config.rhythm = { ...this.config.rhythm, ...config.rhythm };
    }

    // Top-level properties
    if (config.enabled !== undefined) this.config.enabled = config.enabled;
    if (config.length !== undefined) this.config.length = config.length;
    if (config.bus !== undefined) this.config.bus = config.bus;
    if (config.channel !== undefined) this.config.channel = config.channel;
    if (config.velocity !== undefined) this.config.velocity = config.velocity;
    if (config.duration !== undefined) this.config.duration = config.duration;
    if (config.velocityCurve !== undefined) this.config.velocityCurve = config.velocityCurve;
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
 * Factory function for creating TechnoChord pattern generator
 */
export function createTechnoChordPattern(
  config: TechnoChordConfig
): PatternGeneratorFn {
  const pattern = new TechnoChordPattern(config);

  return (context: PatternContext): MidiEvent[] => {
    return pattern.tick(context);
  };
}
