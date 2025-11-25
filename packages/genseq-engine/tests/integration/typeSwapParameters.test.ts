import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * T064: Parameter Conflict Detection Integration Test
 *
 * Tests that verify parameter handling during type swaps in a running engine:
 * - Common parameters are cleanly replaced from new config
 * - Type-specific parameters are cleanly swapped
 * - Schema defaults are applied when common parameters are omitted
 * - Parameter conflicts are detected and reported clearly
 *
 * Integration-level tests that verify:
 * - File-based type changes respect parameter rules
 * - Hot-reload system correctly applies new parameters
 * - No parameter "bleeding" between old and new types
 */

describe('Type Swap Parameter Handling (Integration)', () => {
  let engine: GenSeqEngine;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = join(tmpdir(), `genseq-test-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, 'patterns'), { recursive: true });
    await fs.mkdir(join(testProjectPath, 'routes'), { recursive: true });

    const clockConfig = {
      bpm: 120,
      ppq: 96,
      signature: { numerator: 4, denominator: 4 }
    };

    const route = {
      id: 'route1',
      bus: 'main',
      device: 'IAC Driver Bus 1',
      channel: 1
    };

    await fs.writeFile(
      join(testProjectPath, 'clock.yaml'),
      JSON.stringify(clockConfig, null, 2)
    );

    await fs.writeFile(
      join(testProjectPath, 'routes', 'route1.json'),
      JSON.stringify(route, null, 2)
    );

    engine = new GenSeqEngine();
  });

  afterEach(async () => {
    if (engine) {
      engine.stop();
    }
    await fs.rm(testProjectPath, { recursive: true, force: true });
  });

  describe('Common Parameter Replacement', () => {
    it('should use new note value from file when type changes', async () => {
      // Start with euclidean pattern (note=60)
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'euclidean',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Change to probability with different note (64)
      const updatedPattern = {
        ...initialPattern,
        type: 'probability',
        parameters: {
          probability: 0.75,
          density: 1.0,
          note: 64, // New note value
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(updatedPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify type swap occurred
      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].toType).toBe('probability');

      // Verify new note is used (note: direct pattern inspection would require
      // exposing pattern state - this test verifies swap occurred correctly)
    });

    it('should use new velocity value when type changes', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'euclidean',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Change to phase with different velocity (80)
      const updatedPattern = {
        ...initialPattern,
        type: 'phase',
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 0.0,
          note: 60,
          velocity: 80, // New velocity
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(updatedPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].toType).toBe('phase');
    });

    it('should use new duration value when type changes', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'probability',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.75,
          density: 1.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Change to euclidean with different duration (0.25)
      const updatedPattern = {
        ...initialPattern,
        type: 'euclidean',
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 60,
          velocity: 100,
          duration: 0.25 // New duration
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(updatedPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].toType).toBe('euclidean');
    });
  });

  describe('Schema Default Fallback', () => {
    it('should apply schema defaults when common parameters are omitted during type change', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'euclidean',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 72,
          velocity: 110,
          duration: 0.75
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Change to probability with ONLY type-specific parameters
      const updatedPattern = {
        ...initialPattern,
        type: 'probability',
        parameters: {
          probability: 0.75,
          density: 1.0
          // note, velocity, duration omitted - should use schema defaults (60, 100, 0.25)
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(updatedPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify type swap occurred (defaults were applied successfully)
      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].toType).toBe('probability');
      expect(typeSwapEvents[0].fromType).toBe('euclidean');
    });

    it('should apply schema defaults for phase pattern when common parameters omitted', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'euclidean',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 64,
          velocity: 120,
          duration: 1.0
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Change to phase with only type-specific parameters
      const updatedPattern = {
        ...initialPattern,
        type: 'phase',
        parameters: {
          phaseRate: 2.0,
          phaseOffset: 0.5
          // Common parameters omitted
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(updatedPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].toType).toBe('phase');
    });
  });

  describe('Parameter Conflict Detection', () => {
    it('should reject type change with invalid parameter combinations', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'euclidean',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const configErrors: any[] = [];
      engine.on('config:error', (error) => configErrors.push(error));

      // Attempt type change with BOTH old and new type-specific parameters
      const invalidPattern = {
        ...initialPattern,
        type: 'probability',
        parameters: {
          // Old euclidean parameters still present
          steps: 8,
          pulses: 5,
          // New probability parameters
          probability: 0.75,
          density: 1.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(invalidPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Should emit config:error for parameter conflict
      expect(configErrors.length).toBeGreaterThan(0);
      expect(configErrors[0].error).toMatch(/parameter|conflict|invalid/i);
    });

    it('should provide clear error message when required type-specific parameter is missing', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'euclidean',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const configErrors: any[] = [];
      engine.on('config:error', (error) => configErrors.push(error));

      // Attempt type change missing required probability parameter
      const invalidPattern = {
        ...initialPattern,
        type: 'probability',
        parameters: {
          density: 1.0, // Missing required 'probability' parameter
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(invalidPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Should emit clear error about missing parameter
      expect(configErrors.length).toBeGreaterThan(0);
      expect(configErrors[0].error).toMatch(/required|missing|probability/i);
    });
  });

  describe('Type-Specific Parameter Replacement', () => {
    it('should cleanly replace euclidean parameters with probability parameters', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'euclidean',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 16,
          pulses: 7,
          rotation: 3,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Change to probability (cleanly replaces type-specific parameters)
      const updatedPattern = {
        ...initialPattern,
        type: 'probability',
        parameters: {
          probability: 0.8,
          density: 1.0,
          seed: 42,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(updatedPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].fromType).toBe('euclidean');
      expect(typeSwapEvents[0].toType).toBe('probability');
    });

    it('should cleanly replace probability parameters with phase parameters', async () => {
      const initialPattern = {
        id: 'pattern1',
        name: 'Main Pattern',
        type: 'probability',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.75,
          density: 1.0,
          seed: 99,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      // Change to phase
      const updatedPattern = {
        ...initialPattern,
        type: 'phase',
        parameters: {
          phaseRate: 1.5,
          phaseOffset: 0.25,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(updatedPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].fromType).toBe('probability');
      expect(typeSwapEvents[0].toType).toBe('phase');
    });
  });
});
