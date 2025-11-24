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
   * Validate configuration parameters
   */
  private validateConfig(config: ProbabilityPatternConfig): void {
    if (config.probability < 0 || config.probability > 1) {
      throw new Error(
        `Invalid probability value: ${config.probability}. Must be between 0.0 and 1.0`
      );
    }

    if (config.density <= 0) {
      throw new Error(`Invalid density value: ${config.density}. Must be greater than 0`);
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
