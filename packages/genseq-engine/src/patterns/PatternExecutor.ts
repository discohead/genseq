import { EventEmitter } from 'events';
import type { Clock } from '../clock/Clock';
import type { PatternEntity } from '../config/entities/PatternEntity';
import type { PatternContext, PatternGeneratorFn } from '@genseq/patterns';
import { PatternFactory } from './PatternFactory';

/**
 * T030: PatternExecutor - connects scheduler to pattern generators
 *
 * Responsibilities:
 * - Manages active pattern instances
 * - Generates MIDI events from patterns
 * - Schedules events via Scheduler
 * - Handles pattern enable/disable
 * - Supports hot-reload of pattern parameters
 */

export interface PatternExecutorConfig {
  clock: Clock;
  scheduler: any; // Scheduler not needed in current implementation
}

export interface ActivePattern {
  entity: PatternEntity;
  generator: PatternGeneratorFn | null;
  patternInstance?: any; // Store pattern instance for hot-reload (e.g., EuclideanPattern)
  enabled: boolean;
  lastTick: number;
  pendingUpdate: boolean;
  currentCycleStart?: number; // Tick when current cycle started
  // T018: Type swap state fields
  pendingTypeSwap?: boolean; // Whether a type swap is scheduled
  targetType?: string; // Target pattern type for swap
  targetEntity?: PatternEntity; // Target entity configuration
  swapScheduledAt?: number; // Timestamp when swap was scheduled
}

export class PatternExecutor extends EventEmitter {
  private clock: Clock;
  private patterns: Map<string, ActivePattern> = new Map();
  private tickListener: ((tick: number) => void) | null = null;

  constructor(config: PatternExecutorConfig) {
    super();
    this.clock = config.clock;
  }

  /**
   * Start executing patterns
   */
  start(): void {
    // Listen to clock ticks
    this.tickListener = (tick: number) => {
      this.onTick(tick);
    };

    this.clock.on('tick', this.tickListener);
  }

  /**
   * Stop executing patterns
   */
  stop(): void {
    if (this.tickListener) {
      this.clock.off('tick', this.tickListener);
      this.tickListener = null;
    }
  }

  /**
   * Public tick method for manual testing
   */
  tick(): void {
    const tick = this.clock.getCurrentTick();
    this.onTick(tick);
  }

  /**
   * Handle clock tick - generate events from all active patterns
   * T022: Modified to detect cycle boundaries and apply pending type swaps
   */
  private onTick(tick: number): void {
    const position = this.clock.getPosition();
    const ppq = this.clock.getPpq();

    for (const [id, pattern] of this.patterns.entries()) {
      if (!pattern.enabled || !pattern.generator) {
        continue;
      }

      try {
        // Check if we're at the start of a new cycle and have pending updates
        const ticksPerCycle = ppq * 4 * pattern.entity.length; // PPQ * beats/bar * bars
        const isNewCycle = pattern.currentCycleStart === undefined ||
                          (tick - pattern.currentCycleStart) >= ticksPerCycle;

        if (isNewCycle) {
          pattern.currentCycleStart = tick;

          // T022: Apply pending type swaps at cycle boundary BEFORE parameter updates
          if (pattern.pendingTypeSwap) {
            this.applyTypeSwap(id, pattern);
          }

          // Apply pending parameter updates at cycle boundary
          if (pattern.pendingUpdate) {
            pattern.pendingUpdate = false;
            this.emit('patternRegenerated', { id, tick, parameters: pattern.entity.parameters });
          }
        }

        // Create context for pattern
        const context: PatternContext = {
          params: pattern.entity.parameters,
          position,
          ppq,
          helpers: {
            euclidean: (steps: number, pulses: number) => this.euclideanHelper(steps, pulses),
            probability: (chance: number) => this.probabilityHelper(chance),
            scale: (note: number, scaleName: string) => this.scaleHelper(note, scaleName),
            quantize: (value: number, step: number) => this.quantizeHelper(value, step)
          }
        };

        // Generate events from pattern
        const events = pattern.generator(context);

        // Ensure events is an array
        if (!events || !Array.isArray(events)) {
          continue;
        }

        // Emit events with pattern metadata
        for (const event of events) {
          this.emit('event', {
            ...event,
            patternId: id,
            bus: pattern.entity.bus,
            channel: pattern.entity.channel
          });
        }

        pattern.lastTick = tick;
      } catch (error) {
        this.emit('error', { patternId: id, error });
      }
    }
  }

  /**
   * Load pattern using PatternFactory (helper for tests and initial load)
   */
  loadPattern(entity: PatternEntity): void {
    const result = PatternFactory.createPattern(entity);
    this.addPattern(entity, result.generator, result.instance);
  }

