import { EventEmitter } from 'events';
import type { Clock } from '../clock/Clock';
import type { Scheduler } from '../scheduler/Scheduler';

/**
 * Quantization mode for scene triggers
 */
export type QuantizationMode = 'bar' | 'beat' | 'immediate';

/**
 * Queued trigger with scene information
 */
export interface QueuedTrigger {
  sceneId: string;
  mode: QuantizationMode;
  queuedAt: number; // performance.now() timestamp
  targetTick?: number; // Target tick for execution (used for bar/beat quantization)
  scheduledEventId?: string; // Scheduler event ID for cancellation
}

/**
 * Event emitted when trigger is scheduled
 */
export interface TriggerScheduledEvent {
  sceneId: string;
  mode: QuantizationMode;
  scheduledAt: number;
  willExecuteAt: 'next bar' | 'next beat' | 'immediate';
}

/**
 * Event emitted when trigger is executed
 */
export interface TriggerExecutedEvent {
  sceneId: string;
  mode: QuantizationMode;
  queuedAt: number;
  executedAt: number;
  latency: number; // Time from queued to executed in ms
}

/**
 * QuantizedTrigger - Scene trigger system with bar/beat quantization
 *
 * FR-016 Compliance:
 * - Scene triggers from MIDI input support quantization to bar/beat boundaries
 * - Triggers queued and executed at next quantization point
 * - Supports 'bar', 'beat', and 'immediate' modes
 * - <1ms timing accuracy for quantized execution
 * - Pending triggers replaced if new trigger for same scene arrives
 */
export class QuantizedTrigger extends EventEmitter {
  private clock: Clock;
  private scheduler: Scheduler;
  private queuedTriggers: Map<string, QueuedTrigger> = new Map();
  private nextBarTick: number | null = null;
  private nextBeatTick: number | null = null;

  constructor(clock: Clock, scheduler: Scheduler) {
    super();
    this.clock = clock;
    this.scheduler = scheduler;

    // Listen to clock events for boundary detection
    this.clock.on('tick', this.onTick.bind(this));
    this.clock.on('bar', this.onBar.bind(this));
    this.clock.on('beat', this.onBeat.bind(this));
  }

  /**
   * Queue a scene trigger with quantization
   * Replaces any pending trigger for the same scene
   */
  trigger(sceneId: string, mode: QuantizationMode = 'bar'): void {
    const queuedAt = performance.now();

    // Cancel existing trigger for this scene if it exists
    this.cancelTrigger(sceneId);

    if (mode === 'immediate') {
      // Execute immediately, no quantization
      this.executeTrigger(sceneId, mode, queuedAt);
      return;
    }

    // Calculate target tick for execution
    const targetTick = mode === 'bar' ? this.calculateNextBarTick() : this.calculateNextBeatTick();

    // Queue trigger for next boundary
    const trigger: QueuedTrigger = {
      sceneId,
      mode,
      queuedAt,
      targetTick
    };

    this.queuedTriggers.set(sceneId, trigger);

    // Emit scheduled event
    const willExecuteAt = mode === 'bar' ? 'next bar' : 'next beat';
    this.emit('trigger:scheduled', {
      sceneId,
      mode,
      scheduledAt: queuedAt,
      willExecuteAt
    } as TriggerScheduledEvent);
  }

  /**
   * Cancel pending trigger for a scene
   */
  cancelTrigger(sceneId: string): boolean {
    const trigger = this.queuedTriggers.get(sceneId);
    if (!trigger) {
      return false;
    }

    // Cancel scheduler event if it exists
    if (trigger.scheduledEventId) {
      this.scheduler.cancel(trigger.scheduledEventId);
    }

    this.queuedTriggers.delete(sceneId);
    return true;
  }

  /**
   * Clear all pending triggers
   */
  clearAll(): void {
    // Cancel all scheduler events
    for (const trigger of this.queuedTriggers.values()) {
      if (trigger.scheduledEventId) {
        this.scheduler.cancel(trigger.scheduledEventId);
      }
    }

    this.queuedTriggers.clear();
  }

