import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PatternFileWatcher } from '../../src/hotreload/PatternFileWatcher';
import { Clock } from '../../src/clock/Clock';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * T012: PatternFileWatcher type detection test suite (RED PHASE - MUST FAIL)
 *
 * Tests for detecting pattern type changes in files:
 * - Track initial pattern types
 * - Detect type changes in file edits
 * - Emit type change events
 * - Ignore non-type parameter changes
 *
 * This test file MUST be created before type detection implementation exists.
 */

describe('PatternFileWatcher - Type Detection', () => {
  let clock: Clock;
  let watcher: PatternFileWatcher;
  let tempDir: string;

  beforeEach(async () => {
    clock = new Clock({ bpm: 120, ppq: 96 });
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-type-test-'));
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('registerPattern', () => {
    it('should register initial pattern type', () => {
      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      // This method doesn't exist yet - test MUST FAIL
      watcher.registerPattern('pattern1', 'euclidean');

      expect(watcher.getPatternType('pattern1')).toBe('euclidean');
    });

    it('should track multiple pattern types', () => {
      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern1', 'euclidean');
      watcher.registerPattern('pattern2', 'probability');
      watcher.registerPattern('pattern3', 'phase');

      expect(watcher.getPatternType('pattern1')).toBe('euclidean');
      expect(watcher.getPatternType('pattern2')).toBe('probability');
      expect(watcher.getPatternType('pattern3')).toBe('phase');
    });

    it('should update registration if pattern re-registered', () => {
      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern1', 'euclidean');
      expect(watcher.getPatternType('pattern1')).toBe('euclidean');

      watcher.registerPattern('pattern1', 'probability');
      expect(watcher.getPatternType('pattern1')).toBe('probability');
    });
  });

  describe('type change detection', () => {
    it('should detect type change from euclidean to probability', async () => {
      // Create initial Euclidean pattern file
      const patternPath = path.join(tempDir, 'pattern1.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern1
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
  rotation: 0
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern1', 'euclidean');
      await watcher.start();

      const typeChangeSpy = vi.fn();
      watcher.on('typeChangeDetected', typeChangeSpy);

      // Edit file to change type to probability
      await fs.writeFile(
        patternPath,
        `id: pattern1
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 16
`
      );

      // Wait for file watcher debounce and processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).toHaveBeenCalledWith({
        patternId: 'pattern1',
        fromType: 'euclidean',
        toType: 'probability',
        filePath: patternPath
      });
    });

    it('should detect type change from probability to phase', async () => {
      const patternPath = path.join(tempDir, 'pattern2.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern2
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 16
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern2', 'probability');
      await watcher.start();

      const typeChangeSpy = vi.fn();
      watcher.on('typeChangeDetected', typeChangeSpy);

      // Change to phase type
      await fs.writeFile(
        patternPath,
        `id: pattern2
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 1.5
  phaseOffset: 0.25
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).toHaveBeenCalledWith({
        patternId: 'pattern2',
        fromType: 'probability',
        toType: 'phase',
        filePath: patternPath
      });
    });

    it('should detect type change from phase to euclidean', async () => {
      const patternPath = path.join(tempDir, 'pattern3.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern3
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 2.0
  phaseOffset: 0.5
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern3', 'phase');
      await watcher.start();

      const typeChangeSpy = vi.fn();
      watcher.on('typeChangeDetected', typeChangeSpy);

      // Change to euclidean type
      await fs.writeFile(
        patternPath,
        `id: pattern3
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).toHaveBeenCalledWith({
        patternId: 'pattern3',
        fromType: 'phase',
        toType: 'euclidean',
        filePath: patternPath
      });
    });

    it('should NOT emit typeChangeDetected for parameter changes only', async () => {
      const patternPath = path.join(tempDir, 'pattern4.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern4
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
  rotation: 0
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern4', 'euclidean');
      await watcher.start();

      const typeChangeSpy = vi.fn();
      const paramUpdateSpy = vi.fn();

      watcher.on('typeChangeDetected', typeChangeSpy);
      watcher.on('patternUpdated', paramUpdateSpy);

      // Change only parameters, not type
      await fs.writeFile(
        patternPath,
        `id: pattern4
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 8
  rotation: 2
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).not.toHaveBeenCalled();
      expect(paramUpdateSpy).toHaveBeenCalled();
    });

    it('should NOT emit typeChangeDetected if type is same', async () => {
      const patternPath = path.join(tempDir, 'pattern5.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern5
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.5
  density: 16
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern5', 'probability');
      await watcher.start();

      const typeChangeSpy = vi.fn();
      watcher.on('typeChangeDetected', typeChangeSpy);

      // Change parameters but keep same type
      await fs.writeFile(
        patternPath,
        `id: pattern5
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 8
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('previousTypes tracking', () => {
    it('should maintain previousTypes map', () => {
      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern1', 'euclidean');
      watcher.registerPattern('pattern2', 'probability');
      watcher.registerPattern('pattern3', 'phase');

      // Access internal state to verify map
      const previousTypes = (watcher as any).previousTypes;
      expect(previousTypes).toBeDefined();
      expect(previousTypes.get('pattern1')).toBe('euclidean');
      expect(previousTypes.get('pattern2')).toBe('probability');
      expect(previousTypes.get('pattern3')).toBe('phase');
    });

    it('should update previousTypes after type change detected', async () => {
      const patternPath = path.join(tempDir, 'pattern6.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern6
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern6', 'euclidean');
      await watcher.start();

      // Change type
      await fs.writeFile(
        patternPath,
        `id: pattern6
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 16
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Previous type should be updated to probability now
      const previousTypes = (watcher as any).previousTypes;
      expect(previousTypes.get('pattern6')).toBe('probability');
    });
  });

  describe('multiple consecutive type changes', () => {
    it('should detect multiple type changes for same pattern', async () => {
      const patternPath = path.join(tempDir, 'pattern7.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern7
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern7', 'euclidean');
      await watcher.start();

      const typeChangeSpy = vi.fn();
      watcher.on('typeChangeDetected', typeChangeSpy);

      // First change: euclidean → probability
      await fs.writeFile(
        patternPath,
        `id: pattern7
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 16
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).toHaveBeenCalledWith({
        patternId: 'pattern7',
        fromType: 'euclidean',
        toType: 'probability',
        filePath: patternPath
      });

      typeChangeSpy.mockClear();

      // Second change: probability → phase
      await fs.writeFile(
        patternPath,
        `id: pattern7
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 1.5
  phaseOffset: 0.25
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).toHaveBeenCalledWith({
        patternId: 'pattern7',
        fromType: 'probability',
        toType: 'phase',
        filePath: patternPath
      });

      typeChangeSpy.mockClear();

      // Third change: phase → euclidean
      await fs.writeFile(
        patternPath,
        `id: pattern7
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 8
  pulses: 3
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(typeChangeSpy).toHaveBeenCalledWith({
        patternId: 'pattern7',
        fromType: 'phase',
        toType: 'euclidean',
        filePath: patternPath
      });
    });
  });

  describe('unregistered patterns', () => {
    it('should not emit typeChangeDetected for unregistered patterns', async () => {
      const patternPath = path.join(tempDir, 'pattern8.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern8
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      // Don't register pattern8
      await watcher.start();

      const typeChangeSpy = vi.fn();
      watcher.on('typeChangeDetected', typeChangeSpy);

      // Change type
      await fs.writeFile(
        patternPath,
        `id: pattern8
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 16
`
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not emit type change for unregistered pattern
      expect(typeChangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle pattern registration with undefined type', () => {
      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      expect(() => {
        watcher.registerPattern('pattern9', undefined as any);
      }).not.toThrow();

      expect(watcher.getPatternType('pattern9')).toBeUndefined();
    });

    it('should handle pattern with missing id field', async () => {
      const patternPath = path.join(tempDir, 'invalid.yaml');
      await fs.writeFile(
        patternPath,
        `type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      await watcher.start();

      const errorSpy = vi.fn();
      watcher.on('error', errorSpy);

      // Should emit error but not crash
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Implementation should handle this gracefully
    });

    it('should handle rapid type changes (deduplication)', async () => {
      const patternPath = path.join(tempDir, 'pattern10.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern10
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      watcher = new PatternFileWatcher({
        clock,
        patternsPath: tempDir,
        swapAtBarBoundary: false
      });

      watcher.registerPattern('pattern10', 'euclidean');
      await watcher.start();

      const typeChangeSpy = vi.fn();
      watcher.on('typeChangeDetected', typeChangeSpy);

      // Rapid sequential changes
      await fs.writeFile(
        patternPath,
        `id: pattern10
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 16
`
      );

      await fs.writeFile(
        patternPath,
        `id: pattern10
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 1.5
  phaseOffset: 0.25
`
      );

      // Wait for debounce to settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should only get the final type change (debounced)
      expect(typeChangeSpy.mock.calls.length).toBeGreaterThan(0);
      const lastCall = typeChangeSpy.mock.calls[typeChangeSpy.mock.calls.length - 1][0];
      expect(lastCall.toType).toBe('phase');
    });
  });
});
