import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Clock } from '../../src/clock/Clock';

describe('Clock - Bar and Beat Events', () => {
  let clock: Clock;

  beforeEach(() => {
    clock = new Clock({ bpm: 120, ppq: 96 });
  });

  afterEach(() => {
    if (clock) {
      clock.stop();
    }
  });

  it('should emit bar event when crossing bar boundaries', async () => {
    const bars: number[] = [];

    clock.on('bar', (barNumber: number) => {
      bars.push(barNumber);
    });

    clock.start();

    // Wait for 3 bars at 120 BPM (each bar is 2 seconds at 4/4 time)
    // At 120 BPM: 1 bar = 4 beats = 2 seconds
    await new Promise(resolve => setTimeout(resolve, 4500)); // 2+ bars

    clock.stop();

    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(bars[0]).toBe(1);
    expect(bars[1]).toBe(2);
  });

  it('should emit beat event when crossing beat boundaries', async () => {
    const beats: number[] = [];

    clock.on('beat', (beatNumber: number) => {
      beats.push(beatNumber);
    });

    clock.start();

    // Wait for several beats at 120 BPM (each beat is 500ms)
    await new Promise(resolve => setTimeout(resolve, 2500)); // 5 beats

    clock.stop();

    expect(beats.length).toBeGreaterThanOrEqual(4);
    expect(beats[0]).toBe(1);
    expect(beats[1]).toBe(2);
    expect(beats[2]).toBe(3);
    expect(beats[3]).toBe(4);
  });

  it('should emit bar event on first tick', async () => {
    let firstBarEmitted = false;

    clock.on('bar', (barNumber: number) => {
      if (!firstBarEmitted) {
        expect(barNumber).toBe(1);
        firstBarEmitted = true;
      }
    });

    clock.start();

    // Wait a small amount of time for first tick
    await new Promise(resolve => setTimeout(resolve, 50));

    clock.stop();

    expect(firstBarEmitted).toBe(true);
  });
});
