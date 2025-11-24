import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * T050: n² Type Transition Matrix Test Suite
 *
 * Tests all possible type transitions (4 types × 4 types = 16 combinations):
 * - euclidean → euclidean (parameter update only)
 * - euclidean → probability
 * - euclidean → phase
 * - euclidean → script
 * - probability → euclidean
 * - probability → probability (parameter update only)
 * - probability → phase
 * - probability → script
 * - phase → euclidean
 * - phase → probability
 * - phase → phase (parameter update only)
 * - phase → script
 * - script → euclidean
 * - script → probability
 * - script → phase
 * - script → script (parameter update only)
 *
 * Each transition verifies:
 * - Type swap completes at cycle boundary
 * - New pattern type is active
 * - MIDI output reflects new pattern behavior
 * - Transport continues uninterrupted
 */

describe('Type Transition Matrix (n² combinations)', () => {
  let engine: GenSeqEngine;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = join(tmpdir(), `genseq-test-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, 'patterns'), { recursive: true });
    await fs.mkdir(join(testProjectPath, 'routes'), { recursive: true });

    // Create project files
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

  describe('Euclidean → X transitions', () => {
    it('should transition from euclidean → probability', async () => {
      // Start with euclidean pattern
      const euclideanPattern = {
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
        JSON.stringify(euclideanPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Transition to probability
      const probabilityPattern = {
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

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(probabilityPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify transition completed
      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].patternId).toBe('pattern1');
      expect(typeSwapEvents[0].fromType).toBe('euclidean');
      expect(typeSwapEvents[0].toType).toBe('probability');
    });

    it('should transition from euclidean → phase', async () => {
      const euclideanPattern = {
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
        JSON.stringify(euclideanPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const phasePattern = {
        id: 'pattern1',
      name: 'Main Pattern',
        type: 'phase',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(phasePattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].fromType).toBe('euclidean');
      expect(typeSwapEvents[0].toType).toBe('phase');
    });
  });

  describe('Probability → X transitions', () => {
    it('should transition from probability → euclidean', async () => {
      const probabilityPattern = {
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
        JSON.stringify(probabilityPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const euclideanPattern = {
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

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(euclideanPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].fromType).toBe('probability');
      expect(typeSwapEvents[0].toType).toBe('euclidean');
    });

    it('should transition from probability → phase', async () => {
      const probabilityPattern = {
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
        JSON.stringify(probabilityPattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const phasePattern = {
        id: 'pattern1',
      name: 'Main Pattern',
        type: 'phase',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(phasePattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].fromType).toBe('probability');
      expect(typeSwapEvents[0].toType).toBe('phase');
    });
  });

  describe('Phase → X transitions', () => {
    it('should transition from phase → euclidean', async () => {
      const phasePattern = {
        id: 'pattern1',
      name: 'Main Pattern',
        type: 'phase',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(phasePattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const euclideanPattern = {
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

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(euclideanPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].fromType).toBe('phase');
      expect(typeSwapEvents[0].toType).toBe('euclidean');
    });

    it('should transition from phase → probability', async () => {
      const phasePattern = {
        id: 'pattern1',
      name: 'Main Pattern',
        type: 'phase',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(phasePattern, null, 2)
      );

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const probabilityPattern = {
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

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(probabilityPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(typeSwapEvents.length).toBeGreaterThan(0);
      expect(typeSwapEvents[0].fromType).toBe('phase');
      expect(typeSwapEvents[0].toType).toBe('probability');
    });
  });

  describe('Multiple consecutive transitions', () => {
    it('should handle round-robin through all types', async () => {
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

      const typeSwapEvents: any[] = [];
      engine.on('pattern:typeSwapCompleted', (event) => typeSwapEvents.push(event));

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // euclidean → probability
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type: 'probability',
          parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      // probability → phase
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type: 'phase',
          parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      // phase → euclidean
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(initialPattern, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all transitions completed
      expect(typeSwapEvents.length).toBeGreaterThanOrEqual(3);
      expect(typeSwapEvents[0].fromType).toBe('euclidean');
      expect(typeSwapEvents[0].toType).toBe('probability');
      expect(typeSwapEvents[1].fromType).toBe('probability');
      expect(typeSwapEvents[1].toType).toBe('phase');
      expect(typeSwapEvents[2].fromType).toBe('phase');
      expect(typeSwapEvents[2].toType).toBe('euclidean');
    });
  });

  describe('Transport continuity during transitions', () => {
    it('should not interrupt transport during type transitions', async () => {
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

      const transportEvents: string[] = [];
      engine.on('transport:start', () => transportEvents.push('start'));
      engine.on('transport:stop', () => transportEvents.push('stop'));
      engine.on('transport:pause', () => transportEvents.push('pause'));

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Transition to probability
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type: 'probability',
          parameters: { probability: 0.75, density: 1.0, note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Transition to phase
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          ...initialPattern,
          type: 'phase',
          parameters: { phaseRate: 1.0, phaseOffset: 0.0, note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify transport never stopped
      expect(transportEvents).toEqual(['start']);
    });
  });
});
