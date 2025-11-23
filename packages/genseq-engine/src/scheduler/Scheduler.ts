import { EventEmitter } from 'events';
import { Clock } from '../clock/Clock';

export interface SchedulerConfig {
  clock: Clock;
  lookaheadMs?: number;
}

export interface ScheduledEvent {
  id: string;
  scheduledTime: number;
  callback: () => void;
}

/**
 * T017: Tick-based event scheduler
 *
 * Performance requirement: <1ms accuracy from expected time
 * Events sorted by tick time for efficient processing
 */
export class Scheduler extends EventEmitter {
  private clock: Clock;
  private lookaheadMs: number;
  private events: Map<string, ScheduledEvent> = new Map();
  private eventQueue: ScheduledEvent[] = [];
  private running: boolean = false;
  private paused: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private nextEventId: number = 0;

  constructor(config: SchedulerConfig) {
    super();
    this.clock = config.clock;
    this.lookaheadMs = config.lookaheadMs || 100;
  }

  scheduleAt(scheduledTime: number, callback: () => void): string {
    const id = `event_${this.nextEventId++}`;
    const event: ScheduledEvent = {
      id,
      scheduledTime,
      callback
    };

    this.events.set(id, event);
    this.eventQueue.push(event);

    // Keep queue sorted by scheduled time
    this.eventQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);

    // Emit lookahead event if within window
    const now = performance.now();
    if (scheduledTime - now <= this.lookaheadMs) {
      this.emit('lookahead', event);
    }

    return id;
  }

  scheduleAtBeat(beat: number, callback: () => void): string {
    const bpm = this.clock.getBpm();
    const msPerBeat = (60 * 1000) / bpm;
    const scheduledTime = performance.now() + (beat - 1) * msPerBeat;
    return this.scheduleAt(scheduledTime, callback);
  }

  scheduleRecurring(intervalMs: number, callback: () => void): string {
    const id = `recurring_${this.nextEventId++}`;
    let nextTime = performance.now() + intervalMs;

    const recurringCallback = () => {
      try {
        callback();
      } catch (error) {
        // Emit error but continue
        this.emit('error', error);
      }

      if (this.running && !this.paused) {
        nextTime += intervalMs;
        this.scheduleAt(nextTime, recurringCallback);
      }
    };

    this.scheduleAt(nextTime, recurringCallback);
    return id;
  }

  cancel(id: string): boolean {
    const event = this.events.get(id);
    if (!event) {
      return false;
    }

    this.events.delete(id);
    const index = this.eventQueue.findIndex(e => e.id === id);
    if (index !== -1) {
      this.eventQueue.splice(index, 1);
    }

    return true;
  }

  clearAll(): void {
    this.events.clear();
    this.eventQueue = [];
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.paused = false;

    const processEvents = () => {
      if (!this.running || this.paused) {
        return;
      }

      const now = performance.now();

      // Process all events that are due
      while (this.eventQueue.length > 0 && this.eventQueue[0].scheduledTime <= now) {
        const event = this.eventQueue.shift()!;
        this.events.delete(event.id);

        try {
          event.callback();
        } catch (error) {
          // Emit error but don't throw - continue processing other events
          this.emit('error', error);
          // Suppress error to prevent uncaught exception
        }
      }

      // Schedule next check
      setImmediate(processEvents);
    };

    setImmediate(processEvents);
  }

  stop(): void {
    this.running = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) {
      return;
    }

    this.paused = false;

    // Restart processing after resume
    if (this.running) {
      const processEvents = () => {
        if (!this.running || this.paused) {
          return;
        }

        const now = performance.now();

        // Process all events that are due
        while (this.eventQueue.length > 0 && this.eventQueue[0].scheduledTime <= now) {
          const event = this.eventQueue.shift()!;
          this.events.delete(event.id);

          try {
            event.callback();
          } catch (error) {
            this.emit('error', error);
          }
        }

        // Schedule next check
        setImmediate(processEvents);
      };

      setImmediate(processEvents);
    }
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  getNextEvent(): ScheduledEvent | undefined {
    return this.eventQueue[0];
  }
}
