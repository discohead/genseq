import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MacroExpander, type ParameterChangeEvent } from '../../src/mappings/MacroExpander';
import type { MacroEntity } from '../../src/config/entities/MacroEntity';
import { PatternRegistry } from '@genseq/patterns';
import type { Pattern } from '@genseq/patterns';

/**
 * T062: MacroExpander Tests
 *
 * Tests macro expansion functionality:
 * - Wildcard pattern matching (*, prefix-*, *-suffix)
 * - Value transformation (scale, offset, clamp)
 * - Priority-based execution ordering
 * - Parameter-change event emission
 */

describe('MacroExpander', () => {
  let expander: MacroExpander;
  let registry: PatternRegistry;

  beforeEach(() => {
    expander = new MacroExpander();
    registry = new PatternRegistry();
    expander.setPatternRegistry(registry);

    // Register test patterns
    const patterns: Pattern[] = [
      { id: 'drum-kick', type: 'euclidean', enabled: true, steps: 16, pulses: 4, rotation: 0 },
      { id: 'drum-snare', type: 'euclidean', enabled: true, steps: 16, pulses: 8, rotation: 0 },
      { id: 'drum-hihat', type: 'euclidean', enabled: true, steps: 16, pulses: 12, rotation: 0 },
      { id: 'bass-synth', type: 'euclidean', enabled: true, steps: 16, pulses: 6, rotation: 0 },
      { id: 'lead-melody', type: 'euclidean', enabled: true, steps: 16, pulses: 5, rotation: 0 }
    ];

    for (const pattern of patterns) {
      registry.register(pattern, () => []);
    }
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should create expander with no macros', () => {
      expect(expander).toBeDefined();
      expect(expander.getMacroCount()).toBe(0);
    });

    it('should allow setting pattern registry', () => {
      const newExpander = new MacroExpander();
      const newRegistry = new PatternRegistry();

      expect(() => newExpander.setPatternRegistry(newRegistry)).not.toThrow();
    });
  });

  // ============================================================================
  // Macro Registration Tests
  // ============================================================================

  describe('Macro Registration', () => {
    it('should register a macro', () => {
      const macro: MacroEntity = {
        id: 'volume-control',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      expect(expander.getMacroCount()).toBe(1);
      expect(expander.getMacro('volume-control')).toEqual(macro);
    });

    it('should unregister a macro', () => {
      const macro: MacroEntity = {
        id: 'volume-control',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      expander.unregisterMacro('volume-control');
      expect(expander.getMacroCount()).toBe(0);
      expect(expander.getMacro('volume-control')).toBeUndefined();
    });

    it('should clear all macros', () => {
      expander.registerMacro({
        id: 'macro-1',
        targets: [{ patternId: 'drum-kick', parameter: 'velocity' }]
      });
      expander.registerMacro({
        id: 'macro-2',
        targets: [{ patternId: 'bass-synth', parameter: 'note' }]
      });

      expect(expander.getMacroCount()).toBe(2);
      expander.clearMacros();
      expect(expander.getMacroCount()).toBe(0);
    });
  });

  // ============================================================================
  // Wildcard Pattern Matching Tests
  // ============================================================================

  describe('Wildcard Pattern Matching', () => {
    it('should match all patterns with "*"', () => {
      const macro: MacroEntity = {
        id: 'global-velocity',
        targets: [
          { patternId: '*', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('global-velocity', 100);

      expect(result.expandedTargets).toHaveLength(5);
      expect(result.expandedTargets.map(t => t.patternId).sort()).toEqual([
        'bass-synth',
        'drum-hihat',
        'drum-kick',
        'drum-snare',
        'lead-melody'
      ]);
    });

    it('should match prefix pattern "drum-*"', () => {
      const macro: MacroEntity = {
        id: 'drum-volume',
        targets: [
          { patternId: 'drum-*', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('drum-volume', 90);

      expect(result.expandedTargets).toHaveLength(3);
      expect(result.expandedTargets.map(t => t.patternId).sort()).toEqual([
        'drum-hihat',
        'drum-kick',
        'drum-snare'
      ]);
    });

    it('should match suffix pattern "*-kick"', () => {
      const macro: MacroEntity = {
        id: 'kick-volume',
        targets: [
          { patternId: '*-kick', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('kick-volume', 110);

      expect(result.expandedTargets).toHaveLength(1);
      expect(result.expandedTargets[0].patternId).toBe('drum-kick');
    });

    it('should match exact pattern ID when no wildcard', () => {
      const macro: MacroEntity = {
        id: 'bass-control',
        targets: [
          { patternId: 'bass-synth', parameter: 'note' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('bass-control', 60);

      expect(result.expandedTargets).toHaveLength(1);
      expect(result.expandedTargets[0].patternId).toBe('bass-synth');
    });

    it('should return empty array for non-matching exact pattern', () => {
      const macro: MacroEntity = {
        id: 'missing-pattern',
        targets: [
          { patternId: 'non-existent', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('missing-pattern', 50);

      expect(result.expandedTargets).toHaveLength(0);
    });

    it('should return empty array for non-matching wildcard pattern', () => {
      const macro: MacroEntity = {
        id: 'synth-control',
        targets: [
          { patternId: 'synth-*', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('synth-control', 75);

      // Only bass-synth exists, but pattern is "synth-*" which doesn't match "bass-synth"
      expect(result.expandedTargets).toHaveLength(0);
    });
  });

  // ============================================================================
  // Value Transformation Tests
  // ============================================================================

  describe('Value Transformation', () => {
    it('should apply default scale (1.0) and offset (0)', () => {
      const macro: MacroEntity = {
        id: 'simple-transform',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('simple-transform', 100);

      expect(result.expandedTargets[0].value).toBe(100);
    });

    it('should apply scale factor', () => {
      const macro: MacroEntity = {
        id: 'scaled-transform',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', scale: 0.5 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('scaled-transform', 100);

      expect(result.expandedTargets[0].value).toBe(50);
    });

    it('should apply offset', () => {
      const macro: MacroEntity = {
        id: 'offset-transform',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', offset: 20 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('offset-transform', 100);

      expect(result.expandedTargets[0].value).toBe(120);
    });

    it('should apply scale and offset: (value * scale) + offset', () => {
      const macro: MacroEntity = {
        id: 'scale-offset-transform',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', scale: 0.5, offset: 30 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('scale-offset-transform', 100);

      // (100 * 0.5) + 30 = 80
      expect(result.expandedTargets[0].value).toBe(80);
    });

    it('should apply negative offset', () => {
      const macro: MacroEntity = {
        id: 'negative-offset',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', offset: -20 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('negative-offset', 100);

      expect(result.expandedTargets[0].value).toBe(80);
    });
  });

  // ============================================================================
  // Clamping Tests
  // ============================================================================

  describe('Value Clamping', () => {
    it('should clamp to minimum value', () => {
      const macro: MacroEntity = {
        id: 'min-clamp',
        targets: [
          {
            patternId: 'drum-kick',
            parameter: 'velocity',
            clamp: { min: 50 }
          }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('min-clamp', 20);

      expect(result.expandedTargets[0].value).toBe(50);
    });

    it('should clamp to maximum value', () => {
      const macro: MacroEntity = {
        id: 'max-clamp',
        targets: [
          {
            patternId: 'drum-kick',
            parameter: 'velocity',
            clamp: { max: 100 }
          }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('max-clamp', 150);

      expect(result.expandedTargets[0].value).toBe(100);
    });

    it('should clamp to both min and max', () => {
      const macro: MacroEntity = {
        id: 'range-clamp',
        targets: [
          {
            patternId: 'drum-kick',
            parameter: 'velocity',
            clamp: { min: 40, max: 120 }
          }
        ]
      };

      expander.registerMacro(macro);

      // Test below min
      let result = expander.expandWithoutEvents('range-clamp', 20);
      expect(result.expandedTargets[0].value).toBe(40);

      // Test above max
      result = expander.expandWithoutEvents('range-clamp', 150);
      expect(result.expandedTargets[0].value).toBe(120);

      // Test within range
      result = expander.expandWithoutEvents('range-clamp', 80);
      expect(result.expandedTargets[0].value).toBe(80);
    });

    it('should apply clamping after scale and offset', () => {
      const macro: MacroEntity = {
        id: 'transform-then-clamp',
        targets: [
          {
            patternId: 'drum-kick',
            parameter: 'velocity',
            scale: 2.0,
            offset: 20,
            clamp: { max: 127 }
          }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('transform-then-clamp', 100);

      // (100 * 2.0) + 20 = 220, clamped to 127
      expect(result.expandedTargets[0].value).toBe(127);
    });
  });

  // ============================================================================
  // Priority Ordering Tests
  // ============================================================================

  describe('Priority Ordering', () => {
    it('should sort targets by priority (ascending)', () => {
      const macro: MacroEntity = {
        id: 'priority-test',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', priority: 3 },
          { patternId: 'drum-snare', parameter: 'velocity', priority: 1 },
          { patternId: 'drum-hihat', parameter: 'velocity', priority: 2 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('priority-test', 100);

      expect(result.expandedTargets).toHaveLength(3);
      expect(result.expandedTargets[0].patternId).toBe('drum-snare');
      expect(result.expandedTargets[0].priority).toBe(1);
      expect(result.expandedTargets[1].patternId).toBe('drum-hihat');
      expect(result.expandedTargets[1].priority).toBe(2);
      expect(result.expandedTargets[2].patternId).toBe('drum-kick');
      expect(result.expandedTargets[2].priority).toBe(3);
    });

    it('should use default priority (0) when not specified', () => {
      const macro: MacroEntity = {
        id: 'default-priority',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity' },
          { patternId: 'drum-snare', parameter: 'velocity', priority: 1 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('default-priority', 100);

      // Default priority (0) should come before explicit priority (1)
      expect(result.expandedTargets[0].patternId).toBe('drum-kick');
      expect(result.expandedTargets[0].priority).toBe(0);
      expect(result.expandedTargets[1].patternId).toBe('drum-snare');
      expect(result.expandedTargets[1].priority).toBe(1);
    });

    it('should maintain stable sort for equal priorities', () => {
      const macro: MacroEntity = {
        id: 'equal-priority',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', priority: 1 },
          { patternId: 'drum-snare', parameter: 'velocity', priority: 1 },
          { patternId: 'drum-hihat', parameter: 'velocity', priority: 1 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('equal-priority', 100);

      // Should maintain original order for equal priorities
      expect(result.expandedTargets[0].patternId).toBe('drum-kick');
      expect(result.expandedTargets[1].patternId).toBe('drum-snare');
      expect(result.expandedTargets[2].patternId).toBe('drum-hihat');
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe('Event Emission', () => {
    it('should emit parameter-change event for each expanded target', () => {
      const macro: MacroEntity = {
        id: 'event-test',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity' },
          { patternId: 'drum-snare', parameter: 'velocity' }
        ]
      };

      expander.registerMacro(macro);

      const events: ParameterChangeEvent[] = [];
      expander.on('parameter-change', (event: ParameterChangeEvent) => {
        events.push(event);
      });

      expander.expand('event-test', 100);

      expect(events).toHaveLength(2);
      expect(events[0].macroId).toBe('event-test');
      expect(events[0].patternId).toBe('drum-kick');
      expect(events[0].parameter).toBe('velocity');
      expect(events[0].value).toBe(100);
      expect(events[1].patternId).toBe('drum-snare');
    });

    it('should emit events in priority order', () => {
      const macro: MacroEntity = {
        id: 'priority-events',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', priority: 2 },
          { patternId: 'drum-snare', parameter: 'velocity', priority: 1 }
        ]
      };

      expander.registerMacro(macro);

      const events: ParameterChangeEvent[] = [];
      expander.on('parameter-change', (event: ParameterChangeEvent) => {
        events.push(event);
      });

      expander.expand('priority-events', 100);

      // Priority 1 should fire before priority 2
      expect(events[0].patternId).toBe('drum-snare');
      expect(events[0].priority).toBe(1);
      expect(events[1].patternId).toBe('drum-kick');
      expect(events[1].priority).toBe(2);
    });

    it('should emit events with transformed values', () => {
      const macro: MacroEntity = {
        id: 'transform-events',
        targets: [
          {
            patternId: 'drum-kick',
            parameter: 'velocity',
            scale: 0.5,
            offset: 20,
            clamp: { max: 100 }
          }
        ]
      };

      expander.registerMacro(macro);

      const events: ParameterChangeEvent[] = [];
      expander.on('parameter-change', (event: ParameterChangeEvent) => {
        events.push(event);
      });

      expander.expand('transform-events', 100);

      // (100 * 0.5) + 20 = 70
      expect(events[0].value).toBe(70);
    });
  });

  // ============================================================================
  // Multiple Targets with Wildcards Tests
  // ============================================================================

  describe('Multiple Targets with Wildcards', () => {
    it('should expand multiple wildcard targets', () => {
      const macro: MacroEntity = {
        id: 'multi-wildcard',
        targets: [
          { patternId: 'drum-*', parameter: 'velocity', scale: 1.0 },
          { patternId: 'bass-*', parameter: 'note', scale: 0.5 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('multi-wildcard', 100);

      // drum-* matches 3 patterns, bass-* matches 1 pattern
      expect(result.expandedTargets).toHaveLength(4);

      // Check velocity targets
      const velocityTargets = result.expandedTargets.filter(t => t.parameter === 'velocity');
      expect(velocityTargets).toHaveLength(3);
      expect(velocityTargets.every(t => t.value === 100)).toBe(true);

      // Check note targets
      const noteTargets = result.expandedTargets.filter(t => t.parameter === 'note');
      expect(noteTargets).toHaveLength(1);
      expect(noteTargets[0].value).toBe(50); // 100 * 0.5
    });

    it('should apply different transformations to different targets', () => {
      const macro: MacroEntity = {
        id: 'different-transforms',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', scale: 2.0 },
          { patternId: 'drum-snare', parameter: 'velocity', scale: 0.5 },
          { patternId: 'drum-hihat', parameter: 'velocity', offset: 20 }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expandWithoutEvents('different-transforms', 50);

      expect(result.expandedTargets[0].value).toBe(100); // 50 * 2.0
      expect(result.expandedTargets[1].value).toBe(25); // 50 * 0.5
      expect(result.expandedTargets[2].value).toBe(70); // 50 + 20
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw error when macro not found', () => {
      expect(() => expander.expand('non-existent', 100)).toThrow('Macro not found: non-existent');
    });

    it('should throw error when pattern registry not set', () => {
      const newExpander = new MacroExpander();
      const macro: MacroEntity = {
        id: 'test-macro',
        targets: [{ patternId: 'drum-kick', parameter: 'velocity' }]
      };

      newExpander.registerMacro(macro);

      expect(() => newExpander.expand('test-macro', 100)).toThrow('Pattern registry not set');
    });
  });

  // ============================================================================
  // Complex Integration Tests
  // ============================================================================

  describe('Complex Integration Scenarios', () => {
    it('should handle complex multi-target macro with wildcards, transforms, and priorities', () => {
      const macro: MacroEntity = {
        id: 'master-volume',
        targets: [
          {
            patternId: 'drum-*',
            parameter: 'velocity',
            scale: 1.2,
            offset: 10,
            clamp: { min: 60, max: 127 },
            priority: 1
          },
          {
            patternId: 'bass-*',
            parameter: 'velocity',
            scale: 0.8,
            offset: 20,
            clamp: { min: 40, max: 100 },
            priority: 2
          },
          {
            patternId: 'lead-*',
            parameter: 'velocity',
            scale: 1.0,
            clamp: { min: 50, max: 120 },
            priority: 3
          }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expand('master-volume', 80);

      // Verify we have all targets expanded
      expect(result.expandedTargets).toHaveLength(5); // 3 drums + 1 bass + 1 lead

      // Verify priority ordering
      const drumTargets = result.expandedTargets.slice(0, 3);
      const bassTarget = result.expandedTargets[3];
      const leadTarget = result.expandedTargets[4];

      expect(drumTargets.every(t => t.priority === 1)).toBe(true);
      expect(bassTarget.priority).toBe(2);
      expect(leadTarget.priority).toBe(3);

      // Verify transformations
      // Drum: (80 * 1.2) + 10 = 106
      expect(drumTargets.every(t => t.value === 106)).toBe(true);

      // Bass: (80 * 0.8) + 20 = 84
      expect(bassTarget.value).toBe(84);

      // Lead: 80 * 1.0 = 80
      expect(leadTarget.value).toBe(80);
    });

    it('should handle empty pattern matches gracefully', () => {
      const macro: MacroEntity = {
        id: 'no-matches',
        targets: [
          { patternId: 'synth-*', parameter: 'velocity' },
          { patternId: 'piano-*', parameter: 'note' }
        ]
      };

      expander.registerMacro(macro);
      const result = expander.expand('no-matches', 100);

      expect(result.expandedTargets).toHaveLength(0);
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      expander.registerMacro({
        id: 'test-macro',
        targets: [{ patternId: 'drum-kick', parameter: 'velocity' }]
      });

      const listener = vi.fn();
      expander.on('parameter-change', listener);

      expander.destroy();

      expect(expander.getMacroCount()).toBe(0);
      expect(expander.listenerCount('parameter-change')).toBe(0);
    });
  });
});
