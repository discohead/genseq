import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ClockEntityValidator,
  ClockEntityLoader,
  type ClockEntity
} from '../../src/config/entities/ClockEntity';
import {
  PatternEntityValidator,
  PatternEntityLoader,
  type PatternEntity
} from '../../src/config/entities/PatternEntity';
import {
  RouteEntityValidator,
  RouteEntityLoader,
  type RouteEntity
} from '../../src/config/entities/RouteEntity';

/**
 * Entity Model Tests
 *
 * Tests for ClockEntity, PatternEntity, and RouteEntity validation and loading
 */

// Helper to create temp directory for file tests
let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genseq-entity-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// ClockEntity Tests
// ============================================================================

describe('ClockEntityValidator', () => {
  describe('Valid Configurations', () => {
    it('should validate minimal valid config', () => {
      const config = { bpm: 120, ppq: 480 };
      const result = ClockEntityValidator.validate(config);

      expect(result.bpm).toBe(120);
      expect(result.ppq).toBe(480);
    });

    it('should validate config with all fields', () => {
      const config = {
        bpm: 140,
        ppq: 960,
        timeSignature: { numerator: 3, denominator: 4 },
        swing: 50
      };
      const result = ClockEntityValidator.validate(config);

      expect(result.bpm).toBe(140);
      expect(result.ppq).toBe(960);
      expect(result.timeSignature).toEqual({ numerator: 3, denominator: 4 });
      expect(result.swing).toBe(50);
    });

    it('should provide default timeSignature and swing', () => {
      const config = { bpm: 120, ppq: 480 };
      const result = ClockEntityValidator.validate(config);

      expect(result.timeSignature).toEqual({ numerator: 4, denominator: 4 });
      expect(result.swing).toBe(0);
    });

    it('should accept all valid PPQ values', () => {
      const validPPQ = [24, 48, 96, 192, 384, 480, 960];

      for (const ppq of validPPQ) {
        const result = ClockEntityValidator.validate({ bpm: 120, ppq });
        expect(result.ppq).toBe(ppq);
      }
    });

    it('should accept BPM at boundaries', () => {
      expect(ClockEntityValidator.validate({ bpm: 20, ppq: 480 }).bpm).toBe(20);
      expect(ClockEntityValidator.validate({ bpm: 999, ppq: 480 }).bpm).toBe(999);
    });

    it('should accept swing at boundaries', () => {
      expect(ClockEntityValidator.validate({ bpm: 120, ppq: 480, swing: 0 }).swing).toBe(0);
      expect(ClockEntityValidator.validate({ bpm: 120, ppq: 480, swing: 100 }).swing).toBe(100);
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject null config', () => {
      expect(() => ClockEntityValidator.validate(null)).toThrow('Clock configuration must be an object');
    });

    it('should reject non-object config', () => {
      expect(() => ClockEntityValidator.validate('invalid')).toThrow('Clock configuration must be an object');
    });

    it('should reject missing BPM', () => {
      expect(() => ClockEntityValidator.validate({ ppq: 480 })).toThrow('Clock BPM must be a number');
    });

    it('should reject non-numeric BPM', () => {
      expect(() => ClockEntityValidator.validate({ bpm: '120', ppq: 480 })).toThrow('Clock BPM must be a number');
    });

    it('should reject BPM below 20', () => {
      expect(() => ClockEntityValidator.validate({ bpm: 19, ppq: 480 })).toThrow('Clock BPM must be between 20 and 999');
    });

    it('should reject BPM above 999', () => {
      expect(() => ClockEntityValidator.validate({ bpm: 1000, ppq: 480 })).toThrow('Clock BPM must be between 20 and 999');
    });

    it('should reject missing PPQ', () => {
      expect(() => ClockEntityValidator.validate({ bpm: 120 })).toThrow('Clock PPQ must be an integer');
    });

    it('should reject non-integer PPQ', () => {
      expect(() => ClockEntityValidator.validate({ bpm: 120, ppq: 480.5 })).toThrow('Clock PPQ must be an integer');
    });

    it('should reject invalid PPQ values', () => {
      expect(() => ClockEntityValidator.validate({ bpm: 120, ppq: 100 })).toThrow('Clock PPQ must be one of');
    });

    it('should reject invalid time signature numerator', () => {
      expect(() => ClockEntityValidator.validate({
        bpm: 120,
        ppq: 480,
        timeSignature: { numerator: 0, denominator: 4 }
      })).toThrow('Time signature numerator must be between 1 and 32');
    });

    it('should reject invalid time signature denominator', () => {
      expect(() => ClockEntityValidator.validate({
        bpm: 120,
        ppq: 480,
        timeSignature: { numerator: 4, denominator: 3 }
      })).toThrow('Time signature denominator must be one of');
    });

    it('should reject swing below 0', () => {
      expect(() => ClockEntityValidator.validate({ bpm: 120, ppq: 480, swing: -1 })).toThrow('Swing must be between 0 and 100');
    });

    it('should reject swing above 100', () => {
      expect(() => ClockEntityValidator.validate({ bpm: 120, ppq: 480, swing: 101 })).toThrow('Swing must be between 0 and 100');
    });
  });
});

