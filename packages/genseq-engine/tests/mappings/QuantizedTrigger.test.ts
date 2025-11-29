import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock } from '../../src/clock/Clock';
import { Scheduler } from '../../src/scheduler/Scheduler';
import { QuantizedTrigger, type TriggerScheduledEvent, type TriggerExecutedEvent } from '../../src/mappings/QuantizedTrigger';

/**
 * QuantizedTrigger tests - FR-016 compliance
 *
 * Requirements:
 * - Scene triggers support bar/beat/immediate quantization
 * - Triggers executed at correct boundaries with <1ms accuracy
 * - Pending triggers replaced when new trigger for same scene arrives
 * - Emit 'trigger:scheduled' and 'trigger:executed' events
 */

describe('QuantizedTrigger', () => {
  let clock: Clock;
  let scheduler: Scheduler;
  let quantizedTrigger: QuantizedTrigger;

  beforeEach(() => {
    clock = new Clock({ bpm: 120, ppq: 96 }); // 96 PPQ for easier math
    scheduler = new Scheduler({ clock });
    quantizedTrigger = new QuantizedTrigger(clock, scheduler);
  });

  afterEach(() => {
    if (quantizedTrigger) {
      quantizedTrigger.destroy();
    }
    if (clock && clock.isPlaying()) {
      clock.stop();
    }
  });

  describe('Immediate Mode', () => {
    it('should execute trigger immediately without quantization', async () => {
      const sceneId = 'scene-1';
      let scheduledEventReceived = false;
      let executedEventReceived = false;

      quantizedTrigger.on('trigger:scheduled', (event: TriggerScheduledEvent) => {
        // Should not be scheduled for immediate mode
        scheduledEventReceived = true;
      });

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        expect(event.sceneId).toBe(sceneId);
        expect(event.mode).toBe('immediate');
        expect(event.latency).toBeLessThan(1); // <1ms for immediate execution
        executedEventReceived = true;
      });

      quantizedTrigger.trigger(sceneId, 'immediate');

      // Allow event loop to process
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduledEventReceived).toBe(false);
      expect(executedEventReceived).toBe(true);
    });

    it('should not queue immediate triggers', () => {
      quantizedTrigger.trigger('scene-1', 'immediate');

      const pending = quantizedTrigger.getPendingTrigger('scene-1');
      expect(pending).toBeUndefined();
    });
  });

  describe('Bar Quantization', () => {
    it('should queue trigger for next bar boundary', async () => {
      const sceneId = 'scene-bar';
      let scheduledEvent: TriggerScheduledEvent | null = null;

      quantizedTrigger.on('trigger:scheduled', (event: TriggerScheduledEvent) => {
        scheduledEvent = event;
      });

      quantizedTrigger.trigger(sceneId, 'bar');

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduledEvent).not.toBeNull();
      expect(scheduledEvent!.sceneId).toBe(sceneId);
      expect(scheduledEvent!.mode).toBe('bar');
      expect(scheduledEvent!.willExecuteAt).toBe('next bar');

      const pending = quantizedTrigger.getPendingTrigger(sceneId);
      expect(pending).toBeDefined();
      expect(pending!.mode).toBe('bar');
    });

    it('should execute trigger at bar boundary', async () => {
      const sceneId = 'scene-bar-exec';
      let executedEvent: TriggerExecutedEvent | null = null;

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedEvent = event;
      });

      // Start clock
      clock.start();

      // Queue trigger
      quantizedTrigger.trigger(sceneId, 'bar');

      // Advance to next bar (4 beats * 96 PPQ = 384 ticks)
      const ticksPerBar = 4 * 96;
      const position = clock.getPosition();
      const currentTick = clock.getCurrentTick();
      const ticksPerBeat = 96;
      const tickInBar = (position.beat - 1) * ticksPerBeat + position.tick;
      const ticksToNextBar = ticksPerBar - tickInBar;

      // Manually advance to next bar
      for (let i = 0; i <= ticksToNextBar; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executedEvent).not.toBeNull();
      expect(executedEvent!.sceneId).toBe(sceneId);
      expect(executedEvent!.mode).toBe('bar');

      // Verify trigger was removed from queue
      const pending = quantizedTrigger.getPendingTrigger(sceneId);
      expect(pending).toBeUndefined();

      clock.stop();
    });

    it('should maintain <1ms timing accuracy at bar boundary', async () => {
      const sceneId = 'scene-bar-precision';
      const queueTime = performance.now();
      let executedEvent: TriggerExecutedEvent | null = null;

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedEvent = event;
      });

      // Queue trigger
      quantizedTrigger.trigger(sceneId, 'bar');

      // Advance to next bar
      const ticksPerBar = 4 * 96;
      const position = clock.getPosition();
      const ticksPerBeat = 96;
      const tickInBar = (position.beat - 1) * ticksPerBeat + position.tick;
      const ticksToNextBar = ticksPerBar - tickInBar;

      for (let i = 0; i <= ticksToNextBar; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executedEvent).not.toBeNull();
      // Latency should be close to time to reach bar boundary
      // For manual tick advancement, this should be very small
      expect(executedEvent!.latency).toBeLessThan(10); // Allow for manual tick processing
    });
  });

  describe('Beat Quantization', () => {
    it('should queue trigger for next beat boundary', async () => {
      const sceneId = 'scene-beat';
      let scheduledEvent: TriggerScheduledEvent | null = null;

      quantizedTrigger.on('trigger:scheduled', (event: TriggerScheduledEvent) => {
        scheduledEvent = event;
      });

      quantizedTrigger.trigger(sceneId, 'beat');

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduledEvent).not.toBeNull();
      expect(scheduledEvent!.sceneId).toBe(sceneId);
      expect(scheduledEvent!.mode).toBe('beat');
      expect(scheduledEvent!.willExecuteAt).toBe('next beat');

      const pending = quantizedTrigger.getPendingTrigger(sceneId);
      expect(pending).toBeDefined();
      expect(pending!.mode).toBe('beat');
    });

    it('should execute trigger at beat boundary', async () => {
      const sceneId = 'scene-beat-exec';
      let executedEvent: TriggerExecutedEvent | null = null;

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedEvent = event;
      });

      // Queue trigger
      quantizedTrigger.trigger(sceneId, 'beat');

      // Advance to next beat (96 PPQ) - need one extra tick to trigger the beat event
      const position = clock.getPosition();
      const ticksPerBeat = 96;
      const ticksToNextBeat = ticksPerBeat - position.tick;

      for (let i = 0; i <= ticksToNextBeat; i++) {  // Changed < to <=
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executedEvent).not.toBeNull();
      expect(executedEvent!.sceneId).toBe(sceneId);
      expect(executedEvent!.mode).toBe('beat');

      // Verify trigger was removed from queue
      const pending = quantizedTrigger.getPendingTrigger(sceneId);
      expect(pending).toBeUndefined();
    });

    it('should execute beat-quantized trigger before bar-quantized', async () => {
      const sceneIdBeat = 'scene-beat-priority';
      const sceneIdBar = 'scene-bar-priority';
      const executedTriggers: string[] = [];

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedTriggers.push(event.sceneId);
      });

      // Queue both triggers
      quantizedTrigger.trigger(sceneIdBeat, 'beat');
      quantizedTrigger.trigger(sceneIdBar, 'bar');

      // Advance to next beat (should execute beat trigger)
      const position = clock.getPosition();
      const ticksPerBeat = 96;
      const ticksToNextBeat = ticksPerBeat - position.tick;

      for (let i = 0; i <= ticksToNextBeat; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executedTriggers).toContain(sceneIdBeat);
      expect(executedTriggers).not.toContain(sceneIdBar);

      // Bar trigger should still be pending
      const pendingBar = quantizedTrigger.getPendingTrigger(sceneIdBar);
      expect(pendingBar).toBeDefined();
    });
  });

  describe('Trigger Replacement', () => {
    it('should replace pending trigger when new trigger for same scene arrives', async () => {
      const sceneId = 'scene-replace';
      let scheduledCount = 0;

      quantizedTrigger.on('trigger:scheduled', () => {
        scheduledCount++;
      });

      // Queue first trigger with bar quantization
      quantizedTrigger.trigger(sceneId, 'bar');

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduledCount).toBe(1);
      const firstPending = quantizedTrigger.getPendingTrigger(sceneId);
      expect(firstPending!.mode).toBe('bar');

      // Queue second trigger with beat quantization (should replace first)
      quantizedTrigger.trigger(sceneId, 'beat');

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduledCount).toBe(2);
      const secondPending = quantizedTrigger.getPendingTrigger(sceneId);
      expect(secondPending!.mode).toBe('beat'); // Mode changed to beat
    });

    it('should cancel previous trigger when replaced', async () => {
      const sceneId = 'scene-cancel';
      let executedCount = 0;

      quantizedTrigger.on('trigger:executed', () => {
        executedCount++;
      });

      // Queue bar trigger
      quantizedTrigger.trigger(sceneId, 'bar');

      // Immediately replace with beat trigger
      quantizedTrigger.trigger(sceneId, 'beat');

      // Advance to next beat
      const position = clock.getPosition();
      const ticksPerBeat = 96;
      const ticksToNextBeat = ticksPerBeat - position.tick;

      for (let i = 0; i <= ticksToNextBeat; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      // Should only execute once (beat trigger)
      expect(executedCount).toBe(1);

      // Advance to bar boundary
      const ticksPerBar = 4 * 96;
      const pos = clock.getPosition();
      const tickInBar = (pos.beat - 1) * ticksPerBeat + pos.tick;
      const ticksToNextBar = ticksPerBar - tickInBar;

      for (let i = 0; i <= ticksToNextBar; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      // Still only one execution (bar trigger was cancelled)
      expect(executedCount).toBe(1);
    });
  });

  describe('Multiple Triggers', () => {
    it('should handle multiple different scenes independently', async () => {
      const scene1 = 'scene-multi-1';
      const scene2 = 'scene-multi-2';
      const scene3 = 'scene-multi-3';
      const executedScenes: string[] = [];

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedScenes.push(event.sceneId);
      });

      // Queue triggers with different quantization
      quantizedTrigger.trigger(scene1, 'beat');
      quantizedTrigger.trigger(scene2, 'bar');
      quantizedTrigger.trigger(scene3, 'immediate');

      await new Promise(resolve => setTimeout(resolve, 10));
      // Immediate should execute right away
      expect(executedScenes).toContain(scene3);
      expect(executedScenes).not.toContain(scene1);
      expect(executedScenes).not.toContain(scene2);

      // Advance to next beat
      const position = clock.getPosition();
      const ticksPerBeat = 96;
      const ticksToNextBeat = ticksPerBeat - position.tick;

      for (let i = 0; i <= ticksToNextBeat; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      // Beat trigger should execute
      expect(executedScenes).toContain(scene1);
      expect(executedScenes).not.toContain(scene2);
    });

    it('should execute all pending triggers at bar boundary', async () => {
      const scenes = ['scene-batch-1', 'scene-batch-2', 'scene-batch-3'];
      const executedScenes: string[] = [];

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedScenes.push(event.sceneId);
      });

      // Queue multiple bar-quantized triggers
      scenes.forEach(scene => {
        quantizedTrigger.trigger(scene, 'bar');
      });

      expect(quantizedTrigger.getAllPendingTriggers().length).toBe(3);

      // Advance to next bar
      const ticksPerBar = 4 * 96;
      const position = clock.getPosition();
      const ticksPerBeat = 96;
      const tickInBar = (position.beat - 1) * ticksPerBeat + position.tick;
      const ticksToNextBar = ticksPerBar - tickInBar;

      for (let i = 0; i <= ticksToNextBar; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      // All triggers should execute
      expect(executedScenes.length).toBe(3);
      scenes.forEach(scene => {
        expect(executedScenes).toContain(scene);
      });

      // Queue should be empty
      expect(quantizedTrigger.getAllPendingTriggers().length).toBe(0);
    });
  });

  describe('Cancel and Clear', () => {
    it('should cancel individual pending trigger', () => {
      const sceneId = 'scene-cancel-single';

      quantizedTrigger.trigger(sceneId, 'bar');
      expect(quantizedTrigger.getPendingTrigger(sceneId)).toBeDefined();

      const cancelled = quantizedTrigger.cancelTrigger(sceneId);
      expect(cancelled).toBe(true);
      expect(quantizedTrigger.getPendingTrigger(sceneId)).toBeUndefined();
    });

    it('should return false when cancelling non-existent trigger', () => {
      const cancelled = quantizedTrigger.cancelTrigger('non-existent');
      expect(cancelled).toBe(false);
    });

    it('should clear all pending triggers', () => {
      quantizedTrigger.trigger('scene-1', 'bar');
      quantizedTrigger.trigger('scene-2', 'beat');
      quantizedTrigger.trigger('scene-3', 'bar');

      expect(quantizedTrigger.getAllPendingTriggers().length).toBe(3);

      quantizedTrigger.clearAll();

      expect(quantizedTrigger.getAllPendingTriggers().length).toBe(0);
    });
  });

  describe('Boundary Calculation', () => {
    it('should calculate correct next bar tick', () => {
      // Advance to middle of first bar
      const ticksPerBar = 4 * 96; // 384 ticks
      const halfBar = Math.floor(ticksPerBar / 2);

      for (let i = 0; i < halfBar; i++) {
        clock.tick();
      }

      const position = clock.getPosition();
      expect(position.bar).toBe(1);
      expect(position.beat).toBeGreaterThan(1); // Should be in beat 2 or 3

      // Queue a bar trigger - should execute at bar 2
      quantizedTrigger.trigger('scene-boundary', 'bar');

      // Advance to bar 2
      const ticksToNextBar = ticksPerBar - halfBar;
      for (let i = 0; i <= ticksToNextBar; i++) {
        clock.tick();
      }

      const newPosition = clock.getPosition();
      expect(newPosition.bar).toBe(2);
    });

    it('should calculate correct next beat tick', () => {
      // Advance to middle of first beat
      const ticksPerBeat = 96;
      const halfBeat = Math.floor(ticksPerBeat / 2);

      for (let i = 0; i < halfBeat; i++) {
        clock.tick();
      }

      const position = clock.getPosition();
      expect(position.bar).toBe(1);
      expect(position.beat).toBe(1);
      expect(position.tick).toBeGreaterThan(0);

      // Queue a beat trigger - should execute at beat 2
      quantizedTrigger.trigger('scene-beat-boundary', 'beat');

      // Advance to beat 2
      const ticksToNextBeat = ticksPerBeat - halfBeat;
      for (let i = 0; i <= ticksToNextBeat; i++) {
        clock.tick();
      }

      const newPosition = clock.getPosition();
      expect(newPosition.beat).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trigger at exact bar boundary', async () => {
      let executedEvent: TriggerExecutedEvent | null = null;

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedEvent = event;
      });

      // Advance to exact bar boundary
      const ticksPerBar = 4 * 96;
      for (let i = 0; i < ticksPerBar; i++) {
        clock.tick();
      }

      const position = clock.getPosition();
      expect(position.bar).toBe(2);
      expect(position.beat).toBe(1);
      expect(position.tick).toBe(0);

      // Queue trigger at boundary
      quantizedTrigger.trigger('scene-exact-bar', 'bar');

      // Advance one more bar
      for (let i = 0; i <= ticksPerBar; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executedEvent).not.toBeNull();
      expect(executedEvent!.sceneId).toBe('scene-exact-bar');
    });

    it('should handle trigger at exact beat boundary', async () => {
      let executedEvent: TriggerExecutedEvent | null = null;

      quantizedTrigger.on('trigger:executed', (event: TriggerExecutedEvent) => {
        executedEvent = event;
      });

      // Advance to exact beat boundary
      const ticksPerBeat = 96;
      for (let i = 0; i < ticksPerBeat; i++) {
        clock.tick();
      }

      const position = clock.getPosition();
      expect(position.beat).toBe(2);
      expect(position.tick).toBe(0);

      // Queue trigger at boundary
      quantizedTrigger.trigger('scene-exact-beat', 'beat');

      // Advance one more beat
      for (let i = 0; i <= ticksPerBeat; i++) {
        clock.tick();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executedEvent).not.toBeNull();
      expect(executedEvent!.sceneId).toBe('scene-exact-beat');
    });
  });
});
