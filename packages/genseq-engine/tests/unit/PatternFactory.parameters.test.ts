import { describe, it, expect } from 'vitest';
import { PatternFactory } from '../../src/patterns/PatternFactory';
import type { PatternEntity } from '../../src/config/entities/PatternEntity';
import type { PatternType } from '@genseq/patterns';

/**
 * T063: Parameter Preservation Test Suite
 *
 * Tests that verify parameter handling during type changes:
 * - Common parameters (note, velocity, duration) are used from new entity
 * - Type-specific parameters are cleanly replaced
 * - Schema defaults are applied when common parameters are omitted
 * - No automatic parameter preservation from old type
 *
 * Common Parameters (shared across all pattern types):
 * - note: MIDI note number (0-127)
 * - velocity: MIDI velocity (1-127)
 * - duration: Note duration in beats
 *
 * Type-Specific Parameters:
 * - Euclidean: steps, pulses, rotation
 * - Probability: probability, density, seed
 * - Phase: phaseRate, phaseOffset
 */

describe('PatternFactory Parameter Preservation', () => {
  describe('Common Parameters', () => {
    it('should use note from new entity when specified', () => {
      // Original euclidean with note=60
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      // New probability with note=64
      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.75,
          density: 1.0,
          note: 64, // Explicitly set new note
          velocity: 100,
          duration: 0.5
        }
      };

      const result = PatternFactory.createPattern(probabilityEntity);

      // Should use note from new entity (64, not 60)
      expect(result.instance.config.note).toBe(64);
    });

    it('should use velocity from new entity when specified', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.75,
          density: 1.0,
          note: 60,
          velocity: 80, // New velocity
          duration: 0.5
        }
      };

      const result = PatternFactory.createPattern(probabilityEntity);

      expect(result.instance.config.velocity).toBe(80);
    });

    it('should use duration from new entity when specified', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
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

      const phaseEntity: PatternEntity = {
        id: 'pattern1',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 0.0,
          note: 60,
          velocity: 100,
          duration: 0.25 // New duration
        }
      };

      const result = PatternFactory.createPattern(phaseEntity);

      expect(result.instance.config.duration).toBe(0.25);
    });
  });

  describe('Type-Specific Parameters', () => {
    it('should replace euclidean-specific parameters with probability-specific parameters', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 16,
          pulses: 7,
          rotation: 2,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.8,
          density: 1.0,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const result = PatternFactory.createPattern(probabilityEntity);

      // Should have probability-specific parameters
      expect(result.instance.config.probability).toBe(0.8);
      expect(result.instance.config.density).toBe(1.0);

      // Should NOT have euclidean-specific parameters
      expect((result.instance.config as any).steps).toBeUndefined();
      expect((result.instance.config as any).pulses).toBeUndefined();
      expect((result.instance.config as any).rotation).toBeUndefined();
    });

    it('should replace probability-specific parameters with phase-specific parameters', () => {
      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.75,
          density: 1.0,
          seed: 12345,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const phaseEntity: PatternEntity = {
        id: 'pattern1',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 2.0,
          phaseOffset: 0.5,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const result = PatternFactory.createPattern(phaseEntity);

      // Should have phase-specific parameters
      expect(result.instance.config.phaseRate).toBe(2.0);
      expect(result.instance.config.phaseOffset).toBe(0.5);

      // Should NOT have probability-specific parameters
      expect((result.instance.config as any).probability).toBeUndefined();
      expect((result.instance.config as any).density).toBeUndefined();
      expect((result.instance.config as any).seed).toBeUndefined();
    });

    it('should replace phase-specific parameters with euclidean-specific parameters', () => {
      const phaseEntity: PatternEntity = {
        id: 'pattern1',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.5,
          phaseOffset: 0.25,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 12,
          pulses: 4,
          rotation: 1,
          note: 60,
          velocity: 100,
          duration: 0.5
        }
      };

      const result = PatternFactory.createPattern(euclideanEntity);

      // Should have euclidean-specific parameters
      expect(result.instance.config.steps).toBe(12);
      expect(result.instance.config.pulses).toBe(4);
      expect(result.instance.config.rotation).toBe(1);

      // Should NOT have phase-specific parameters
      expect((result.instance.config as any).phaseRate).toBeUndefined();
      expect((result.instance.config as any).phaseOffset).toBeUndefined();
    });
  });

  describe('Schema Default Fallbacks', () => {
    it('should apply schema defaults when common parameters are omitted', () => {
      // Create probability pattern with only type-specific parameters
      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.75,
          density: 1.0
          // note, velocity, duration omitted - should use schema defaults
        }
      };

      const result = PatternFactory.createPattern(probabilityEntity);

      // Should use schema defaults for omitted common parameters
      expect(result.instance.config.note).toBe(60); // Default from schema
      expect(result.instance.config.velocity).toBe(100); // Default from schema
      expect(result.instance.config.duration).toBe(0.25); // Default from schema
    });

    it('should apply schema defaults for phase pattern when common parameters omitted', () => {
      const phaseEntity: PatternEntity = {
        id: 'pattern1',
        type: 'phase' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          phaseRate: 1.0,
          phaseOffset: 0.0
          // note, velocity, duration omitted
        }
      };

      const result = PatternFactory.createPattern(phaseEntity);

      expect(result.instance.config.note).toBe(60);
      expect(result.instance.config.velocity).toBe(100);
      expect(result.instance.config.duration).toBe(0.25);
    });

    it('should apply schema defaults for euclidean pattern when common parameters omitted', () => {
      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0
          // note, velocity, duration omitted
        }
      };

      const result = PatternFactory.createPattern(euclideanEntity);

      expect(result.instance.config.note).toBe(60);
      expect(result.instance.config.velocity).toBe(100);
      expect(result.instance.config.duration).toBe(0.25);
    });
  });

  describe('No Automatic Preservation', () => {
    it('should NOT automatically preserve common parameters from old type', () => {
      // This test documents that PatternFactory has NO concept of "old" vs "new" entity
      // It simply creates a pattern from the entity provided
      // Parameter preservation would have to be done BEFORE calling createPattern()

      const euclideanEntity: PatternEntity = {
        id: 'pattern1',
        type: 'euclidean' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          steps: 8,
          pulses: 5,
          rotation: 0,
          note: 72, // Original note
          velocity: 110, // Original velocity
          duration: 0.75 // Original duration
        }
      };

      // Create probability pattern with NO common parameters specified
      const probabilityEntity: PatternEntity = {
        id: 'pattern1',
        type: 'probability' as PatternType,
        enabled: true,
        bus: 'main',
        channel: 1,
        length: 1,
        parameters: {
          probability: 0.75,
          density: 1.0
          // Note: common parameters NOT specified
        }
      };

      const result = PatternFactory.createPattern(probabilityEntity);

      // Should use schema defaults, NOT the old euclidean values
      expect(result.instance.config.note).toBe(60); // Schema default, not 72
      expect(result.instance.config.velocity).toBe(100); // Schema default, not 110
      expect(result.instance.config.duration).toBe(0.25); // Schema default, not 0.75
    });
  });
});