describe('ClockEntityLoader', () => {
  describe('loadFromFile', () => {
    it('should load from JSON file', () => {
      const filePath = path.join(tempDir, 'clock.json');
      fs.writeFileSync(filePath, JSON.stringify({ bpm: 120, ppq: 480 }));

      const result = ClockEntityLoader.loadFromFile(filePath);

      expect(result.bpm).toBe(120);
      expect(result.ppq).toBe(480);
    });

    it('should load from YAML file', () => {
      const filePath = path.join(tempDir, 'clock.yaml');
      fs.writeFileSync(filePath, 'bpm: 140\nppq: 960');

      const result = ClockEntityLoader.loadFromFile(filePath);

      expect(result.bpm).toBe(140);
      expect(result.ppq).toBe(960);
    });

    it('should load from YML file', () => {
      const filePath = path.join(tempDir, 'clock.yml');
      fs.writeFileSync(filePath, 'bpm: 100\nppq: 96');

      const result = ClockEntityLoader.loadFromFile(filePath);

      expect(result.bpm).toBe(100);
      expect(result.ppq).toBe(96);
    });

    it('should throw for non-existent file', () => {
      expect(() => ClockEntityLoader.loadFromFile('/non/existent/file.json'))
        .toThrow('Clock file not found');
    });

    it('should throw for unsupported format', () => {
      const filePath = path.join(tempDir, 'clock.txt');
      fs.writeFileSync(filePath, 'bpm: 120');

      expect(() => ClockEntityLoader.loadFromFile(filePath))
        .toThrow('Unsupported clock file format');
    });

    it('should throw for malformed JSON', () => {
      const filePath = path.join(tempDir, 'clock.json');
      fs.writeFileSync(filePath, '{ invalid json }');

      expect(() => ClockEntityLoader.loadFromFile(filePath)).toThrow();
    });

    it('should throw for invalid config in file', () => {
      const filePath = path.join(tempDir, 'clock.json');
      fs.writeFileSync(filePath, JSON.stringify({ bpm: 5 })); // Invalid BPM

      expect(() => ClockEntityLoader.loadFromFile(filePath)).toThrow();
    });
  });

  describe('createDefault', () => {
    it('should create default clock config', () => {
      const result = ClockEntityLoader.createDefault();

      expect(result.bpm).toBe(120);
      expect(result.ppq).toBe(960);
      expect(result.timeSignature).toEqual({ numerator: 4, denominator: 4 });
      expect(result.swing).toBe(0);
    });
  });
});

// ============================================================================
// PatternEntity Tests
// ============================================================================

