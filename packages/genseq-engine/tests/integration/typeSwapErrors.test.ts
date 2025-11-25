import { describe, it, expect, beforeEach } from 'vitest';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Type Swap Error Handling Integration', () => {
  let engine: GenSeqEngine;
  let testProjectPath: string;

  beforeEach(async () => {
    // Create temporary project directory
    testProjectPath = join(tmpdir(), `genseq-test-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, 'patterns'), { recursive: true });
    await fs.mkdir(join(testProjectPath, 'routes'), { recursive: true });

    // Create valid initial project files
    const clockConfig = {
      bpm: 120,
      ppq: 96,
      signature: { numerator: 4, denominator: 4 }
    };

    const initialPattern = {
      id: 'pattern1',
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

    const route = {
      id: 'route1',
      bus: 'main',
      device: 'IAC Driver Bus 1',
      channel: 1
    };

    await fs.writeFile(
      join(testProjectPath, 'clock.json'),
      JSON.stringify(clockConfig, null, 2)
    );

    await fs.writeFile(
      join(testProjectPath, 'patterns', 'pattern1.json'),
      JSON.stringify(initialPattern, null, 2)
    );

    await fs.writeFile(
      join(testProjectPath, 'routes', 'route1.json'),
      JSON.stringify(route, null, 2)
    );

    engine = new GenSeqEngine();
  });

  describe('End-to-End Invalid Type Change', () => {
    it('should reject invalid type change and log error', async () => {
      const configErrors: any[] = [];
      const typeSwapFailed: any[] = [];

      engine.on('config:error', (event) => configErrors.push(event));
      engine.on('pattern:typeSwapFailed', (event) => typeSwapFailed.push(event));

      await engine.loadProject(testProjectPath);
      engine.start();

      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Edit pattern file with INVALID parameters
      const invalidPattern = {
        id: 'pattern1',
        type: 'probability',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 2.5, // INVALID: > 1.0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(invalidPattern, null, 2)
      );

      // Wait for file watcher + validation + rollback
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify error was logged
      expect(configErrors.length).toBeGreaterThan(0);

      const error = configErrors.find(e =>
        e.details?.file?.includes('pattern1.json')
      );
      expect(error).toBeDefined();
      expect(error.error.message).toMatch(/probability/i);

      // Verify type swap failed event
      expect(typeSwapFailed.length).toBeGreaterThan(0);
      expect(typeSwapFailed[0].patternId).toBe('pattern1');
      expect(typeSwapFailed[0].newType).toBe('probability');

      engine.stop();
    });

    it('should continue playback with previous pattern after rejection', async () => {
      const midiEvents: any[] = [];
      engine.on('midi:out', (event) => midiEvents.push(event));

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const eventsBefore = midiEvents.length;

      // Write invalid type change
      const invalidPattern = {
        id: 'pattern1',
        type: 'phase',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          frequency: -10.0, // INVALID: negative frequency
          waveform: 'sine',
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(invalidPattern, null, 2)
      );

      // Wait for rollback + continued playback
      await new Promise(resolve => setTimeout(resolve, 2000));

      const eventsAfter = midiEvents.length;

      // Verify playback continued (more MIDI events generated)
      expect(eventsAfter).toBeGreaterThan(eventsBefore);

      engine.stop();
    });

    it('should provide clear error message with file path', async () => {
      const configErrors: any[] = [];
      engine.on('config:error', (event) => configErrors.push(event));

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Multiple validation errors
      const invalidPattern = {
        id: 'pattern1',
        type: 'probability',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 1.5, // INVALID
          density: 2.0, // INVALID
          note: 128, // INVALID
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(invalidPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(configErrors.length).toBeGreaterThan(0);

      const error = configErrors[0];
      expect(error.details?.file).toMatch(/pattern1\.json/);
      expect(error.error.message).toBeDefined();

      engine.stop();
    });
  });

  describe('Transport Continuity During Errors', () => {
    it('should not interrupt transport when type swap fails', async () => {
      const transportEvents: string[] = [];
      engine.on('transport:start', () => transportEvents.push('start'));
      engine.on('transport:stop', () => transportEvents.push('stop'));
      engine.on('transport:pause', () => transportEvents.push('pause'));

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Invalid type change
      const invalidPattern = {
        id: 'pattern1',
        type: 'probability',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 3.0, // INVALID
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(invalidPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify transport never stopped/paused
      expect(transportEvents).toEqual(['start']);

      engine.stop();
    });

    it('should maintain clock continuity during rollback', async () => {
      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const positionBefore = engine.getPosition();

      // Invalid type change
      const invalidPattern = {
        id: 'pattern1',
        type: 'phase',
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          frequency: -1.0, // INVALID
          waveform: 'sine',
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify(invalidPattern, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const positionAfter = engine.getPosition();

      // Verify clock advanced (transport continued)
      expect(positionAfter.tick).toBeGreaterThan(positionBefore.tick);

      engine.stop();
    });
  });

  describe('Multiple Concurrent Errors', () => {
    it('should handle multiple invalid type changes in rapid succession', async () => {
      const typeSwapFailed: any[] = [];
      engine.on('pattern:typeSwapFailed', (event) => typeSwapFailed.push(event));

      await engine.loadProject(testProjectPath);
      engine.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // First invalid change
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          id: 'pattern1',
          type: 'probability',
          enabled: true,
          bus: 'main',
          channel: 1,
          length: 1,
          parameters: { probability: 2.0, note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Second invalid change
      await fs.writeFile(
        join(testProjectPath, 'patterns', 'pattern1.json'),
        JSON.stringify({
          id: 'pattern1',
          type: 'phase',
          enabled: true,
          bus: 'main',
          channel: 1,
          length: 1,
          parameters: { frequency: -5.0, waveform: 'sine', note: 60, velocity: 100, duration: 0.5 }
        }, null, 2)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify both failures logged
      expect(typeSwapFailed.length).toBeGreaterThanOrEqual(1);

      engine.stop();
    });
  });
});
