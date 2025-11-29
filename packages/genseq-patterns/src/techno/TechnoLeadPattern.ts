/**
 * TechnoLeadPattern - Looping melodic phrase generator (US4)
 *
 * Creates hypnotic 5-8 note melodic phrases with scale quantization.
 * Supports fixed and generative modes, velocity contours, and phrase regeneration.
 */

import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';
import type { TechnoLeadConfig, VelocityContour, RegenerateMode } from './types';
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
 * TechnoLeadPattern class
 *
 * Generates looping melodic phrases with scale quantization and velocity contours.
 */
export class TechnoLeadPattern {
  private config: TechnoLeadConfig;
  private lastStep: number = -1;
  private phraseNotes: number[] = [];
  private phraseIndex: number = 0;
  private cycleCount: number = 0;

  constructor(config: TechnoLeadConfig) {
    this.config = this.mergeWithDefaults(config);
    this.generatePhrase();
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: TechnoLeadConfig): TechnoLeadConfig {
    return {
      ...TECHNO_DEFAULTS.lead,
      ...config,
      phrase: { ...TECHNO_DEFAULTS.lead.phrase, ...config.phrase },
      rhythm: { ...TECHNO_DEFAULTS.lead.rhythm, ...config.rhythm },
    };
  }

  /**
   * Get pattern length in bars
   */
  getLength(): number {
    return this.config.length;
  }

  /**
   * Generate or load the phrase notes
   */
  private generatePhrase(): void {
    if (this.config.phrase.mode === 'fixed' && this.config.phrase.notes.length > 0) {
      this.phraseNotes = [...this.config.phrase.notes];
    } else {
      this.phraseNotes = this.generateMelodicPhrase();
    }
  }

  /**
   * Generate a melodic phrase using scale quantization
   */
  private generateMelodicPhrase(): number[] {
    const { root, scale, octaveRange, length } = this.config.phrase;
    const phraseLength = Math.max(1, Math.min(length, 8));
    const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.minor;
    const notes: number[] = [];

    for (let i = 0; i < phraseLength; i++) {
      // Generate note within octave range
      const octaveOffset = Math.floor(Math.random() * (octaveRange + 1)) - Math.floor(octaveRange / 2);
      const scaleIndex = Math.floor(Math.random() * intervals.length);
      const note = root + (octaveOffset * 12) + intervals[scaleIndex];

      // Clamp to valid MIDI range
      notes.push(Math.max(0, Math.min(127, note)));
    }

    return notes;
  }

  /**
   * Quantize a note to the configured scale
   */
  private quantizeToScale(note: number): number {
    const { root, scale } = this.config.phrase;
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
   * Check if current step should trigger based on division
   */
  private isTriggerStep(step: number): boolean {
    const division = this.config.rhythm.division;
    // Division 16 = every step, 8 = every 2 steps, 4 = every 4 steps
    const stepInterval = 16 / division;
    return step % stepInterval === 0;
  }

  /**
   * Check if this step should be a rest
   */
  private isRest(): boolean {
    const restProb = this.config.rhythm.restProbability;
    if (restProb >= 100) return true;
    if (restProb <= 0) return false;
    return Math.random() * 100 < restProb;
  }

  /**
   * Get velocity based on contour and position in phrase
   */
  private getVelocity(phrasePosition: number): number {
    const { velocity, velocityContour } = this.config;
    const phraseLength = this.phraseNotes.length;

    switch (velocityContour) {
      case 'flat':
        return velocity;

      case 'accent-first':
        // First note full velocity, others reduced
        return phrasePosition === 0 ? velocity : Math.round(velocity * 0.75);

      case 'accent-last':
        // Last note full velocity, others reduced
        return phrasePosition === phraseLength - 1 ? velocity : Math.round(velocity * 0.75);

      case 'random':
        // Random variation around base velocity
        const variation = 0.3;
        const factor = 0.7 + (Math.random() * variation * 2);
        return Math.min(127, Math.round(velocity * factor));

      default:
        return velocity;
    }
  }

  /**
   * Calculate note duration with variation
   */
  private getDuration(ppq: number): number {
    const division = this.config.rhythm.division;
    const baseDuration = ppq * (4 / division); // Base duration in ticks

    // Apply duration variation
    const variation = this.config.rhythm.durationVariation / 100;
    if (variation > 0) {
      const variationAmount = (Math.random() - 0.5) * 2 * variation;
      return Math.max(1, Math.round(baseDuration * (1 + variationAmount)));
    }

    // Legato extends duration
    if (this.config.legato) {
      return Math.round(baseDuration * 1.2);
    }

    return Math.round(baseDuration * 0.9); // Slightly staccato by default
  }

  /**
   * Regenerate the phrase (for trigger mode or manual regeneration)
   */
  regenerate(): void {
    if (this.config.phrase.mode === 'generative') {
      this.phraseNotes = this.generateMelodicPhrase();
    }
    this.phraseIndex = 0;
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

    // Check if this step should trigger based on division
    if (!this.isTriggerStep(step)) {
      return [];
    }

    // Check for rest
    if (this.isRest()) {
      // Advance phrase index even on rest
      this.phraseIndex = (this.phraseIndex + 1) % this.phraseNotes.length;
      return [];
    }

    // Get current note from phrase
    const note = this.phraseNotes[this.phraseIndex];
    const velocity = this.getVelocity(this.phraseIndex);

    // Calculate tick position
    const ticksPerBar = ppq * 4;
    const currentTick =
      ((position.bar - 1) * ticksPerBar) +
      ((position.beat - 1) * ppq) +
      position.tick;

    // Calculate duration
    const duration = this.getDuration(ppq);

    // Note On
    events.push({
      tick: currentTick,
      type: 'noteOn',
      note,
      velocity,
      channel: this.config.channel,
    });

    // Note Off
    events.push({
      tick: currentTick + duration,
      type: 'noteOff',
      note,
      velocity: 0,
      channel: this.config.channel,
    });

    // Advance phrase index
    const prevIndex = this.phraseIndex;
    this.phraseIndex = (this.phraseIndex + 1) % this.phraseNotes.length;

    // Check for phrase cycle completion
    if (this.phraseIndex === 0 && prevIndex !== 0) {
      this.cycleCount++;

      // Regenerate on cycle if configured
      if (this.config.regenerateOn === 'cycle' && this.config.phrase.mode === 'generative') {
        this.phraseNotes = this.generateMelodicPhrase();
      }
    }

    return events;
  }

  /**
   * Update configuration (for hot-reload)
   */
  updateConfig(config: Partial<TechnoLeadConfig>): void {
    // Deep merge for nested configs
    if (config.phrase) {
      this.config.phrase = { ...this.config.phrase, ...config.phrase };
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
    if (config.velocityContour !== undefined) this.config.velocityContour = config.velocityContour;
    if (config.legato !== undefined) this.config.legato = config.legato;
    if (config.regenerateOn !== undefined) this.config.regenerateOn = config.regenerateOn;

    // Regenerate phrase if mode or notes changed
    if (config.phrase?.mode !== undefined || config.phrase?.notes !== undefined) {
      this.generatePhrase();
    }
  }

  /**
   * Reset pattern to beginning
   */
  reset(): void {
    this.lastStep = -1;
    this.phraseIndex = 0;
    this.cycleCount = 0;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // No resources to clean up
  }
}

/**
 * Factory function for creating TechnoLead pattern generator
 */
export function createTechnoLeadPattern(
  config: TechnoLeadConfig
): PatternGeneratorFn {
  const pattern = new TechnoLeadPattern(config);

  return (context: PatternContext): MidiEvent[] => {
    return pattern.tick(context);
  };
}
