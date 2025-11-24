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
    this.validateConfig(config);
    this.config = config;
    this.pattern = this.generatePattern();
  }

  /**
   * Validate configuration parameters (T039)
   */
  private validateConfig(config: EuclideanPatternConfig): void {
    // Validate steps
    if (config.steps === undefined || config.steps === null) {
      throw new Error('Required parameter "steps" is missing');
    }
    if (typeof config.steps !== 'number') {
      throw new Error(`Steps must be a number, got ${typeof config.steps}`);
    }
    if (!Number.isInteger(config.steps)) {
      throw new Error(`Steps must be an integer, got ${config.steps}`);
    }
    if (config.steps <= 0) {
      throw new Error(`Steps must be greater than 0, got ${config.steps}`);
    }

    // Validate pulses
    if (config.pulses === undefined || config.pulses === null) {
      throw new Error('Required parameter "pulses" is missing');
    }
    if (typeof config.pulses !== 'number') {
      throw new Error(`Pulses must be a number, got ${typeof config.pulses}`);
    }
    if (!Number.isInteger(config.pulses)) {
      throw new Error(`Pulses must be an integer, got ${config.pulses}`);
    }
    if (config.pulses < 0) {
      throw new Error(`Pulses must be non-negative, got ${config.pulses}`);
    }
    if (config.pulses > config.steps) {
      throw new Error(
        `Pulses cannot exceed steps (pulses=${config.pulses}, steps=${config.steps})`
      );
    }

    // Validate rotation
    if (config.rotation === undefined || config.rotation === null) {
      throw new Error('Required parameter "rotation" is missing');
    }
    if (typeof config.rotation !== 'number') {
      throw new Error(`Rotation must be a number, got ${typeof config.rotation}`);
    }
    if (!Number.isInteger(config.rotation)) {
      throw new Error(`Rotation must be an integer, got ${config.rotation}`);
    }
    if (config.rotation < 0) {
      throw new Error(
        `Rotation must be non-negative, got ${config.rotation}`
      );
    }

    // Validate note
    if (config.note === undefined || config.note === null) {
      throw new Error('Required parameter "note" is missing');
    }
    if (typeof config.note !== 'number') {
      throw new Error(`Note must be a number, got ${typeof config.note}`);
    }
    if (config.note < 0 || config.note > 127) {
      throw new Error(
        `Note must be between 0 and 127, got ${config.note}`
      );
    }

    // Validate velocity
    if (config.velocity === undefined || config.velocity === null) {
      throw new Error('Required parameter "velocity" is missing');
    }
    if (typeof config.velocity !== 'number' && !Array.isArray(config.velocity)) {
      throw new Error(`Velocity must be a number or array, got ${typeof config.velocity}`);
    }
    if (typeof config.velocity === 'number') {
      if (config.velocity < 0 || config.velocity > 127) {
        throw new Error(
          `Velocity must be between 0 and 127, got ${config.velocity}`
        );
      }
    } else if (Array.isArray(config.velocity)) {
      for (let i = 0; i < config.velocity.length; i++) {
        const vel = config.velocity[i];
        if (typeof vel !== 'number' || vel < 0 || vel > 127) {
          throw new Error(
            `Velocity array item ${i} must be between 0 and 127, got ${vel}`
          );
        }
      }
    }

    // Validate duration
    if (config.duration === undefined || config.duration === null) {
      throw new Error('Required parameter "duration" is missing');
    }
    if (typeof config.duration !== 'number') {
      throw new Error(`Duration must be a number, got ${typeof config.duration}`);
    }
    if (config.duration <= 0) {
      throw new Error(
        `Duration must be greater than 0, got ${config.duration}`
      );
    }
  }

  /**
   * Generate Euclidean rhythm using Bjorklund algorithm
   */
  private generatePattern(): boolean[] {
    const { steps, pulses } = this.config;

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

  /**
   * T053: Cleanup resources (lifecycle consistency)
   */
  destroy(): void {
    // No resources to clean up for euclidean pattern
    // But method is required for consistent lifecycle API
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