  /**
   * Add or update pattern
   */
  addPattern(entity: PatternEntity, generator: PatternGeneratorFn, patternInstance?: any): void {
    this.patterns.set(entity.id, {
      entity,
      generator,
      patternInstance, // Store instance for hot-reload
      enabled: entity.enabled,
      lastTick: 0,
      pendingUpdate: false,
      currentCycleStart: undefined,
      // T018: Initialize type swap fields
      pendingTypeSwap: false,
      targetType: undefined,
      targetEntity: undefined,
      swapScheduledAt: undefined
    });

    this.emit('patternAdded', entity.id);
  }

  /**
   * Remove pattern
   */
  removePattern(id: string): void {
    this.patterns.delete(id);
    this.emit('patternRemoved', id);
  }

  /**
   * Enable pattern
   */
  enablePattern(id: string): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.enabled = true;
      this.emit('patternEnabled', id);
    }
  }

  /**
   * Disable pattern
   */
  disablePattern(id: string): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.enabled = false;
      this.emit('patternDisabled', id);
    }
  }

  /**
   * Update pattern parameters (hot-reload)
   * T050: Enhanced to support live parameter updates without transport interruption
   *
   * @param id - Pattern ID
   * @param parameters - Parameter updates to deep merge (includes both pattern parameters and entity fields like note/channel)
   *
   * Features:
   * - Deep merges parameters without replacing entire object
   * - Updates entity-level fields (note, channel) directly on pattern.entity
   * - Marks pattern for reload on next cycle boundary
   * - Calls updateConfig() on pattern instance if available
   * - Emits 'patternUpdated' event immediately
   * - Emits 'patternRegenerated' event at cycle boundary (in onTick)
   */
  updatePatternParameters(id: string, parameters: Record<string, any>): void {
    const pattern = this.patterns.get(id);
    if (!pattern) {
      throw new Error(`Pattern ${id} not found`);
    }

    // Separate entity-level fields from pattern parameters
    const entityFields = ['note', 'channel', 'enabled', 'bus'];
    const entityUpdates: Record<string, any> = {};
    const parameterUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(parameters)) {
      if (entityFields.includes(key)) {
        entityUpdates[key] = value;
      } else {
        parameterUpdates[key] = value;
      }
    }

    // Update entity-level fields directly
    Object.assign(pattern.entity, entityUpdates);

    // Handle enabled state change immediately (no cycle boundary needed for mute/unmute)
    if ('enabled' in entityUpdates) {
      pattern.enabled = entityUpdates.enabled;
    }

    // Deep merge parameters (preserve existing values not in update)
    pattern.entity.parameters = {
      ...pattern.entity.parameters,
      ...parameterUpdates
    };

    // Update the pattern instance immediately if it has an updateConfig method
    if (pattern.patternInstance && typeof pattern.patternInstance.updateConfig === 'function') {
      pattern.patternInstance.updateConfig(parameters);
    }

    // Mark for reload on next cycle boundary (don't interrupt current cycle)
    pattern.pendingUpdate = true;

    // Emit immediate update event
    this.emit('patternUpdated', {
      id,
      parameters: pattern.entity.parameters
    });
  }

  /**
   * Get pattern by ID
   * Returns the actual ActivePattern reference (for testing)
   */
  getPattern(id: string): ActivePattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all pattern IDs
   */
  getPatternIds(): string[] {
    return Array.from(this.patterns.keys());
  }

  /**
   * Get active pattern count
   */
  getActivePatternCount(): number {
    return Array.from(this.patterns.values()).filter(p => p.enabled).length;
  }

  /**
   * Clear all patterns
   */
  clearAll(): void {
    this.patterns.clear();
    this.emit('patternsCleared');
  }

  /**
   * T019: Schedule type swap for next cycle boundary
   *
   * Queues a pattern type change to be applied at the next cycle boundary.
   * Does not interrupt current playback.
   *
   * @param id - Pattern ID
   * @param targetEntity - New pattern entity with different type
   * @throws Error if pattern not found
   */
  scheduleTypeSwap(id: string, targetEntity: PatternEntity): void {
    const pattern = this.patterns.get(id);
    if (!pattern) {
      throw new Error(`Pattern ${id} not found`);
    }

    const fromType = pattern.entity.type;
    const toType = targetEntity.type;


    // T057-T058: Check if replacing a pending swap (deduplication)
    if (pattern.pendingTypeSwap && pattern.targetType !== toType) {
      const replacedType = pattern.targetType;

      // Emit replaced event
      this.emit('typeSwapReplaced', {
        patternId: id,
        replacedType,
        newType: toType,
        timestamp: performance.now()
      });
    }

    // Store type swap request
    pattern.pendingTypeSwap = true;
    pattern.targetType = toType;
    pattern.targetEntity = targetEntity;
    pattern.swapScheduledAt = performance.now();

    // Emit scheduled event
    this.emit('typeSwapScheduled', {
      patternId: id,
      fromType,
      toType,
      scheduledAt: pattern.swapScheduledAt
    });
  }

  /**
   * T020: Apply type swap at cycle boundary
   *
   * Creates new pattern instance of target type and swaps generator atomically.
   * Called automatically by onTick() when cycle boundary is detected.
   *
   * @param id - Pattern ID
   * @param pattern - Active pattern with pending type swap
   */
  private applyTypeSwap(id: string, pattern: ActivePattern): void {
    if (!pattern.targetEntity) {
      this.rollbackTypeSwap(id, pattern, new Error('Missing target entity'));
      return;
    }

    const swapStartTime = performance.now();
    const fromType = pattern.entity.type;
    const toType = pattern.targetEntity.type;


    try {
      // Create new pattern instance using factory
      const result = PatternFactory.createPattern(pattern.targetEntity);

      // Atomically swap instance and generator
      const oldInstance = pattern.patternInstance;
      pattern.patternInstance = result.instance;
      pattern.generator = result.generator;
      pattern.entity = pattern.targetEntity;

      // Call destroy on old instance if available
      if (oldInstance && typeof oldInstance.destroy === 'function') {
        oldInstance.destroy();
      }

      // Clear type swap flags
      pattern.pendingTypeSwap = false;
      pattern.targetType = undefined;
      pattern.targetEntity = undefined;
      pattern.swapScheduledAt = undefined;

      // Calculate swap latency
      const latency = performance.now() - swapStartTime;

      // Emit success event
      this.emit('typeSwapCompleted', {
        patternId: id,
        fromType,
        toType,
        completedAt: performance.now(),
        latency
      });

    } catch (error) {
      this.rollbackTypeSwap(id, pattern, error as Error);
    }
  }

  /**
   * T021/T044-T046: Rollback type swap on failure
   *
   * Preserves original pattern instance and clears type swap flags.
   * Ensures playback continues uninterrupted with original pattern.
   * Logs detailed error information for debugging.
   *
   * @param id - Pattern ID
   * @param pattern - Active pattern
   * @param error - Error that caused rollback
   */
  private rollbackTypeSwap(id: string, pattern: ActivePattern, error: Error): void {
    const fromType = pattern.entity.type;
    const toType = pattern.targetType;

    // T044: Preserve original pattern by NOT modifying entity/generator/instance
    // T045: Clear type swap flags only
    pattern.pendingTypeSwap = false;
    pattern.targetType = undefined;
    pattern.targetEntity = undefined;
    pattern.swapScheduledAt = undefined;

    // T046: Emit failure event with detailed error information
    this.emit('typeSwapFailed', {
      patternId: id,
      oldType: fromType, // Test expects 'oldType' not 'fromType'
      newType: toType, // Test expects 'newType' not 'toType'
      status: 'failed', // Test expects status field
      error: error.message, // Include error message for logging
      timestamp: process.hrtime.bigint(), // High-resolution timestamp
      failedAt: performance.now()
    });

    // T046: Log to console for visibility during development
    console.error(
      `[PatternExecutor] Type swap failed for pattern "${id}": ${fromType} → ${toType}`,
      `\nError: ${error.message}`,
      `\nPattern will continue with original type (${fromType})`
    );
  }

  // Helper implementations for pattern context
  private euclideanHelper(steps: number, pulses: number): boolean[] {
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

    const slope = steps / pulses;
    for (let i = 0; i < pulses; i++) {
      const index = Math.floor(i * slope);
      pattern[index] = true;
    }

    return pattern;
  }

  private probabilityHelper(chance: number): boolean {
    if (chance < 0 || chance > 100) {
      throw new Error(`Probability must be between 0 and 100, got ${chance}`);
    }
    return Math.random() * 100 < chance;
  }

  private scaleHelper(note: number, scaleName: string): number {
    const scales: Record<string, number[]> = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      dorian: [0, 2, 3, 5, 7, 9, 10],
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    };

    const scaleIntervals = scales[scaleName.toLowerCase()];
    if (!scaleIntervals) {
      throw new Error(`Unknown scale: ${scaleName}`);
    }

    const octave = Math.floor(note / 12);
    const noteInOctave = note % 12;

    let closestInterval = scaleIntervals[0];
    let minDistance = Math.abs(noteInOctave - closestInterval);

    for (const interval of scaleIntervals) {
      const distance = Math.abs(noteInOctave - interval);
      if (distance < minDistance) {
        minDistance = distance;
        closestInterval = interval;
      }
    }

    return (octave * 12) + closestInterval;
  }

  private quantizeHelper(value: number, step: number): number {
    if (step <= 0) {
      throw new Error(`Quantize step must be positive, got ${step}`);
    }
    return Math.round(value / step) * step;
  }
}
