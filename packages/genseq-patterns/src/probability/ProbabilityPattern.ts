import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';

export interface ProbabilityPatternConfig {
  probability: number; // 0.0 - 1.0
  density: number; // Notes per bar (4, 8, 16, 32)
  note: number;
  velocity: number | number[];
  duration: number; // in beats
  seed?: number; // Optional seed for deterministic randomness
  velocityModulation?: boolean; // Future: modulate velocity by probability
}

/**
 * T005: ProbabilityPattern implementation
 *
 * Generates rhythmic patterns by triggering events probabilistically at regular intervals.
 * Uses seeded RNG for deterministic randomness when testing.
 */
export class ProbabilityPattern {
  private config: ProbabilityPatternConfig;
  private currentStep: number = -1; // Start at -1 so first step triggers
  private rng: () => number;
  private triggerCount: number = 0;

  constructor(config: ProbabilityPatternConfig) {
    this.validateConfig(config);
    this.config = config;
    this.rng = this.createRNG(config.seed);
  }

  /**
   * Validate configuration parameters (T039)
   */
  private validateConfig(config: ProbabilityPatternConfig): void {
    // Validate probability
    if (config.probability === undefined || config.probability === null) {
      throw new Error('Required parameter "probability" is missing');
    }
    if (typeof config.probability !== 'number') {
      throw new Error(`Probability must be a number, got ${typeof config.probability}`);
    }
    if (config.probability < 0 || config.probability > 1) {
      throw new Error(
        `Probability must be between 0 and 1, got ${config.probability}`
      );
    }

    // Validate density
    if (config.density === undefined || config.density === null) {
      throw new Error('Required parameter "density" is missing');
    }
    if (typeof config.density !== 'number') {
      throw new Error(`Density must be a number, got ${typeof config.density}`);
    }
    if (config.density < 0 || config.density > 1) {
      throw new Error(
        `Density must be between 0 and 1, got ${config.density}`
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

    // Validate optional seed
    if (config.seed !== undefined && config.seed !== null) {
      if (typeof config.seed !== 'number') {
        throw new Error(`Seed must be a number, got ${typeof config.seed}`);
      }
      if (!Number.isInteger(config.seed)) {
        throw new Error(`Seed must be an integer, got ${config.seed}`);
      }
    }
  }

  /**
   * Create random number generator (seeded or Math.random)
   */
  private createRNG(seed?: number): () => number {
    if (seed === undefined) {
      return Math.random;
    }

    // Simple seeded RNG using Linear Congruential Generator
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * Get velocity for current trigger
   */
  private getVelocity(triggerIndex: number): number {
    const { velocity } = this.config;

    if (Array.isArray(velocity)) {
      return velocity[triggerIndex % velocity.length];
    }

    return velocity;
  }

  /**
   * Calculate current step based on position and density
   */
  private calculateStep(context: PatternContext): number {
    const { position, ppq } = context;
    const ticksPerStep = (ppq * 4) / this.config.density; // 4 beats per bar
    const currentTick =
      (position.bar - 1) * ppq * 4 + (position.beat - 1) * ppq + position.tick;
    return Math.floor(currentTick / ticksPerStep) % this.config.density;
  }

  /**
   * Generate MIDI events for current tick
   */
  tick(context: PatternContext): MidiEvent[] {
    const step = this.calculateStep(context);

    // Only evaluate probability when step changes
    if (step === this.currentStep) {
      return [];
    }

    this.currentStep = step;

    // Roll the dice
    const roll = this.rng();
    if (roll >= this.config.probability) {
      return [];
    }

    const events: MidiEvent[] = [];
    const { position, ppq } = context;
    const currentTick =
      (position.bar - 1) * ppq * 4 + (position.beat - 1) * ppq + position.tick;

    const velocity = this.getVelocity(this.triggerCount);
    this.triggerCount++;

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
  updateConfig(config: Partial<ProbabilityPatternConfig>): void {
    const newConfig = { ...this.config, ...config };
    this.validateConfig(newConfig);
    this.config = newConfig;

    // Reset RNG if seed changed
    if (config.seed !== undefined) {
      this.rng = this.createRNG(config.seed);
    }
  }

  /**
   * Reset to beginning
   */
  reset(): void {
    this.currentStep = -1; // Reset to -1 so first step triggers
    this.triggerCount = 0;
    this.rng = this.createRNG(this.config.seed);
  }

  /**
   * Destroy pattern instance (cleanup for type swaps)
   */
  destroy(): void {
    // No resources to clean up for probability pattern
    // But method is required for consistent lifecycle API
  }
}

/**
 * Factory function for creating Probability pattern generator
 */
export function createProbabilityPattern(config: ProbabilityPatternConfig): PatternGeneratorFn {
  const pattern = new ProbabilityPattern(config);

  return (context: PatternContext) => {
    return pattern.tick(context);
  };
}