describe('PatternEntityValidator', () => {
  describe('Valid Configurations', () => {
    it('should validate euclidean pattern', () => {
      const config = {
        id: 'kick-1',
        name: 'Kick Pattern',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 4 }
      };

      const result = PatternEntityValidator.validate(config);

      expect(result.id).toBe('kick-1');
      expect(result.type).toBe('euclidean');
      expect(result.enabled).toBe(true);
      expect(result.length).toBe(1);
      expect(result.division).toBe(4);
    });

    it('should validate probability pattern', () => {
      const config = {
        id: 'hat-1',
        name: 'Hi-hat Pattern',
        type: 'probability',
        bus: 'drums',
        parameters: { probability: 75 }
      };

      const result = PatternEntityValidator.validate(config);

      expect(result.type).toBe('probability');
    });

    it('should validate phase pattern', () => {
      const config = {
        id: 'phase-1',
        name: 'Phase Pattern',
        type: 'phase',
        bus: 'synth',
        parameters: { phaseOffset: 0.25 }
      };

      const result = PatternEntityValidator.validate(config);

      expect(result.type).toBe('phase');
    });

    it('should validate script pattern', () => {
      const config = {
        id: 'script-1',
        name: 'Custom Script',
        type: 'script',
        bus: 'synth',
        scriptPath: './patterns/custom.js',
        parameters: {}
      };

      const result = PatternEntityValidator.validate(config);

      expect(result.type).toBe('script');
      expect(result.scriptPath).toBe('./patterns/custom.js');
    });

    it('should accept note values 0-127', () => {
      const config = {
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        note: 0,
        parameters: { steps: 16, pulses: 4 }
      };
      expect(PatternEntityValidator.validate(config).note).toBe(0);

      config.note = 127;
      expect(PatternEntityValidator.validate(config).note).toBe(127);
    });

    it('should accept channel values 1-16', () => {
      const config = {
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        channel: 1,
        parameters: { steps: 16, pulses: 4 }
      };
      expect(PatternEntityValidator.validate(config).channel).toBe(1);

      config.channel = 16;
      expect(PatternEntityValidator.validate(config).channel).toBe(16);
    });

    it('should read parameters from type-specific key', () => {
      const config = {
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        euclidean: { steps: 8, pulses: 3 }
      };

      const result = PatternEntityValidator.validate(config);

      expect(result.parameters).toEqual({ steps: 8, pulses: 3 });
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject null config', () => {
      expect(() => PatternEntityValidator.validate(null))
        .toThrow('Pattern configuration must be an object');
    });

    it('should reject missing ID', () => {
      expect(() => PatternEntityValidator.validate({
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern ID is required');
    });

    it('should reject empty ID', () => {
      expect(() => PatternEntityValidator.validate({
        id: '   ',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern ID is required');
    });

    it('should reject missing name', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern name is required');
    });

    it('should reject invalid type', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'invalid',
        bus: 'drums',
        parameters: {}
      })).toThrow('Pattern type must be one of');
    });

    it('should reject missing bus', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern bus is required');
    });

    it('should reject note below 0', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        note: -1,
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern note must be between 0 and 127');
    });

    it('should reject note above 127', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        note: 128,
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern note must be between 0 and 127');
    });

    it('should reject channel below 1', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        channel: 0,
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern channel must be between 1 and 16');
    });

    it('should reject channel above 16', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        channel: 17,
        parameters: { steps: 16, pulses: 4 }
      })).toThrow('Pattern channel must be between 1 and 16');
    });

    it('should reject script pattern without scriptPath', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'script',
        bus: 'drums',
        parameters: {}
      })).toThrow('Script pattern must have a scriptPath');
    });

    it('should validate euclidean parameters', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: -1, pulses: 4 }
      })).toThrow('Euclidean pattern steps must be a positive integer');
    });

    it('should reject pulses > steps', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 4, pulses: 8 }
      })).toThrow('Euclidean pattern pulses cannot exceed steps');
    });

    it('should validate probability parameters', () => {
      expect(() => PatternEntityValidator.validate({
        id: 'test',
        name: 'Test',
        type: 'probability',
        bus: 'drums',
        parameters: { probability: 150 }
      })).toThrow('Probability pattern probability must be between 0 and 100');
    });
  });
});