  /**
   * Get pending trigger for a scene
   */
  getPendingTrigger(sceneId: string): QueuedTrigger | undefined {
    return this.queuedTriggers.get(sceneId);
  }

  /**
   * Get all pending triggers
   */
  getAllPendingTriggers(): QueuedTrigger[] {
    return Array.from(this.queuedTriggers.values());
  }

  /**
   * Calculate tick count for next bar boundary
   */
  private calculateNextBarTick(): number {
    const position = this.clock.getPosition();
    const currentTick = this.clock.getCurrentTick();
    const ppq = this.clock.getPpq();
    const ticksPerBeat = ppq;
    const beatsPerBar = 4; // Assume 4/4 time signature (matches Clock default)
    const ticksPerBar = ticksPerBeat * beatsPerBar;

    // Calculate ticks elapsed in current bar
    const tickInBar = (position.beat - 1) * ticksPerBeat + position.tick;

    // Calculate next bar start tick
    return currentTick + (ticksPerBar - tickInBar);
  }

  /**
   * Calculate tick count for next beat boundary
   */
  private calculateNextBeatTick(): number {
    const position = this.clock.getPosition();
    const currentTick = this.clock.getCurrentTick();
    const ppq = this.clock.getPpq();
    const ticksPerBeat = ppq;

    // Calculate ticks until next beat
    const ticksUntilNextBeat = ticksPerBeat - position.tick;

    return currentTick + ticksUntilNextBeat;
  }

  /**
   * Handle clock tick event
   * Check if we've reached scheduled boundaries
   */
  private onTick(tick: number): void {
    // Update boundary calculations on each tick
    this.nextBarTick = this.calculateNextBarTick();
    this.nextBeatTick = this.calculateNextBeatTick();
  }

  /**
   * Handle bar boundary event
   * Execute all bar-quantized triggers that were queued BEFORE this bar started
   */
  private onBar(barNumber: number): void {
    const currentTick = this.clock.getCurrentTick();
    const triggersToExecute: QueuedTrigger[] = [];

    // Collect all bar-quantized triggers that should execute
    // Only execute if trigger was queued before current bar started
    for (const trigger of this.queuedTriggers.values()) {
      if (trigger.mode === 'bar' && trigger.targetTick !== undefined && trigger.targetTick <= currentTick) {
        triggersToExecute.push(trigger);
      }
    }

    // Execute and remove from queue
    for (const trigger of triggersToExecute) {
      this.queuedTriggers.delete(trigger.sceneId);
      this.executeTrigger(trigger.sceneId, trigger.mode, trigger.queuedAt);
    }
  }

  /**
   * Handle beat boundary event
   * Execute all beat-quantized triggers that were queued BEFORE this beat started
   */
  private onBeat(beatNumber: number): void {
    const currentTick = this.clock.getCurrentTick();
    const triggersToExecute: QueuedTrigger[] = [];

    // Collect all beat-quantized triggers that should execute
    // Only execute if trigger was queued before current beat started
    for (const trigger of this.queuedTriggers.values()) {
      // DEBUG: console.log(`[onBeat] beatNumber=${beatNumber}, currentTick=${currentTick}, trigger=${JSON.stringify(trigger)}`);
      if (trigger.mode === 'beat' && trigger.targetTick !== undefined && trigger.targetTick <= currentTick) {
        triggersToExecute.push(trigger);
      }
    }

    // Execute and remove from queue
    for (const trigger of triggersToExecute) {
      this.queuedTriggers.delete(trigger.sceneId);
      this.executeTrigger(trigger.sceneId, trigger.mode, trigger.queuedAt);
    }
  }

  /**
   * Execute trigger and emit event
   */
  private executeTrigger(sceneId: string, mode: QuantizationMode, queuedAt: number): void {
    const executedAt = performance.now();
    const latency = executedAt - queuedAt;

    this.emit('trigger:executed', {
      sceneId,
      mode,
      queuedAt,
      executedAt,
      latency
    } as TriggerExecutedEvent);
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    this.clearAll();
    this.clock.removeListener('tick', this.onTick.bind(this));
    this.clock.removeListener('bar', this.onBar.bind(this));
    this.clock.removeListener('beat', this.onBeat.bind(this));
  }
}
