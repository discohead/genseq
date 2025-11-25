import { describe, it, expect } from 'vitest';
import { PatternFactory } from '../../src/patterns/PatternFactory';
import type { PatternEntity, PatternType } from '@genseq/patterns';

describe('PatternFactory Validation', () => {
  describe('Probability Pattern Validation', () => {
    it('should reject probability > 1.0', () => {
      const entity: PatternEntity = {
        id: 'test-prob',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 1.5, // INVALID: > 1.0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/probability must be between 0 and 1/i);
    });

    it('should reject probability < 0', () => {
      const entity: PatternEntity = {
        id: 'test-prob',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: -0.5, // INVALID: < 0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/probability must be between 0 and 1/i);
    });

    it('should reject density > 1.0', () => {
      const entity: PatternEntity = {
        id: 'test-prob',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.5,
          density: 2.0, // INVALID: > 1.0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/density must be between 0 and 1/i);
    });

    it('should reject missing required parameters', () => {
      const entity: PatternEntity = {
        id: 'test-prob',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.5
          // Missing: note, velocity, duration
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/required parameter/i);
    });

    it('should reject invalid note range', () => {
      const entity: PatternEntity = {
        id: 'test-prob',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.5,
          note: 128, // INVALID: MIDI note must be 0-127
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/note must be between 0 and 127/i);
    });
  });

  describe('Phase Pattern Validation', () => {
    it('should reject negative phaseRate', () => {
      const entity: PatternEntity = {
        id: 'test-phase',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: -1.0, // INVALID: negative
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/phaseRate.*must be/i);
    });

    it('should reject phaseOffset > 1.0', () => {
      const entity: PatternEntity = {
        id: 'test-phase',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 1.5, // INVALID: > 1.0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/phaseOffset.*between 0/i);
    });

    it('should reject phaseOffset < 0', () => {
      const entity: PatternEntity = {
        id: 'test-phase',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: -0.5, // INVALID: < 0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/phaseOffset.*between 0/i);
    });

    it('should reject missing required parameters', () => {
      const entity: PatternEntity = {
        id: 'test-phase',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0
          // Missing: phaseOffset, note, velocity, duration
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/required parameter/i);
    });
  });

  describe('Euclidean Pattern Validation', () => {
    it('should reject pulses > steps', () => {
      const entity: PatternEntity = {
        id: 'test-euc',
        type: 'euclidean' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 10, // INVALID: pulses > steps
          rotation: 0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/pulses cannot exceed steps/i);
    });

    it('should reject negative rotation', () => {
      const entity: PatternEntity = {
        id: 'test-euc',
        type: 'euclidean' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: -1, // INVALID: negative rotation
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      expect(() => PatternFactory.createPattern(entity)).toThrow(/rotation must be non-negative/i);
    });
  });

  describe('validateParameters() method', () => {
    it('should return validation errors for invalid probability', () => {
      const result = PatternFactory.validateParameters('probability', {
        probability: 2.0, // INVALID
        note: 60,
        velocity: 100,
        duration: 0.5
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('/parameters');
      expect(result.errors[0].message).toMatch(/probability must be between 0 and 1/i);
    });

    it('should return validation errors for invalid phase offset', () => {
      const result = PatternFactory.validateParameters('phase', {
        phaseRate: 1.0,
        phaseOffset: -1.0, // INVALID
        note: 60,
        velocity: 100,
        duration: 0.5
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toMatch(/phaseOffset.*between 0/i);
    });

    it('should return valid=true for correct parameters', () => {
      const result = PatternFactory.validateParameters('probability', {
        probability: 0.7,
        note: 60,
        velocity: 100,
        duration: 0.5
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Error message clarity', () => {
    it('should include parameter path in error messages', () => {
      const entity: PatternEntity = {
        id: 'test',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 1.5,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      try {
        PatternFactory.createPattern(entity);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toMatch(/probability/);
        expect(error.message).toMatch(/0 and 1/);
      }
    });

    it('should include expected value ranges in error messages', () => {
      const entity: PatternEntity = {
        id: 'test',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 2.0, // INVALID: > 1.0
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      try {
        PatternFactory.createPattern(entity);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toMatch(/0 and 1/);
      }
    });
  });
});