describe('PatternEntityLoader', () => {
  describe('loadFromFile', () => {
    it('should load from JSON file', () => {
      const filePath = path.join(tempDir, 'pattern.json');
      const config = {
        id: 'kick-1',
        name: 'Kick',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 4 }
      };
      fs.writeFileSync(filePath, JSON.stringify(config));

      const result = PatternEntityLoader.loadFromFile(filePath);

      expect(result.id).toBe('kick-1');
    });

    it('should load from YAML file', () => {
      const filePath = path.join(tempDir, 'pattern.yaml');
      fs.writeFileSync(filePath, `
id: kick-1
name: Kick
type: euclidean
bus: drums
parameters:
  steps: 16
  pulses: 4
`);

      const result = PatternEntityLoader.loadFromFile(filePath);

      expect(result.id).toBe('kick-1');
    });

    it('should throw for non-existent file', () => {
      expect(() => PatternEntityLoader.loadFromFile('/non/existent/file.json'))
        .toThrow('Pattern file not found');
    });

    it('should throw for unsupported format', () => {
      const filePath = path.join(tempDir, 'pattern.txt');
      fs.writeFileSync(filePath, 'data');

      expect(() => PatternEntityLoader.loadFromFile(filePath))
        .toThrow('Pattern files must be in JSON or YAML format');
    });
  });

  describe('loadFromDirectory', () => {
    it('should load all patterns from directory', () => {
      fs.writeFileSync(path.join(tempDir, 'kick.json'), JSON.stringify({
        id: 'kick',
        name: 'Kick',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 4 }
      }));
      fs.writeFileSync(path.join(tempDir, 'hat.json'), JSON.stringify({
        id: 'hat',
        name: 'Hat',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 8 }
      }));

      const patterns = PatternEntityLoader.loadFromDirectory(tempDir);

      expect(patterns).toHaveLength(2);
      expect(patterns.map(p => p.id).sort()).toEqual(['hat', 'kick']);
    });

    it('should skip non-pattern files', () => {
      fs.writeFileSync(path.join(tempDir, 'kick.json'), JSON.stringify({
        id: 'kick',
        name: 'Kick',
        type: 'euclidean',
        bus: 'drums',
        parameters: { steps: 16, pulses: 4 }
      }));
      fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'Not a pattern');

      const patterns = PatternEntityLoader.loadFromDirectory(tempDir);

      expect(patterns).toHaveLength(1);
    });

    it('should throw for non-existent directory', () => {
      expect(() => PatternEntityLoader.loadFromDirectory('/non/existent'))
        .toThrow('Pattern directory not found');
    });
  });

  describe('createDefaultEuclidean', () => {
    it('should create default euclidean pattern', () => {
      const result = PatternEntityLoader.createDefaultEuclidean('kick-1', 'drums');

      expect(result.id).toBe('kick-1');
      expect(result.bus).toBe('drums');
      expect(result.type).toBe('euclidean');
      expect(result.parameters.steps).toBe(16);
      expect(result.parameters.pulses).toBe(4);
    });
  });
});

// ============================================================================
// RouteEntity Tests
// ============================================================================

describe('RouteEntityValidator', () => {
  describe('Valid Configurations', () => {
    it('should validate minimal route', () => {
      const config = {
        id: 'route-1',
        bus: 'drums',
        device: 'IAC Driver'
      };

      const result = RouteEntityValidator.validate(config);

      expect(result.id).toBe('route-1');
      expect(result.bus).toBe('drums');
      expect(result.device).toBe('IAC Driver');
      expect(result.channel).toBe(1);
      expect(result.enabled).toBe(true);
    });

    it('should validate route with all fields', () => {
      const config = {
        id: 'route-1',
        bus: 'drums',
        device: 'IAC Driver',
        channel: 10,
        enabled: false,
        transform: {
          transpose: 12,
          velocityScale: 0.8,
          velocityOffset: 10,
          channelOverride: 5
        }
      };

      const result = RouteEntityValidator.validate(config);

      expect(result.channel).toBe(10);
      expect(result.enabled).toBe(false);
      expect(result.transform).toEqual({
        transpose: 12,
        velocityScale: 0.8,
        velocityOffset: 10,
        channelOverride: 5
      });
    });

    it('should accept channel 1-16', () => {
      for (let ch = 1; ch <= 16; ch++) {
        const result = RouteEntityValidator.validate({
          id: 'route',
          bus: 'drums',
          device: 'virtual',
          channel: ch
        });
        expect(result.channel).toBe(ch);
      }
    });

    it('should accept transpose -127 to 127', () => {
      expect(RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { transpose: -127 }
      }).transform?.transpose).toBe(-127);

      expect(RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { transpose: 127 }
      }).transform?.transpose).toBe(127);
    });

    it('should accept velocityScale 0-2', () => {
      expect(RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { velocityScale: 0 }
      }).transform?.velocityScale).toBe(0);

      expect(RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { velocityScale: 2 }
      }).transform?.velocityScale).toBe(2);
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject null config', () => {
      expect(() => RouteEntityValidator.validate(null))
        .toThrow('Route configuration must be an object');
    });

    it('should reject missing ID', () => {
      expect(() => RouteEntityValidator.validate({
        bus: 'drums',
        device: 'virtual'
      })).toThrow('Route ID is required');
    });

    it('should reject missing bus', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        device: 'virtual'
      })).toThrow('Route bus is required');
    });

    it('should reject missing device', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums'
      })).toThrow('Route device is required');
    });

    it('should reject channel below 1', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        channel: 0
      })).toThrow('Route channel must be between 1 and 16');
    });

    it('should reject channel above 16', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        channel: 17
      })).toThrow('Route channel must be between 1 and 16');
    });

    it('should reject transpose below -127', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { transpose: -128 }
      })).toThrow('Transform transpose must be between -127 and 127');
    });

    it('should reject velocityScale below 0', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { velocityScale: -0.1 }
      })).toThrow('Transform velocityScale must be between 0 and 2');
    });

    it('should reject velocityScale above 2', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { velocityScale: 2.1 }
      })).toThrow('Transform velocityScale must be between 0 and 2');
    });

    it('should reject channelOverride below 1', () => {
      expect(() => RouteEntityValidator.validate({
        id: 'route',
        bus: 'drums',
        device: 'virtual',
        transform: { channelOverride: 0 }
      })).toThrow('Transform channelOverride must be between 1 and 16');
    });
  });
});

