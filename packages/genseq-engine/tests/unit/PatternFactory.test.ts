import { describe, it, expect } from 'vitest';
import { PatternFactory } from '../../src/patterns/PatternFactory';
import type { PatternEntity } from '../../src/config/entities/PatternEntity';

/**
 * T010: PatternFactory unit test suite (RED PHASE - MUST FAIL)
 *
 * Tests for centralized pattern instance creation and validation.
 * This test file MUST be created before PatternFactory implementation exists.
 */

describe('PatternFactory', () => {
  describe('createPattern', () => {
    it('should create Euclidean pattern instance', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'kick',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          steps: 16,
          pulses: 4,
          rotation: 0,
          velocity: 100,
          gateLength: 0.25
        }
      };

      const result = factory.createPattern(entity);

      expect(result.instance).toBeDefined();
      expect(result.generator).toBeDefined();
      expect(typeof result.generator).toBe('function');
    });

    it('should create Probability pattern instance', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'hats',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          probability: 0.75,
          density: 16,
          velocity: 80,
          gateLength: 0.1
        }
      };

      const result = factory.createPattern(entity);

      expect(result.instance).toBeDefined();
      expect(result.generator).toBeDefined();
    });

    it('should create Phase pattern instance', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'bass',
        type: 'phase',
        bus: 'synth',
        enabled: true,
        length: 1,
        division: 16,
        channel: 1,
        parameters: {
          phaseRate: 1.5,
          phaseOffset: 0.25,
          velocity: 90,
          gateLength: 0.5
        }
      };

      const result = factory.createPattern(entity);

      expect(result.instance).toBeDefined();
      expect(result.generator).toBeDefined();
    });

    it('should throw error for unknown pattern type', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'invalid',
        type: 'unknown' as any,
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {}
      };

      expect(() => {
        factory.createPattern(entity);
      }).toThrow(/unknown.*pattern.*type/i);
    });

    it('should throw error for missing required parameters', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'invalid-euclidean',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          // Missing steps and pulses
          rotation: 0
        }
      };

      expect(() => {
        factory.createPattern(entity);
      }).toThrow();
    });
  });

  describe('validateParameters', () => {
    it('should validate valid Euclidean parameters', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('euclidean', {
        steps: 16,
        pulses: 4,
        rotation: 0,
        velocity: 100,
        gateLength: 0.25
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid Euclidean parameters (pulses > steps)', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('euclidean', {
        steps: 8,
        pulses: 10, // Invalid: more pulses than steps
        rotation: 0
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate valid Probability parameters', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('probability', {
        probability: 0.75,
        density: 16,
        velocity: 100,
        gateLength: 0.25
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid Probability parameters (probability > 1)', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('probability', {
        probability: 1.5, // Invalid: > 1.0
        density: 16
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/probability/i);
    });

    it('should reject invalid Probability parameters (probability < 0)', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('probability', {
        probability: -0.5, // Invalid: < 0
        density: 16
      });

      expect(result.valid).toBe(false);
    });

    it('should validate valid Phase parameters', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('phase', {
        phaseRate: 2.0,
        phaseOffset: 0.5,
        velocity: 100,
        gateLength: 0.25
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid Phase parameters (phaseOffset > 1)', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('phase', {
        phaseRate: 1.0,
        phaseOffset: 1.5 // Invalid: > 1.0
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/phaseOffset/i);
    });

    it('should reject invalid Phase parameters (negative phaseRate)', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('phase', {
        phaseRate: -1.0, // Invalid: negative
        phaseOffset: 0.5
      });

      expect(result.valid).toBe(false);
    });

    it('should include parameter path in error messages', () => {
      const factory = new PatternFactory();

      const result = factory.validateParameters('probability', {
        probability: 2.0,
        density: 16
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/probability/);
    });
  });

  describe('getParameterSchema', () => {
    it('should return schema for Euclidean type', () => {
      const factory = new PatternFactory();

      const schema = factory.getParameterSchema('euclidean');

      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('steps');
      expect(schema.properties).toHaveProperty('pulses');
    });

    it('should return schema for Probability type', () => {
      const factory = new PatternFactory();

      const schema = factory.getParameterSchema('probability');

      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('probability');
      expect(schema.properties).toHaveProperty('density');
    });

    it('should return schema for Phase type', () => {
      const factory = new PatternFactory();

      const schema = factory.getParameterSchema('phase');

      expect(schema).toBeDefined();
      expect(schema.properties).toHaveProperty('phaseRate');
      expect(schema.properties).toHaveProperty('phaseOffset');
    });

    it('should throw error for unknown pattern type', () => {
      const factory = new PatternFactory();

      expect(() => {
        factory.getParameterSchema('unknown' as any);
      }).toThrow();
    });
  });

  describe('createGenerator', () => {
    it('should create generator function from pattern instance', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'test',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          steps: 16,
          pulses: 4,
          rotation: 0,
          velocity: 100,
          gateLength: 0.25
        }
      };

      const result = factory.createPattern(entity);
      const generator = result.generator;

      // Generator should be callable with PatternContext
      expect(typeof generator).toBe('function');

      const context = {
        params: entity.parameters,
        position: { bar: 1, beat: 1, tick: 0 },
        ppq: 96,
        helpers: {} as any
      };

      const events = generator(context);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('type-specific parameter mapping', () => {
    it('should map note and velocity to Euclidean config', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'kick',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        note: 36,
        parameters: {
          steps: 16,
          pulses: 4,
          rotation: 0,
          velocity: 100,
          gateLength: 0.25
        }
      };

      const result = factory.createPattern(entity);
      expect(result.instance).toBeDefined();
    });

    it('should use gateLength as duration parameter', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'hats',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        note: 42,
        parameters: {
          probability: 0.75,
          density: 16,
          velocity: 80,
          gateLength: 0.1 // Should be used as duration
        }
      };

      const result = factory.createPattern(entity);
      expect(result.instance).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional parameters with defaults', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'minimal',
        type: 'euclidean',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          steps: 16,
          pulses: 4
          // rotation, velocity, gateLength should use defaults
        }
      };

      expect(() => {
        factory.createPattern(entity);
      }).not.toThrow();
    });

    it('should handle velocity arrays', () => {
      const factory = new PatternFactory();

      const entity: PatternEntity = {
        id: 'varied',
        type: 'probability',
        bus: 'drums',
        enabled: true,
        length: 1,
        division: 16,
        channel: 10,
        parameters: {
          probability: 0.5,
          density: 16,
          velocity: [100, 80, 60, 40],
          gateLength: 0.25
        }
      };

      const result = factory.createPattern(entity);
      expect(result.instance).toBeDefined();
    });
  });
});
