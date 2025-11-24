import type { PatternContext, MidiEvent, PatternGeneratorFn } from '../types';

export interface PhasePatternConfig {
  phaseRate: number; // Cycles per bar (0.5 = half speed, 2.0 = double speed)
  phaseOffset: number; // 0.0 - 1.0 (phase offset)
  note: number;
  velocity: number | number[];
  duration: number; // in beats
  velocityModulation?: boolean; // Modulate velocity based on phase position
}

/**
 * T006: PhasePattern implementation
 *
 * Generates rhythmic patterns by continuously accumulating phase and triggering
 * when phase crosses zero. Useful for polyrhythms and gradual phase shifts.
 */
export class PhasePattern {
  private config: PhasePatternConfig;
  private currentPhase: number = 0;
  private previousPhase: number = 1.0; // Start at 1.0 so first tick at offset triggers
  private triggerCount: number = 0;
  private isFirstTick: boolean = true;

  constructor(config: PhasePatternConfig) {
    this.validateConfig(config);
    this.config = config;
    this.currentPhase = config.phaseOffset;
    this.previousPhase = 1.0; // Ensures first tick can trigger
  }

  /**
   * Validate configuration parameters (T040)
   */
  private validateConfig(config: PhasePatternConfig): void {
    // Validate phaseRate
    if (config.phaseRate === undefined || config.phaseRate === null) {
      throw new Error('Required parameter "phaseRate" is missing');
    }
    if (typeof config.phaseRate !== 'number') {
      throw new Error(`PhaseRate must be a number, got ${typeof config.phaseRate}`);
    }
    if (config.phaseRate < 0) {
      throw new Error(`PhaseRate must be >= 0, got ${config.phaseRate}`);
    }

    // Validate phaseOffset
    if (config.phaseOffset === undefined || config.phaseOffset === null) {
      throw new Error('Required parameter "phaseOffset" is missing');
    }
    if (typeof config.phaseOffset !== 'number') {
      throw new Error(`PhaseOffset must be a number, got ${typeof config.phaseOffset}`);
    }
    if (config.phaseOffset < 0 || config.phaseOffset > 1) {
      throw new Error(
        `PhaseOffset must be between 0 and 1, got ${config.phaseOffset}`
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

    // Validate optional velocityModulation
    if (config.velocityModulation !== undefined && config.velocityModulation !== null) {
      if (typeof config.velocityModulation !== 'boolean') {
        throw new Error(`VelocityModulation must be a boolean, got ${typeof config.velocityModulation}`);
      }
    }
  }

  /**
   * Get velocity for current trigger
   */
  private getVelocity(triggerIndex: number): number {
    const { velocity, velocityModulation } = this.config;

    if (Array.isArray(velocity)) {
      const baseVelocity = velocity[triggerIndex % velocity.length];

      // Optionally modulate by phase position
      if (velocityModulation) {
        const modulation = Math.sin(this.currentPhase * Math.PI * 2) * 0.5 + 0.5;
        return Math.floor(baseVelocity * modulation);
      }

      return baseVelocity;
    }

    // Fixed velocity with optional modulation
    if (velocityModulation) {
      const modulation = Math.sin(this.currentPhase * Math.PI * 2) * 0.5 + 0.5;
      return Math.floor(velocity * modulation);
    }

    return velocity;
  }

  /**
   * Calculate phase based on current position
   */
  private calculatePhase(context: PatternContext): number {
    const { position } = context;

    // Calculate normalized bar position (0.0 - 1.0)
    const barPosition = (position.beat - 1 + position.tick / context.ppq) / 4;

    // Calculate total bars elapsed
    const totalBars = position.bar - 1 + barPosition;

    // Calculate phase with rate and offset
    const phase = (totalBars * this.config.phaseRate + this.config.phaseOffset) % 1.0;

    return phase;
  }

  /**
   * Check if phase crossed zero (wrapped from ~1.0 to ~0.0)
   */
  private detectTrigger(previousPhase: number, currentPhase: number): boolean {
    // First tick special case - trigger if at offset
    if (this.isFirstTick) {
      this.isFirstTick = false;
      return true;
    }

    // Trigger if phase wrapped around (crossed 1.0 → 0.0 boundary)
    if (previousPhase > currentPhase) {
      return true;
    }

    return false;
  }

  /**
   * Generate MIDI events for current tick
   */
  tick(context: PatternContext): MidiEvent[] {
    this.previousPhase = this.currentPhase;
    this.currentPhase = this.calculatePhase(context);

    // Check if phase crossed trigger threshold
    if (!this.detectTrigger(this.previousPhase, this.currentPhase)) {
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
  updateConfig(config: Partial<PhasePatternConfig>): void {
    const newConfig = { ...this.config, ...config };
    this.validateConfig(newConfig);

    // Store old phase rate to preserve timing
    const oldConfig = this.config;
    this.config = newConfig;

    // If phase rate or offset changed, we need to recalculate but preserve relative position
    if (config.phaseRate !== undefined || config.phaseOffset !== undefined) {
      // Keep current phase position if only offset changed
      if (config.phaseRate === undefined) {
        this.currentPhase = this.currentPhase;
      }
      // Otherwise phase will be recalculated on next tick
    }
  }

  /**
   * Reset to beginning
   */
  reset(): void {
    this.currentPhase = this.config.phaseOffset;
    this.previousPhase = 1.0;
    this.triggerCount = 0;
    this.isFirstTick = true;
  }

  /**
   * Destroy pattern instance (cleanup for type swaps)
   */
  destroy(): void {
    // No resources to clean up for phase pattern
    // But method is required for consistent lifecycle API
  }
}

/**
 * Factory function for creating Phase pattern generator
 */
export function createPhasePattern(config: PhasePatternConfig): PatternGeneratorFn {
  const pattern = new PhasePattern(config);

  return (context: PatternContext) => {
    return pattern.tick(context);
  };
}