describe('RouteEntityLoader', () => {
  describe('loadFromFile', () => {
    it('should load from JSON file', () => {
      const filePath = path.join(tempDir, 'route.json');
      fs.writeFileSync(filePath, JSON.stringify({
        id: 'route-1',
        bus: 'drums',
        device: 'virtual'
      }));

      const result = RouteEntityLoader.loadFromFile(filePath);

      expect(result.id).toBe('route-1');
    });

    it('should throw for non-existent file', () => {
      expect(() => RouteEntityLoader.loadFromFile('/non/existent.json'))
        .toThrow('Route file not found');
    });

    it('should throw for non-JSON format', () => {
      const filePath = path.join(tempDir, 'route.yaml');
      fs.writeFileSync(filePath, 'id: route-1');

      expect(() => RouteEntityLoader.loadFromFile(filePath))
        .toThrow('Route files must be in JSON format');
    });
  });

  describe('loadFromDirectory', () => {
    it('should load all routes from directory', () => {
      fs.writeFileSync(path.join(tempDir, 'drums.json'), JSON.stringify({
        id: 'drums-route',
        bus: 'drums',
        device: 'virtual'
      }));
      fs.writeFileSync(path.join(tempDir, 'bass.json'), JSON.stringify({
        id: 'bass-route',
        bus: 'bass',
        device: 'virtual'
      }));

      const routes = RouteEntityLoader.loadFromDirectory(tempDir);

      expect(routes).toHaveLength(2);
    });

    it('should throw for non-existent directory', () => {
      expect(() => RouteEntityLoader.loadFromDirectory('/non/existent'))
        .toThrow('Route directory not found');
    });
  });

  describe('loadArrayFromFile', () => {
    it('should load multiple routes from array', () => {
      const filePath = path.join(tempDir, 'routes.json');
      fs.writeFileSync(filePath, JSON.stringify([
        { id: 'route-1', bus: 'drums', device: 'virtual' },
        { id: 'route-2', bus: 'bass', device: 'virtual' }
      ]));

      const routes = RouteEntityLoader.loadArrayFromFile(filePath);

      expect(routes).toHaveLength(2);
    });

    it('should throw for non-array content', () => {
      const filePath = path.join(tempDir, 'routes.json');
      fs.writeFileSync(filePath, JSON.stringify({ id: 'route-1' }));

      expect(() => RouteEntityLoader.loadArrayFromFile(filePath))
        .toThrow('Route file must contain an array of routes');
    });

    it('should throw with index for invalid route in array', () => {
      const filePath = path.join(tempDir, 'routes.json');
      fs.writeFileSync(filePath, JSON.stringify([
        { id: 'route-1', bus: 'drums', device: 'virtual' },
        { id: 'route-2' } // Missing bus and device
      ]));

      expect(() => RouteEntityLoader.loadArrayFromFile(filePath))
        .toThrow('Route at index 1');
    });
  });

  describe('createDefault', () => {
    it('should create default route', () => {
      const result = RouteEntityLoader.createDefault('drums');

      expect(result.id).toBe('route-drums');
      expect(result.bus).toBe('drums');
      expect(result.device).toBe('virtual');
      expect(result.channel).toBe(1);
      expect(result.enabled).toBe(true);
    });

    it('should accept custom device and channel', () => {
      const result = RouteEntityLoader.createDefault('drums', 'IAC Driver', 10);

      expect(result.device).toBe('IAC Driver');
      expect(result.channel).toBe(10);
    });
  });
});
