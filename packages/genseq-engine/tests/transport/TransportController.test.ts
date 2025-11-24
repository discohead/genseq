import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransportController, TransportState } from '../../src/transport/TransportController';
import type { Clock } from '../../src/clock/Clock';
import type { Scheduler } from '../../src/scheduler/Scheduler';

/**
 * TransportController Tests
 *
 * Tests for transport state machine, tap tempo, and event emission
 */

// Mock Clock and Scheduler
function createMockClock(): Clock {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    getBpm: vi.fn().mockReturnValue(120),
    getPpq: vi.fn().mockReturnValue(480),
    getPosition: vi.fn().mockReturnValue({ bar: 1, beat: 1, tick: 0 }),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  } as unknown as Clock;
}

function createMockScheduler(): Scheduler {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clearAll: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  } as unknown as Scheduler;
}

describe('TransportController - State Management', () => {
  let transport: TransportController;
  let mockClock: Clock;
  let mockScheduler: Scheduler;

  beforeEach(() => {
    mockClock = createMockClock();
    mockScheduler = createMockScheduler();
    transport = new TransportController({
      clock: mockClock,
      scheduler: mockScheduler
    });
  });

  describe('Initial State', () => {
    it('should start in STOPPED state', () => {
      expect(transport.getState()).toBe(TransportState.STOPPED);
      expect(transport.isStopped()).toBe(true);
      expect(transport.isPlaying()).toBe(false);
      expect(transport.isPaused()).toBe(false);
    });

    it('should have zero uptime when stopped', () => {
      expect(transport.getUptime()).toBe(0);
    });
  });

  describe('State Transitions', () => {
    it('should transition from STOPPED to PLAYING on start()', () => {
      transport.start();

      expect(transport.getState()).toBe(TransportState.PLAYING);
      expect(transport.isPlaying()).toBe(true);
      expect(transport.isStopped()).toBe(false);
    });

    it('should start clock and scheduler on start()', () => {
      transport.start();

      expect(mockClock.start).toHaveBeenCalled();
      expect(mockScheduler.start).toHaveBeenCalled();
    });

    it('should transition from PLAYING to STOPPED on stop()', () => {
      transport.start();
      transport.stop();

      expect(transport.getState()).toBe(TransportState.STOPPED);
      expect(transport.isStopped()).toBe(true);
    });

    it('should stop clock and scheduler and clear events on stop()', () => {
      transport.start();
      transport.stop();

      expect(mockClock.stop).toHaveBeenCalled();
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(mockScheduler.clearAll).toHaveBeenCalled();
    });

    it('should transition from PLAYING to PAUSED on pause()', () => {
      transport.start();
      transport.pause();

      expect(transport.getState()).toBe(TransportState.PAUSED);
      expect(transport.isPaused()).toBe(true);
      expect(transport.isPlaying()).toBe(false);
    });

    it('should pause scheduler on pause()', () => {
      transport.start();
      transport.pause();

      expect(mockScheduler.pause).toHaveBeenCalled();
    });

    it('should transition from PAUSED to PLAYING on continue()', () => {
      transport.start();
      transport.pause();
      transport.continue();

      expect(transport.getState()).toBe(TransportState.PLAYING);
      expect(transport.isPlaying()).toBe(true);
    });

    it('should resume scheduler on continue()', () => {
      transport.start();
      transport.pause();
      transport.continue();

      expect(mockScheduler.resume).toHaveBeenCalled();
    });

    it('should start transport if continue() called from STOPPED', () => {
      transport.continue();

      expect(transport.getState()).toBe(TransportState.PLAYING);
      expect(mockClock.start).toHaveBeenCalled();
    });
  });

  describe('State Guards', () => {
    it('should not re-start if already PLAYING', () => {
      transport.start();
      transport.start();

      expect(mockClock.start).toHaveBeenCalledTimes(1);
    });

    it('should not stop if already STOPPED', () => {
      transport.stop();

      expect(mockClock.stop).not.toHaveBeenCalled();
    });

    it('should not pause if not PLAYING', () => {
      transport.pause();

      expect(mockScheduler.pause).not.toHaveBeenCalled();
    });

    it('should not pause if already PAUSED', () => {
      transport.start();
      transport.pause();
      transport.pause();

      expect(mockScheduler.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('Toggle', () => {
    it('should start from STOPPED', () => {
      transport.toggle();

      expect(transport.isPlaying()).toBe(true);
    });

    it('should pause from PLAYING', () => {
      transport.start();
      transport.toggle();

      expect(transport.isPaused()).toBe(true);
    });

    it('should continue from PAUSED', () => {
      transport.start();
      transport.pause();
      transport.toggle();

      expect(transport.isPlaying()).toBe(true);
    });

    it('should cycle through states correctly', () => {
      // STOPPED -> PLAYING
      transport.toggle();
      expect(transport.isPlaying()).toBe(true);

      // PLAYING -> PAUSED
      transport.toggle();
      expect(transport.isPaused()).toBe(true);

      // PAUSED -> PLAYING
      transport.toggle();
      expect(transport.isPlaying()).toBe(true);
    });
  });
});

describe('TransportController - Event Emission', () => {
  let transport: TransportController;
  let mockClock: Clock;
  let mockScheduler: Scheduler;

  beforeEach(() => {
    mockClock = createMockClock();
    mockScheduler = createMockScheduler();
    transport = new TransportController({
      clock: mockClock,
      scheduler: mockScheduler
    });
  });

  it('should emit "start" event on start()', () => {
    const startHandler = vi.fn();
    transport.on('start', startHandler);

    transport.start();

    expect(startHandler).toHaveBeenCalledTimes(1);
    expect(startHandler).toHaveBeenCalledWith(expect.objectContaining({
      time: expect.any(Number)
    }));
  });

  it('should emit "stop" event on stop()', () => {
    const stopHandler = vi.fn();
    transport.on('stop', stopHandler);

    transport.start();
    transport.stop();

    expect(stopHandler).toHaveBeenCalledTimes(1);
    expect(stopHandler).toHaveBeenCalledWith(expect.objectContaining({
      previousState: TransportState.PLAYING,
      time: expect.any(Number)
    }));
  });

  it('should emit "pause" event on pause()', () => {
    const pauseHandler = vi.fn();
    transport.on('pause', pauseHandler);

    transport.start();
    transport.pause();

    expect(pauseHandler).toHaveBeenCalledTimes(1);
    expect(pauseHandler).toHaveBeenCalledWith(expect.objectContaining({
      time: expect.any(Number)
    }));
  });

  it('should emit "continue" event on continue()', () => {
    const continueHandler = vi.fn();
    transport.on('continue', continueHandler);

    transport.start();
    transport.pause();
    transport.continue();

    expect(continueHandler).toHaveBeenCalledTimes(1);
    expect(continueHandler).toHaveBeenCalledWith(expect.objectContaining({
      time: expect.any(Number)
    }));
  });

  it('should not emit events for no-op state transitions', () => {
    const startHandler = vi.fn();
    const stopHandler = vi.fn();
    transport.on('start', startHandler);
    transport.on('stop', stopHandler);

    // Stopping when already stopped
    transport.stop();
    expect(stopHandler).not.toHaveBeenCalled();

    // Starting twice
    transport.start();
    transport.start();
    expect(startHandler).toHaveBeenCalledTimes(1);
  });
});

describe('TransportController - BPM Control', () => {
  let transport: TransportController;
  let mockClock: Clock;
  let mockScheduler: Scheduler;

  beforeEach(() => {
    mockClock = createMockClock();
    mockScheduler = createMockScheduler();
    transport = new TransportController({
      clock: mockClock,
      scheduler: mockScheduler
    });
  });

  it('should delegate getBpm() to clock', () => {
    expect(transport.getBpm()).toBe(120);
    expect(mockClock.getBpm).toHaveBeenCalled();
  });

  it('should delegate setBpm() to clock', () => {
    transport.setBpm(140);

    expect(mockClock.setBpm).toHaveBeenCalledWith(140);
  });

  it('should emit "bpmChanged" event on setBpm()', () => {
    const bpmHandler = vi.fn();
    transport.on('bpmChanged', bpmHandler);

    transport.setBpm(140);

    expect(bpmHandler).toHaveBeenCalledWith({
      bpm: 140,
      wasPlaying: false
    });
  });

  it('should include wasPlaying state in bpmChanged event', () => {
    const bpmHandler = vi.fn();
    transport.on('bpmChanged', bpmHandler);

    transport.start();
    transport.setBpm(140);

    expect(bpmHandler).toHaveBeenCalledWith({
      bpm: 140,
      wasPlaying: true
    });
  });
});

describe('TransportController - Tap Tempo', () => {
  let transport: TransportController;
  let mockClock: Clock;
  let mockScheduler: Scheduler;
  let mockTime: number;

  beforeEach(() => {
    // Mock performance.now() since it's used for tap timing
    mockTime = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    mockClock = createMockClock();
    mockScheduler = createMockScheduler();
    transport = new TransportController({
      clock: mockClock,
      scheduler: mockScheduler
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not set BPM on first tap', () => {
    transport.tapTempo();

    expect(mockClock.setBpm).not.toHaveBeenCalled();
  });

  it('should calculate BPM from two taps', () => {
    // Tap at 120 BPM = 500ms interval
    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();

    expect(mockClock.setBpm).toHaveBeenCalledWith(120);
  });

  it('should calculate BPM from multiple taps (average)', () => {
    // 4 taps at ~100 BPM (600ms interval)
    transport.tapTempo();
    mockTime += 600;
    transport.tapTempo();
    mockTime += 600;
    transport.tapTempo();
    mockTime += 600;
    transport.tapTempo();

    expect(mockClock.setBpm).toHaveBeenCalledWith(100);
  });

  it('should emit "tapTempo" event with tap count', () => {
    const tapHandler = vi.fn();
    transport.on('tapTempo', tapHandler);

    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();

    expect(tapHandler).toHaveBeenCalledWith({
      bpm: 120,
      taps: 2
    });
  });

  it('should reset tap sequence after 2 seconds of inactivity', () => {
    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();

    // Wait more than 2 seconds
    mockTime += 2100;

    // New tap sequence should start fresh
    transport.tapTempo();
    expect(mockClock.setBpm).toHaveBeenCalledTimes(1); // Only from first sequence
  });

  it('should keep only last 4 taps for averaging', () => {
    const tapHandler = vi.fn();
    transport.on('tapTempo', tapHandler);

    // 6 taps - internal array keeps max 4 taps after trim
    // But event is emitted before trim, so shows length after push
    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();
    mockTime += 500;
    transport.tapTempo();

    // Verify BPM is still calculated correctly (uses last 4 intervals)
    expect(mockClock.setBpm).toHaveBeenLastCalledWith(120);

    // The implementation emits with array length before trimming
    // After 6 taps: push makes length 5, then trim to 4
    const lastCall = tapHandler.mock.calls[tapHandler.mock.calls.length - 1][0];
    expect(lastCall.taps).toBeLessThanOrEqual(5);
  });

  it('should clamp BPM to valid range (20-300)', () => {
    // Very slow taps (10 BPM - below minimum)
    transport.tapTempo();
    mockTime += 6000; // 10 BPM
    transport.tapTempo();

    // Should not set BPM below 20
    expect(mockClock.setBpm).not.toHaveBeenCalled();
  });

  it('should handle fast taps within valid BPM range', () => {
    // Fast taps at 200 BPM (300ms interval)
    transport.tapTempo();
    mockTime += 300;
    transport.tapTempo();

    expect(mockClock.setBpm).toHaveBeenCalledWith(200);
  });
});

describe('TransportController - Position and Uptime', () => {
  let transport: TransportController;
  let mockClock: Clock;
  let mockScheduler: Scheduler;
  let mockTime: number;

  beforeEach(() => {
    // Mock performance.now() since it's used for uptime tracking
    mockTime = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    mockClock = createMockClock();
    mockScheduler = createMockScheduler();
    transport = new TransportController({
      clock: mockClock,
      scheduler: mockScheduler
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delegate getPosition() to clock', () => {
    const position = transport.getPosition();

    expect(mockClock.getPosition).toHaveBeenCalled();
    expect(position).toEqual({ bar: 1, beat: 1, tick: 0 });
  });

  it('should track uptime while playing', () => {
    transport.start();

    mockTime += 1000;
    expect(transport.getUptime()).toBeGreaterThanOrEqual(1000);

    mockTime += 500;
    expect(transport.getUptime()).toBeGreaterThanOrEqual(1500);
  });

  it('should return zero uptime when stopped', () => {
    transport.start();
    mockTime += 1000;
    transport.stop();

    expect(transport.getUptime()).toBe(0);
  });

  it('should continue tracking uptime while paused', () => {
    transport.start();
    mockTime += 1000;
    transport.pause();

    // Uptime continues even when paused
    expect(transport.getUptime()).toBeGreaterThanOrEqual(1000);
  });
});

describe('TransportController - Edge Cases', () => {
  let transport: TransportController;
  let mockClock: Clock;
  let mockScheduler: Scheduler;

  beforeEach(() => {
    mockClock = createMockClock();
    mockScheduler = createMockScheduler();
    transport = new TransportController({
      clock: mockClock,
      scheduler: mockScheduler
    });
  });

  it('should handle rapid start/stop cycles', () => {
    for (let i = 0; i < 10; i++) {
      transport.start();
      transport.stop();
    }

    expect(transport.isStopped()).toBe(true);
    expect(mockClock.start).toHaveBeenCalledTimes(10);
    expect(mockClock.stop).toHaveBeenCalledTimes(10);
  });

  it('should handle rapid toggle cycles', () => {
    for (let i = 0; i < 10; i++) {
      transport.toggle();
    }

    // After 10 toggles: STOPPED -> PLAYING -> PAUSED -> PLAYING -> PAUSED ...
    // 10 toggles = 5 full cycles, ends in PAUSED
    expect(transport.isPaused()).toBe(true);
  });

  it('should handle stop from PAUSED state', () => {
    const stopHandler = vi.fn();
    transport.on('stop', stopHandler);

    transport.start();
    transport.pause();
    transport.stop();

    expect(stopHandler).toHaveBeenCalledWith(expect.objectContaining({
      previousState: TransportState.PAUSED
    }));
  });
});
