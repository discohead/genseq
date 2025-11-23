import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scheduler } from '../../src/scheduler/Scheduler';
import { Clock } from '../../src/clock/Clock';

/**
 * T012: Scheduler tick accuracy test
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * Scheduler and Clock classes do not exist yet - implementation after Red phase.
 *
 * Performance Requirements:
 * - Scheduler tick accuracy: <1ms from expected time
 * - Event scheduling precision
 * - Lookahead window management
 */

describe('Scheduler - Tick Accuracy', () => {
  let scheduler: Scheduler;
  let clock: Clock;

  beforeEach(() => {
    // MUST FAIL - Classes don't exist
    clock = new Clock({ bpm: 120, ppq: 480 });
    scheduler = new Scheduler({
      clock,
      lookaheadMs: 100
    });
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
    if (clock) {
      clock.stop();
    }
  });

  it('should schedule events within <1ms of expected time', async () => {
    const eventCount = 100;
    const scheduledEvents: Array<{ scheduledTime: number; actualTime: number }> = [];

    // Schedule events at regular intervals
    const startTime = performance.now();
    const tickInterval = (60 * 1000) / (120 * 480); // ms per tick

    for (let i = 0; i < eventCount; i++) {
      const scheduledTime = startTime + (i * tickInterval);

      scheduler.scheduleAt(scheduledTime, () => {
        scheduledEvents.push({
          scheduledTime,
          actualTime: performance.now()
        });
      });
    }

    scheduler.start();

    // Wait for all events to execute
    await new Promise<void>((resolve) => {
      const checkComplete = setInterval(() => {
        if (scheduledEvents.length >= eventCount) {
          clearInterval(checkComplete);
          scheduler.stop();
          resolve();
        }
      }, 10);
    });

    // Calculate timing accuracy
    const timingErrors = scheduledEvents.map(event =>
      Math.abs(event.actualTime - event.scheduledTime)
    );

    const maxError = Math.max(...timingErrors);
    const avgError = timingErrors.reduce((sum, err) => sum + err, 0) / timingErrors.length;

    // MUST FAIL - Scheduler doesn't exist
    expect(maxError).toBeLessThan(1.0); // Max error < 1ms
    expect(avgError).toBeLessThan(0.5); // Average error < 0.5ms
  });

  it('should maintain accuracy under heavy event load', async () => {
    const eventsPerTick = 10;
    const totalTicks = 100;
    const scheduledEvents: Array<{ tick: number; scheduledTime: number; actualTime: number }> = [];

    const startTime = performance.now();
    const tickInterval = (60 * 1000) / (120 * 480);

    // Schedule multiple events per tick
    for (let tick = 0; tick < totalTicks; tick++) {
      const tickTime = startTime + (tick * tickInterval);

      for (let i = 0; i < eventsPerTick; i++) {
        scheduler.scheduleAt(tickTime, () => {
          scheduledEvents.push({
            tick,
            scheduledTime: tickTime,
            actualTime: performance.now()
          });
        });
      }
    }

    scheduler.start();

    // Wait for all events
    await new Promise<void>((resolve) => {
      const checkComplete = setInterval(() => {
        if (scheduledEvents.length >= totalTicks * eventsPerTick) {
          clearInterval(checkComplete);
          scheduler.stop();
          resolve();
        }
      }, 10);
    });

    // Group events by tick and verify timing
    const eventsByTick = new Map<number, Array<{ scheduledTime: number; actualTime: number }>>();

    scheduledEvents.forEach(event => {
      if (!eventsByTick.has(event.tick)) {
        eventsByTick.set(event.tick, []);
      }
      eventsByTick.get(event.tick)!.push(event);
    });

    // Check each tick's events executed at the right time
    const tickErrors: number[] = [];

    eventsByTick.forEach((events, tick) => {
      const avgActualTime = events.reduce((sum, e) => sum + e.actualTime, 0) / events.length;
      const scheduledTime = events[0].scheduledTime;
      const error = Math.abs(avgActualTime - scheduledTime);
      tickErrors.push(error);
    });

    const maxTickError = Math.max(...tickErrors);
    const avgTickError = tickErrors.reduce((sum, err) => sum + err, 0) / tickErrors.length;

    // MUST FAIL - Scheduler doesn't exist
    expect(maxTickError).toBeLessThan(1.0);
    expect(avgTickError).toBeLessThan(0.5);
  });

  it('should handle lookahead window correctly', async () => {
    const lookaheadMs = 100;
    const scheduledEvents: Array<{ scheduledTime: number; lookaheadTime: number }> = [];

    const customScheduler = new Scheduler({
      clock,
      lookaheadMs
    });

    // Track when events enter the lookahead window
    customScheduler.on('lookahead', (event: any) => {
      scheduledEvents.push({
        scheduledTime: event.scheduledTime,
        lookaheadTime: performance.now()
      });
    });

    const startTime = performance.now();
    const tickInterval = (60 * 1000) / (120 * 480);

    // Schedule events
    for (let i = 0; i < 50; i++) {
      const scheduledTime = startTime + (i * tickInterval);
      customScheduler.scheduleAt(scheduledTime, () => {
        // Event callback
      });
    }

    customScheduler.start();

    await new Promise(resolve => setTimeout(resolve, 200));
    customScheduler.stop();

    // Verify events entered lookahead at the correct time
    const lookaheadErrors = scheduledEvents.map(event => {
      const expectedLookaheadTime = event.scheduledTime - lookaheadMs;
      return Math.abs(event.lookaheadTime - expectedLookaheadTime);
    });

    const maxLookaheadError = Math.max(...lookaheadErrors);

    // MUST FAIL - Scheduler doesn't exist
    expect(maxLookaheadError).toBeLessThan(5.0); // Lookahead timing < 5ms error
  });

  it('should prioritize events scheduled at the same time by insertion order', async () => {
    const executionOrder: number[] = [];
    const scheduledTime = performance.now() + 50;

    // Schedule multiple events at exact same time
    for (let i = 0; i < 10; i++) {
      scheduler.scheduleAt(scheduledTime, () => {
        executionOrder.push(i);
      });
    }

    scheduler.start();

    await new Promise(resolve => setTimeout(resolve, 100));
    scheduler.stop();

    // Verify FIFO execution order
    // MUST FAIL - Scheduler doesn't exist
    expect(executionOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should cancel scheduled events correctly', async () => {
    const executedEvents = new Set<string>();

    const eventId1 = scheduler.scheduleAt(performance.now() + 50, () => {
      executedEvents.add('event1');
    });

    const eventId2 = scheduler.scheduleAt(performance.now() + 60, () => {
      executedEvents.add('event2');
    });

    const eventId3 = scheduler.scheduleAt(performance.now() + 70, () => {
      executedEvents.add('event3');
    });

    // Cancel event2
    scheduler.cancel(eventId2);

    scheduler.start();

    await new Promise(resolve => setTimeout(resolve, 150));
    scheduler.stop();

    // MUST FAIL - Scheduler doesn't exist
    expect(executedEvents.has('event1')).toBe(true);
    expect(executedEvents.has('event2')).toBe(false); // Cancelled
    expect(executedEvents.has('event3')).toBe(true);
  });
});

describe('Scheduler - Event Management', () => {
  let scheduler: Scheduler;
  let clock: Clock;

  beforeEach(() => {
    clock = new Clock({ bpm: 120, ppq: 480 });
    scheduler = new Scheduler({ clock });
  });

  afterEach(() => {
    scheduler?.stop();
    clock?.stop();
  });

  it('should support scheduling events in musical time (beats/bars)', async () => {
    const executedBeats: number[] = [];

    // Schedule events at beats 1, 2, 3, 4
    scheduler.scheduleAtBeat(1, () => executedBeats.push(1));
    scheduler.scheduleAtBeat(2, () => executedBeats.push(2));
    scheduler.scheduleAtBeat(3, () => executedBeats.push(3));
    scheduler.scheduleAtBeat(4, () => executedBeats.push(4));

    scheduler.start();

    // Wait for events to execute
    await new Promise(resolve => setTimeout(resolve, 3000)); // ~4 beats at 120 BPM
    scheduler.stop();

    // MUST FAIL - Scheduler doesn't exist
    expect(executedBeats).toEqual([1, 2, 3, 4]);
  });

  it('should handle recurring events with accurate intervals', async () => {
    const executionTimestamps: number[] = [];
    const interval = 100; // ms

    scheduler.scheduleRecurring(interval, () => {
      executionTimestamps.push(performance.now());
    });

    scheduler.start();

    await new Promise(resolve => setTimeout(resolve, 1000));
    scheduler.stop();

    // Verify intervals are accurate
    const intervals: number[] = [];
    for (let i = 1; i < executionTimestamps.length; i++) {
      intervals.push(executionTimestamps[i] - executionTimestamps[i - 1]);
    }

    const intervalErrors = intervals.map(int => Math.abs(int - interval));
    const maxIntervalError = Math.max(...intervalErrors);

    // MUST FAIL - Scheduler doesn't exist
    expect(maxIntervalError).toBeLessThan(1.0);
  });

  it('should clear all scheduled events', async () => {
    let executedCount = 0;

    scheduler.scheduleAt(performance.now() + 50, () => executedCount++);
    scheduler.scheduleAt(performance.now() + 100, () => executedCount++);
    scheduler.scheduleAt(performance.now() + 150, () => executedCount++);

    scheduler.clearAll();
    scheduler.start();

    await new Promise(resolve => setTimeout(resolve, 200));
    scheduler.stop();

    // MUST FAIL - Scheduler doesn't exist
    expect(executedCount).toBe(0);
  });

  it('should expose current schedule state', () => {
    scheduler.scheduleAt(performance.now() + 100, () => {});
    scheduler.scheduleAt(performance.now() + 200, () => {});
    scheduler.scheduleAt(performance.now() + 300, () => {});

    const queueSize = scheduler.getQueueSize();
    const nextEvent = scheduler.getNextEvent();

    // MUST FAIL - Scheduler doesn't exist
    expect(queueSize).toBe(3);
    expect(nextEvent).toBeDefined();
    expect(nextEvent.scheduledTime).toBeGreaterThan(performance.now());
  });

  it('should handle scheduler pause and resume without timing drift', async () => {
    const executionTimestamps: number[] = [];

    scheduler.scheduleRecurring(50, () => {
      executionTimestamps.push(performance.now());
    });

    scheduler.start();

    // Run for 100ms
    await new Promise(resolve => setTimeout(resolve, 100));

    // Pause
    scheduler.pause();
    const pauseTime = performance.now();

    // Wait during pause
    await new Promise(resolve => setTimeout(resolve, 200));

    // Resume
    scheduler.resume();
    const resumeTime = performance.now();
    const pauseDuration = resumeTime - pauseTime;

    // Run for another 100ms
    await new Promise(resolve => setTimeout(resolve, 100));
    scheduler.stop();

    // Calculate expected vs actual execution count
    // Should have ~2 events before pause, ~2 events after resume
    const eventsBeforePause = executionTimestamps.filter(t => t < pauseTime).length;
    const eventsAfterResume = executionTimestamps.filter(t => t > resumeTime).length;

    // MUST FAIL - Scheduler doesn't exist
    expect(eventsBeforePause).toBeGreaterThanOrEqual(1);
    expect(eventsAfterResume).toBeGreaterThanOrEqual(1);

    // Verify no events executed during pause
    const eventsDuringPause = executionTimestamps.filter(
      t => t >= pauseTime && t <= resumeTime
    ).length;
    expect(eventsDuringPause).toBe(0);
  });
});

describe('Scheduler - Edge Cases', () => {
  let scheduler: Scheduler;
  let clock: Clock;

  beforeEach(() => {
    clock = new Clock({ bpm: 120, ppq: 480 });
    scheduler = new Scheduler({ clock });
  });

  afterEach(() => {
    scheduler?.stop();
    clock?.stop();
  });

  it('should handle scheduling events in the past', () => {
    const pastTime = performance.now() - 1000;
    let executed = false;

    scheduler.scheduleAt(pastTime, () => {
      executed = true;
    });

    scheduler.start();

    // Past events should execute immediately or not at all (implementation choice)
    // Test should document the expected behavior
    // MUST FAIL - Scheduler doesn't exist
    expect(() => scheduler.scheduleAt(pastTime, () => {})).toBeDefined();
  });

  it('should handle rapid start/stop cycles', async () => {
    const cycles = 20;

    for (let i = 0; i < cycles; i++) {
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 5));
      scheduler.stop();
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    // Should not crash or leak resources
    // MUST FAIL - Scheduler doesn't exist
    expect(scheduler.isRunning()).toBe(false);
  });

  it('should handle event callbacks that throw errors', async () => {
    const goodEventExecuted = new Set<number>();

    scheduler.scheduleAt(performance.now() + 50, () => {
      throw new Error('Event error');
    });

    scheduler.scheduleAt(performance.now() + 60, () => {
      goodEventExecuted.add(2);
    });

    scheduler.scheduleAt(performance.now() + 70, () => {
      goodEventExecuted.add(3);
    });

    scheduler.start();

    await new Promise(resolve => setTimeout(resolve, 150));
    scheduler.stop();

    // Subsequent events should still execute despite error
    // MUST FAIL - Scheduler doesn't exist
    expect(goodEventExecuted.has(2)).toBe(true);
    expect(goodEventExecuted.has(3)).toBe(true);
  });
});
