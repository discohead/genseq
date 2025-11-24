import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';

export interface EuclideanPatternConfig {
  steps: number;
  pulses: number;
  rotation: number;
  note: number;
  velocity: number | number[];
  duration: number; // in beats
}

/**
 * T026: EuclideanPattern implementation using Bjorklund algorithm
 *
 * Generates rhythmic patterns by distributing pulses evenly across steps.
 * Classic examples:
 * - [4,16] = kick drum pattern
 * - [3,8] = tresillo rhythm
 * - [5,8] = cinquillo rhythm
 */
export class EuclideanPattern {
  private config: EuclideanPatternConfig;
  private pattern: boolean[];
  private currentStep: number = 0;

  constructor(config: EuclideanPatternConfig) {
    this.config = config;
    this.pattern = this.generatePattern();
  }

  /**
   * Generate Euclidean rhythm using Bjorklund algorithm
   */
  private generatePattern(): boolean[] {
    const { steps, pulses } = this.config;

    if (steps <= 0 || pulses < 0 || pulses > steps) {
      throw new Error(`Invalid Euclidean parameters: steps=${steps}, pulses=${pulses}`);
    }

    const pattern: boolean[] = new Array(steps).fill(false);

    if (pulses === 0) {
      return pattern;
    }

    if (pulses === steps) {
      return new Array(steps).fill(true);
    }

    // Bjorklund's algorithm - distribute pulses evenly
    const slope = steps / pulses;

    for (let i = 0; i < pulses; i++) {
      const index = Math.floor(i * slope);
      pattern[index] = true;
    }

    // Apply rotation
    return this.rotatePattern(pattern, this.config.rotation);
  }

  /**
   * Rotate pattern by specified amount
   */
  private rotatePattern(pattern: boolean[], rotation: number): boolean[] {
    if (rotation === 0 || pattern.length === 0) {
      return pattern;
    }

    const normalizedRotation = rotation % pattern.length;
    return [
      ...pattern.slice(normalizedRotation),
      ...pattern.slice(0, normalizedRotation)
    ];
  }

  /**
   * Get velocity for current step
   */
  private getVelocity(step: number): number {
    const { velocity } = this.config;

    if (Array.isArray(velocity)) {
      return velocity[step % velocity.length];
    }

    return velocity;
  }

  /**
   * Calculate current step based on position
   */
  private calculateStep(context: PatternContext): number {
    const { position, ppq } = context;
    const ticksPerStep = (ppq * 4) / this.config.steps; // 4 beats per bar
    const currentTick = ((position.bar - 1) * ppq * 4) + ((position.beat - 1) * ppq) + position.tick;
    return Math.floor(currentTick / ticksPerStep) % this.config.steps;
  }

  /**
   * Generate MIDI events for current tick
   */
  tick(context: PatternContext): MidiEvent[] {
    const step = this.calculateStep(context);

    // Only generate events when step changes
    if (step === this.currentStep) {
      return [];
    }

    this.currentStep = step;

    // Check if this step should trigger
    if (!this.pattern[step]) {
      return [];
    }

    const events: MidiEvent[] = [];
    const { position, ppq } = context;
    const currentTick = ((position.bar - 1) * ppq * 4) + ((position.beat - 1) * ppq) + position.tick;

    const velocity = this.getVelocity(step);

    // Note On event
    events.push({
      tick: currentTick,
      type: 'noteOn',
      note: this.config.note,
      velocity
    });

    // Calculate note-off time
    const durationTicks = Math.floor(this.config.duration * ppq);
    events.push({
      tick: currentTick + durationTicks,
      type: 'noteOff',
      note: this.config.note,
      velocity: 0
    });

    return events;
  }

  /**
   * Update configuration (for hot-reload)
   */
  updateConfig(config: Partial<EuclideanPatternConfig>): void {
    this.config = { ...this.config, ...config };

    // Regenerate pattern if steps, pulses, or rotation changed
    if (config.steps !== undefined || config.pulses !== undefined || config.rotation !== undefined) {
      this.pattern = this.generatePattern();
    }
  }

  /**
   * Get pattern visualization
   */
  getPattern(): boolean[] {
    return [...this.pattern];
  }

  /**
   * Reset to beginning
   */
  reset(): void {
    this.currentStep = 0;
  }
}

/**
 * Factory function for creating Euclidean pattern generator
 */
export function createEuclideanPattern(config: EuclideanPatternConfig): PatternGeneratorFn {
  const pattern = new EuclideanPattern(config);

  return (context: PatternContext) => {
    return pattern.tick(context);
  };
}
