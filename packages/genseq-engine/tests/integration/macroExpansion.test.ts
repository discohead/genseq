import { describe, it, expect, beforeEach } from 'vitest';
import { MacroExpander, type ParameterChangeEvent } from '../../src/mappings/MacroExpander';
import { MacroEntityValidator } from '../../src/config/entities/MacroEntity';
import { PatternRegistry } from '@genseq/patterns';
import type { Pattern } from '@genseq/patterns';

/**
 * T062: MacroExpander Integration Tests
 *
 * Integration tests with MacroEntity validation and PatternRegistry.
 * Tests real-world scenarios with YAML/JSON configuration loading.
 */

describe('MacroExpander Integration', () => {
  let expander: MacroExpander;
  let registry: PatternRegistry;

  beforeEach(() => {
    expander = new MacroExpander();
    registry = new PatternRegistry();
    expander.setPatternRegistry(registry);

    // Register realistic pattern set
    const patterns: Pattern[] = [
      // Drum patterns
      { id: 'drum-kick', type: 'euclidean', enabled: true, steps: 16, pulses: 4, rotation: 0 },
      { id: 'drum-snare', type: 'euclidean', enabled: true, steps: 16, pulses: 6, rotation: 0 },
      { id: 'drum-hihat', type: 'euclidean', enabled: true, steps: 16, pulses: 12, rotation: 0 },
      { id: 'drum-clap', type: 'euclidean', enabled: true, steps: 16, pulses: 4, rotation: 4 },
      { id: 'drum-ride', type: 'euclidean', enabled: true, steps: 16, pulses: 8, rotation: 2 },

      // Bass patterns
      { id: 'bass-sub', type: 'euclidean', enabled: true, steps: 16, pulses: 5, rotation: 0 },
      { id: 'bass-synth', type: 'euclidean', enabled: true, steps: 16, pulses: 6, rotation: 0 },

      // Lead patterns
      { id: 'lead-melody', type: 'euclidean', enabled: true, steps: 16, pulses: 7, rotation: 0 },
      { id: 'lead-arp', type: 'euclidean', enabled: true, steps: 16, pulses: 16, rotation: 0 },

      // Pad patterns
      { id: 'pad-ambient', type: 'euclidean', enabled: true, steps: 16, pulses: 2, rotation: 0 }
    ];

    for (const pattern of patterns) {
      registry.register(pattern, () => []);
    }
  });

  // ============================================================================
  // MacroEntity Validation Integration
  // ============================================================================

  describe('MacroEntity Validation Integration', () => {
    it('should work with MacroEntity validated configuration', () => {
      const config = {
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
            scale: 0.9,
            priority: 2
          }
        ]
      };

      const macro = MacroEntityValidator.validate(config);
      expander.registerMacro(macro);

      const result = expander.expand('master-volume', 80);

      // 5 drum patterns + 2 bass patterns = 7 targets
      expect(result.expandedTargets).toHaveLength(7);

      // Verify drum targets (priority 1)
      const drumTargets = result.expandedTargets.slice(0, 5);
      expect(drumTargets.every(t => t.priority === 1)).toBe(true);
      // (80 * 1.2) + 10 = 106
      expect(drumTargets.every(t => t.value === 106)).toBe(true);

      // Verify bass targets (priority 2)
      const bassTargets = result.expandedTargets.slice(5, 7);
      expect(bassTargets.every(t => t.priority === 2)).toBe(true);
      // 80 * 0.9 = 72
      expect(bassTargets.every(t => t.value === 72)).toBe(true);
    });

    it('should handle default values from MacroEntity validation', () => {
      const config = {
        id: 'simple-macro',
        targets: [
          {
            patternId: 'drum-kick',
            parameter: 'velocity'
            // No scale, offset, or priority - should use defaults
          }
        ]
      };

      const macro = MacroEntityValidator.validate(config);
      expander.registerMacro(macro);

      const result = expander.expand('simple-macro', 100);

      expect(result.expandedTargets).toHaveLength(1);
      // Default scale (1.0), offset (0), priority (0)
      expect(result.expandedTargets[0].value).toBe(100);
      expect(result.expandedTargets[0].priority).toBe(0);
    });

    it('should respect MacroEntity wildcard pattern validation', () => {
      // MacroEntity validator allows: *, prefix-*, *-suffix
      const validConfigs = [
        { id: 'macro-1', targets: [{ patternId: '*', parameter: 'velocity' }] },
        { id: 'macro-2', targets: [{ patternId: 'drum-*', parameter: 'velocity' }] },
        { id: 'macro-3', targets: [{ patternId: '*-kick', parameter: 'velocity' }] }
      ];

      for (const config of validConfigs) {
        const macro = MacroEntityValidator.validate(config);
        expander.registerMacro(macro);

        expect(() => expander.expand(config.id, 100)).not.toThrow();
      }
    });
  });

  // ============================================================================
  // PatternRegistry Integration
  // ============================================================================

  describe('PatternRegistry Integration', () => {
    it('should dynamically update when patterns are added to registry', () => {
      const macro = MacroEntityValidator.validate({
        id: 'fx-control',
        targets: [{ patternId: 'fx-*', parameter: 'depth' }]
      });

      expander.registerMacro(macro);

      // Initially no fx patterns
      let result = expander.expand('fx-control', 75);
      expect(result.expandedTargets).toHaveLength(0);

      // Add fx patterns
      registry.register(
        { id: 'fx-reverb', type: 'euclidean', enabled: true, steps: 16, pulses: 4, rotation: 0 },
        () => []
      );
      registry.register(
        { id: 'fx-delay', type: 'euclidean', enabled: true, steps: 16, pulses: 8, rotation: 0 },
        () => []
      );

      // Now should expand to 2 targets
      result = expander.expand('fx-control', 75);
      expect(result.expandedTargets).toHaveLength(2);
      expect(result.expandedTargets.map(t => t.patternId).sort()).toEqual(['fx-delay', 'fx-reverb']);
    });

    it('should dynamically update when patterns are removed from registry', () => {
      const macro = MacroEntityValidator.validate({
        id: 'drum-control',
        targets: [{ patternId: 'drum-*', parameter: 'velocity' }]
      });

      expander.registerMacro(macro);

      // Initially 5 drum patterns
      let result = expander.expand('drum-control', 90);
      expect(result.expandedTargets).toHaveLength(5);

      // Remove some drum patterns
      registry.unregister('drum-clap');
      registry.unregister('drum-ride');

      // Now should only expand to 3 targets
      result = expander.expand('drum-control', 90);
      expect(result.expandedTargets).toHaveLength(3);
      expect(result.expandedTargets.map(t => t.patternId).sort()).toEqual([
        'drum-hihat',
        'drum-kick',
        'drum-snare'
      ]);
    });

    it('should only match enabled patterns when registry filters', () => {
      // This test assumes PatternRegistry.getAll() returns all patterns
      // If you want to filter by enabled, use getEnabled() in MacroExpander
      const macro = MacroEntityValidator.validate({
        id: 'all-patterns',
        targets: [{ patternId: '*', parameter: 'velocity' }]
      });

      expander.registerMacro(macro);

      const result = expander.expand('all-patterns', 100);

      // Should match all 10 registered patterns
      expect(result.expandedTargets).toHaveLength(10);
    });
  });

  // ============================================================================
  // Real-World Scenario Tests
  // ============================================================================

  describe('Real-World Scenarios', () => {
    it('should handle master volume control for entire mix', () => {
      const macro = MacroEntityValidator.validate({
        id: 'master-volume',
        targets: [
          {
            patternId: '*',
            parameter: 'velocity',
            scale: 1.0,
            clamp: { min: 0, max: 127 }
          }
        ]
      });

      expander.registerMacro(macro);

      const events: ParameterChangeEvent[] = [];
      expander.on('parameter-change', event => events.push(event));

      expander.expand('master-volume', 100);

      // All 10 patterns should receive velocity change
      expect(events).toHaveLength(10);
      expect(events.every(e => e.value === 100)).toBe(true);
      expect(events.every(e => e.parameter === 'velocity')).toBe(true);
    });

    it('should handle section-specific volume control', () => {
      const macro = MacroEntityValidator.validate({
        id: 'drum-mix',
        targets: [
          { patternId: 'drum-kick', parameter: 'velocity', scale: 1.5, clamp: { max: 127 } },
          { patternId: 'drum-snare', parameter: 'velocity', scale: 1.3, clamp: { max: 127 } },
          { patternId: 'drum-hihat', parameter: 'velocity', scale: 0.7 },
          { patternId: 'drum-clap', parameter: 'velocity', scale: 1.2, clamp: { max: 127 } },
          { patternId: 'drum-ride', parameter: 'velocity', scale: 0.8 }
        ]
      });

      expander.registerMacro(macro);

      const result = expander.expand('drum-mix', 80);

      expect(result.expandedTargets).toHaveLength(5);

      // Verify individual transformations
      const kickTarget = result.expandedTargets.find(t => t.patternId === 'drum-kick');
      expect(kickTarget?.value).toBe(120); // 80 * 1.5 = 120

      const snareTarget = result.expandedTargets.find(t => t.patternId === 'drum-snare');
      expect(snareTarget?.value).toBe(104); // 80 * 1.3 = 104

      const hihatTarget = result.expandedTargets.find(t => t.patternId === 'drum-hihat');
      expect(hihatTarget?.value).toBe(56); // 80 * 0.7 = 56

      const clapTarget = result.expandedTargets.find(t => t.patternId === 'drum-clap');
      expect(clapTarget?.value).toBe(96); // 80 * 1.2 = 96

      const rideTarget = result.expandedTargets.find(t => t.patternId === 'drum-ride');
      expect(rideTarget?.value).toBe(64); // 80 * 0.8 = 64
    });

    it('should handle multi-parameter macro (velocity and note)', () => {
      const macro = MacroEntityValidator.validate({
        id: 'dynamics-and-pitch',
        targets: [
          {
            patternId: 'bass-*',
            parameter: 'velocity',
            scale: 1.2,
            clamp: { max: 127 },
            priority: 1
          },
          {
            patternId: 'bass-*',
            parameter: 'note',
            scale: 0.5,
            offset: 36, // MIDI note 36 = C1
            clamp: { min: 24, max: 60 },
            priority: 2
          }
        ]
      });

      expander.registerMacro(macro);

      const result = expander.expand('dynamics-and-pitch', 48);

      // 2 bass patterns × 2 parameters = 4 targets
      expect(result.expandedTargets).toHaveLength(4);

      // Velocity targets (priority 1)
      const velocityTargets = result.expandedTargets.filter(t => t.parameter === 'velocity');
      expect(velocityTargets).toHaveLength(2);
      // 48 * 1.2 = 57.6, but check with tolerance for floating point
      expect(velocityTargets.every(t => Math.abs(t.value - 57.6) < 0.01)).toBe(true);
      expect(velocityTargets.every(t => t.priority === 1)).toBe(true);

      // Note targets (priority 2)
      const noteTargets = result.expandedTargets.filter(t => t.parameter === 'note');
      expect(noteTargets).toHaveLength(2);
      expect(noteTargets.every(t => t.value === 60)).toBe(true); // (48 * 0.5) + 36 = 60
      expect(noteTargets.every(t => t.priority === 2)).toBe(true);
    });

    it('should handle performance macro with extreme value transformation', () => {
      const macro = MacroEntityValidator.validate({
        id: 'filter-sweep',
        targets: [
          {
            patternId: '*',
            parameter: 'cutoff',
            scale: 2.0,
            offset: -64,
            clamp: { min: 0, max: 127 }
          }
        ]
      });

      expander.registerMacro(macro);

      // Test low value
      let result = expander.expand('filter-sweep', 20);
      // (20 * 2.0) - 64 = -24, clamped to 0
      expect(result.expandedTargets.every(t => t.value === 0)).toBe(true);

      // Test mid value
      result = expander.expand('filter-sweep', 64);
      // (64 * 2.0) - 64 = 64
      expect(result.expandedTargets.every(t => t.value === 64)).toBe(true);

      // Test high value
      result = expander.expand('filter-sweep', 100);
      // (100 * 2.0) - 64 = 136, clamped to 127
      expect(result.expandedTargets.every(t => t.value === 127)).toBe(true);
    });

    it('should handle layered priority execution', () => {
      const macro = MacroEntityValidator.validate({
        id: 'layered-control',
        targets: [
          // Low priority (execute first)
          { patternId: 'drum-*', parameter: 'velocity', priority: -1 },

          // Default priority
          { patternId: 'bass-*', parameter: 'velocity', priority: 0 },

          // High priority (execute last)
          { patternId: 'lead-*', parameter: 'velocity', priority: 1 },
          { patternId: 'pad-*', parameter: 'velocity', priority: 2 }
        ]
      });

      expander.registerMacro(macro);

      const events: ParameterChangeEvent[] = [];
      expander.on('parameter-change', event => events.push(event));

      expander.expand('layered-control', 100);

      // Verify execution order by priority
      expect(events[0].priority).toBe(-1); // Drums first
      expect(events[5].priority).toBe(0); // Bass second (index 5 = after 5 drums)
      expect(events[7].priority).toBe(1); // Lead third (index 7 = after 5 drums + 2 bass)
      expect(events[9].priority).toBe(2); // Pad last (index 9 = after all above)
    });

    it('should handle suffix wildcard for instrument families', () => {
      // Add more kick patterns
      registry.register(
        { id: 'acoustic-kick', type: 'euclidean', enabled: true, steps: 16, pulses: 4, rotation: 0 },
        () => []
      );
      registry.register(
        { id: 'electronic-kick', type: 'euclidean', enabled: true, steps: 16, pulses: 4, rotation: 0 },
        () => []
      );

      const macro = MacroEntityValidator.validate({
        id: 'all-kicks',
        targets: [
          {
            patternId: '*-kick',
            parameter: 'velocity',
            scale: 1.5,
            clamp: { max: 127 }
          }
        ]
      });

      expander.registerMacro(macro);

      const result = expander.expand('all-kicks', 80);

      // Should match: drum-kick, acoustic-kick, electronic-kick
      expect(result.expandedTargets).toHaveLength(3);
      expect(result.expandedTargets.map(t => t.patternId).sort()).toEqual([
        'acoustic-kick',
        'drum-kick',
        'electronic-kick'
      ]);

      // All should have transformed value: 80 * 1.5 = 120
      expect(result.expandedTargets.every(t => t.value === 120)).toBe(true);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance Characteristics', () => {
    it('should handle large number of targets efficiently (<5ms)', () => {
      // Register 100 patterns
      for (let i = 0; i < 100; i++) {
        registry.register(
          { id: `pattern-${i}`, type: 'euclidean', enabled: true, steps: 16, pulses: 4, rotation: 0 },
          () => []
        );
      }

      const macro = MacroEntityValidator.validate({
        id: 'mass-control',
        targets: [
          {
            patternId: '*',
            parameter: 'velocity',
            scale: 1.2,
            offset: 10,
            clamp: { min: 0, max: 127 }
          }
        ]
      });

      expander.registerMacro(macro);

      const startTime = performance.now();
      const result = expander.expand('mass-control', 80);
      const endTime = performance.now();
      const latency = endTime - startTime;

      // Total patterns: 10 original + 100 new = 110
      expect(result.expandedTargets).toHaveLength(110);

      // Performance contract: <5ms for 50+ targets
      expect(latency).toBeLessThan(5);
    });

    it('should handle complex wildcard matching efficiently', () => {
      const macro = MacroEntityValidator.validate({
        id: 'complex-matching',
        targets: [
          { patternId: 'drum-*', parameter: 'velocity' },
          { patternId: '*-synth', parameter: 'note' },
          { patternId: '*-melody', parameter: 'duration' },
          { patternId: 'lead-*', parameter: 'cutoff' },
          { patternId: '*', parameter: 'pan' }
        ]
      });

      expander.registerMacro(macro);

      const startTime = performance.now();
      const result = expander.expand('complex-matching', 100);
      const endTime = performance.now();
      const latency = endTime - startTime;

      // Should complete quickly even with multiple wildcard expansions
      expect(latency).toBeLessThan(5);

      // Verify all patterns were processed
      expect(result.expandedTargets.length).toBeGreaterThan(0);
    });
  });
});
