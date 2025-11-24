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
   * Validate configuration parameters
   */
  private validateConfig(config: PhasePatternConfig): void {
    if (config.phaseRate < 0) {
      throw new Error(`Invalid phaseRate: ${config.phaseRate}. Must be >= 0`);
    }

    if (config.phaseOffset < 0 || config.phaseOffset > 1) {
      throw new Error(
        `Invalid phaseOffset: ${config.phaseOffset}. Must be between 0.0 and 1.0`
      );
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
