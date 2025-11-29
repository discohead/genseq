/**
 * TechnoKickBassPattern - Combined kick drum and bass line generator (US1)
 *
 * Creates foundational 4-on-the-floor kick with interlocking bass lines.
 * Kick triggers on quarter notes with beat 1 accent.
 * Bass syncopates between kicks with configurable note sequence.
 */

import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';
import type { TechnoKickBassConfig } from './types';
import { TECHNO_DEFAULTS } from './types';

/**
 * TechnoKickBassPattern class
 *
 * Generates kick on quarter notes (beats 1,2,3,4) and bass at syncopated positions.
 * Supports velocity accents, multi-bar patterns, and hot-reload.
 */
export class TechnoKickBassPattern {
  private config: TechnoKickBassConfig;
  private bassNoteIndex: number = 0;
  private lastKickStep: number = -1;
  private lastBassStep: number = -1;

  constructor(config: TechnoKickBassConfig) {
    this.validateConfig(config);
    this.config = this.mergeWithDefaults(config);
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: TechnoKickBassConfig): TechnoKickBassConfig {
    return {
      ...TECHNO_DEFAULTS.kickBass,
      ...config,
      kick: { ...TECHNO_DEFAULTS.kickBass.kick, ...config.kick },
      bass: { ...TECHNO_DEFAULTS.kickBass.bass, ...config.bass },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: TechnoKickBassConfig): void {
    // Validate kick
    if (config.kick) {
      if (config.kick.note !== undefined && (config.kick.note < 0 || config.kick.note > 127)) {
        throw new Error(`Kick note must be between 0 and 127, got ${config.kick.note}`);
      }
      if (config.kick.channel !== undefined && (config.kick.channel < 1 || config.kick.channel > 16)) {
        throw new Error(`Kick channel must be between 1 and 16, got ${config.kick.channel}`);
      }
      if (config.kick.velocity !== undefined && (config.kick.velocity < 0 || config.kick.velocity > 127)) {
        throw new Error(`Kick velocity must be between 0 and 127, got ${config.kick.velocity}`);
      }
      if (config.kick.accentVelocity !== undefined && (config.kick.accentVelocity < 0 || config.kick.accentVelocity > 127)) {
        throw new Error(`Kick accent velocity must be between 0 and 127, got ${config.kick.accentVelocity}`);
      }
    }

    // Validate bass
    if (config.bass) {
      if (config.bass.channel !== undefined && (config.bass.channel < 1 || config.bass.channel > 16)) {
        throw new Error(`Bass channel must be between 1 and 16, got ${config.bass.channel}`);
      }
      if (config.bass.velocity !== undefined && (config.bass.velocity < 0 || config.bass.velocity > 127)) {
        throw new Error(`Bass velocity must be between 0 and 127, got ${config.bass.velocity}`);
      }
      if (config.bass.syncopation !== undefined && (config.bass.syncopation < 0 || config.bass.syncopation > 15)) {
        throw new Error(`Bass syncopation must be between 0 and 15, got ${config.bass.syncopation}`);
      }

      // Validate bass notes array
      if (config.bass.enabled !== false && config.bass.notes !== undefined) {
        if (config.bass.notes.length === 0) {
          throw new Error('Bass notes array cannot be empty when bass is enabled');
        }
        for (const note of config.bass.notes) {
          if (note < 0 || note > 127) {
            throw new Error(`Bass note must be between 0 and 127, got ${note}`);
          }
        }
      }
    }

    // Validate length
    if (config.length !== undefined && ![1, 2, 4].includes(config.length)) {
      throw new Error(`Pattern length must be 1, 2, or 4 bars, got ${config.length}`);
    }
  }

  /**
   * Get pattern length in bars
   */
  getLength(): number {
    return this.config.length;
  }

  /**
   * Calculate current position in 16th notes
   */
  private calculateStep(context: PatternContext): number {
    const { position, ppq } = context;
    const ticksPerSixteenth = ppq / 4;
    const ticksPerBar = ppq * 4;

    // Calculate total position in ticks
    const totalTicks =
      ((position.bar - 1) * ticksPerBar) +
      ((position.beat - 1) * ppq) +
      position.tick;

    // Pattern loops based on length
    const patternTicks = this.config.length * ticksPerBar;
    const positionInPattern = totalTicks % patternTicks;

    return Math.floor(positionInPattern / ticksPerSixteenth);
  }

  /**
   * Check if current position is a kick position (quarter notes = every 4th 16th)
   */
  private isKickPosition(step: number): boolean {
    return step % 4 === 0;
  }

  /**
   * Check if current position is a bass position
   */
  private isBassPosition(step: number): boolean {
    const syncopation = this.config.bass.syncopation;
    // Bass triggers at syncopation offset from each quarter note
    return (step - syncopation + 16) % 4 === 0;
  }

  /**
   * Get the beat number (1-4) for a given step
   */
  private getBeatNumber(step: number, context: PatternContext): number {
    const stepsPerBar = 16; // 16 sixteenths per bar
    const stepInBar = step % stepsPerBar;
    return Math.floor(stepInBar / 4) + 1;
  }

  /**
   * Generate MIDI events for current tick
   */
  tick(context: PatternContext): MidiEvent[] {
    const events: MidiEvent[] = [];
    const step = this.calculateStep(context);
    const { position, ppq } = context;

    // Calculate absolute tick for event scheduling
    const ticksPerBar = ppq * 4;
    const currentTick =
      ((position.bar - 1) * ticksPerBar) +
      ((position.beat - 1) * ppq) +
      position.tick;

    // Kick on quarter notes (beats 1,2,3,4)
    if (this.config.kick.enabled && this.isKickPosition(step) && step !== this.lastKickStep) {
      this.lastKickStep = step;

      // Determine if this is beat 1 (accent)
      const beatNumber = this.getBeatNumber(step, context);
      const isAccentBeat = beatNumber === 1;
      const velocity = isAccentBeat
        ? this.config.kick.accentVelocity
        : this.config.kick.velocity;

      // Only add event if velocity > 0 (or always for accent)
      if (velocity > 0 || isAccentBeat) {
        // Note On
        events.push({
          tick: currentTick,
          type: 'noteOn',
          note: this.config.kick.note,
          velocity,
          channel: this.config.kick.channel,
        });

        // Note Off (short duration for kick - 1/16th note)
        const kickDuration = Math.floor(ppq / 4);
        events.push({
          tick: currentTick + kickDuration,
          type: 'noteOff',
          note: this.config.kick.note,
          velocity: 0,
          channel: this.config.kick.channel,
        });
      }
    }

    // Bass at syncopated positions
    if (this.config.bass.enabled && this.isBassPosition(step) && step !== this.lastBassStep) {
      this.lastBassStep = step;

      const bassNote = this.config.bass.notes[this.bassNoteIndex];
      const velocity = this.config.bass.velocity;

      if (velocity > 0) {
        // Note On
        events.push({
          tick: currentTick,
          type: 'noteOn',
          note: bassNote,
          velocity,
          channel: this.config.bass.channel,
        });

        // Note Off based on configured duration
        const durationTicks = Math.floor(this.config.bass.duration * ppq);
        events.push({
          tick: currentTick + durationTicks,
          type: 'noteOff',
          note: bassNote,
          velocity: 0,
          channel: this.config.bass.channel,
        });
      }

      // Advance to next bass note (loop)
      this.bassNoteIndex = (this.bassNoteIndex + 1) % this.config.bass.notes.length;
    }

    return events;
  }

  /**
   * Update configuration (for hot-reload)
   * Maintains phase by not resetting bass note index unless notes array changed
   */
  updateConfig(config: Partial<TechnoKickBassConfig>): void {
    // Check if bass notes explicitly changed (only if notes provided and different)
    const notesChanged =
      config.bass?.notes !== undefined &&
      (config.bass.notes.length !== this.config.bass.notes.length ||
        config.bass.notes.some((n, i) => n !== this.config.bass.notes[i]));

    // Deep merge - preserve existing nested values when not explicitly provided
    if (config.kick) {
      this.config.kick = { ...this.config.kick, ...config.kick };
    }
    if (config.bass) {
      // Preserve current notes if not explicitly provided in the update
      const newBass = { ...this.config.bass };
      if (config.bass.notes !== undefined) newBass.notes = config.bass.notes;
      if (config.bass.channel !== undefined) newBass.channel = config.bass.channel;
      if (config.bass.velocity !== undefined) newBass.velocity = config.bass.velocity;
      if (config.bass.duration !== undefined) newBass.duration = config.bass.duration;
      if (config.bass.syncopation !== undefined) newBass.syncopation = config.bass.syncopation;
      if (config.bass.octave !== undefined) newBass.octave = config.bass.octave;
      if (config.bass.enabled !== undefined) newBass.enabled = config.bass.enabled;
      this.config.bass = newBass;
    }

    // Update top-level properties
    if (config.enabled !== undefined) this.config.enabled = config.enabled;
    if (config.length !== undefined) this.config.length = config.length;
    if (config.bus !== undefined) this.config.bus = config.bus;

    // Only reset note index if notes array content actually changed
    if (notesChanged) {
      this.bassNoteIndex = 0;
    }
  }

  /**
   * Reset pattern to beginning
   */
  reset(): void {
    this.bassNoteIndex = 0;
    this.lastKickStep = -1;
    this.lastBassStep = -1;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // No resources to clean up
  }
}

/**
 * Factory function for creating TechnoKickBass pattern generator
 */
export function createTechnoKickBassPattern(
  config: TechnoKickBassConfig
): PatternGeneratorFn {
  const pattern = new TechnoKickBassPattern(config);

  return (context: PatternContext): MidiEvent[] => {
    return pattern.tick(context);
  };
}
