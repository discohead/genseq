import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MappingRouter } from '../../src/mappings/MappingRouter';
import type { MappingEntity } from '../../src/config/entities/MappingEntity';
import type { MacroEntity } from '../../src/config/entities/MacroEntity';
import type { MidiInputEvent } from '../../src/midi/MidiInputHandler';

/**
 * T061: MappingRouter Unit Tests
 *
 * Tests routing MIDI input events to pattern parameters:
 * - Parameter target routing
 * - Macro target expansion
 * - Scene target triggers
 * - Wildcard pattern matching
 * - Transformation application
 * - Smoothing state management
 */

describe('MappingRouter', () => {
  let router: MappingRouter;

  beforeEach(() => {
    router = new MappingRouter();
  });

  describe('Registration', () => {
    it('should register and unregister mappings', () => {
      const mapping: MappingEntity = {
        id: 'test-mapping',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMapping(mapping);
      expect(router.hasMapping('test-mapping')).toBe(true);
      expect(router.getMappingCount()).toBe(1);

      router.unregisterMapping('test-mapping');
      expect(router.hasMapping('test-mapping')).toBe(false);
      expect(router.getMappingCount()).toBe(0);
    });

    it('should register and unregister macros', () => {
      const macro: MacroEntity = {
        id: 'test-macro',
        targets: [
          { patternId: 'kick', parameter: 'velocity' },
          { patternId: 'snare', parameter: 'velocity' }
        ]
      };

      router.registerMacro(macro);
      expect(router.hasMacro('test-macro')).toBe(true);
      expect(router.getMacroCount()).toBe(1);

      router.unregisterMacro('test-macro');
      expect(router.hasMacro('test-macro')).toBe(false);
      expect(router.getMacroCount()).toBe(0);
    });

    it('should clear all mappings', () => {
      const mapping1: MappingEntity = {
        id: 'mapping1',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'velocity' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0, 100] }
      };

      const mapping2: MappingEntity = {
        id: 'mapping2',
        source: { type: 'cc', channel: 1, controller: 2 },
        target: { type: 'parameter', patternId: 'snare', parameter: 'velocity' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0, 100] }
      };

      router.registerMapping(mapping1);
      router.registerMapping(mapping2);
      expect(router.getMappingCount()).toBe(2);

      router.clearMappings();
      expect(router.getMappingCount()).toBe(0);
    });

    it('should update available patterns', () => {
      router.updateAvailablePatterns(['kick', 'snare', 'hihat']);
      expect(router.getAvailablePatternsCount()).toBe(3);

      router.updateAvailablePatterns(['kick']);
      expect(router.getAvailablePatternsCount()).toBe(1);
    });
  });

  describe('Parameter Target Routing', () => {
    it('should route CC event to parameter target with linear transformation', () => {
      const mapping: MappingEntity = {
        id: 'cc-to-velocity',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0]).toMatchObject({
        patternId: 'kick',
        parameter: 'velocity',
        value: expect.closeTo(50.39, 0.1) // 64/127 * 100
      });
    });

    it('should route note event to parameter target', () => {
      const mapping: MappingEntity = {
        id: 'note-to-density',
        source: {
          type: 'note',
          channel: 1,
          note: 60
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 1]
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'note',
        device: 'Test Keyboard',
        channel: 1,
        note: 60,
        velocity: 100,
        noteOn: true,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0]).toMatchObject({
        patternId: 'kick',
        parameter: 'density'
      });
    });

    it('should route pitchbend event to parameter target', () => {
      const mapping: MappingEntity = {
        id: 'pitchbend-to-note',
        source: {
          type: 'pitchbend',
          channel: 1
        },
        target: {
          type: 'parameter',
          patternId: 'synth',
          parameter: 'note'
        },
        transform: {
          type: 'linear',
          inputRange: [-8192, 8191],
          outputRange: [48, 72]
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'pitchbend',
        device: 'Test Keyboard',
        channel: 1,
        value: 0, // Center position
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0]).toMatchObject({
        patternId: 'synth',
        parameter: 'note',
        value: expect.closeTo(60, 0.1) // Center of 48-72 range
      });
    });

    it('should not route events that do not match mapping criteria', () => {
      const mapping: MappingEntity = {
        id: 'specific-cc',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      // Wrong controller
      const event1: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 2,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event1);
      expect(parameterChanges).toHaveLength(0);

      // Wrong channel
      const event2: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 2,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event2);
      expect(parameterChanges).toHaveLength(0);

      // Wrong type
      const event3: MidiInputEvent = {
        type: 'note',
        device: 'Test Controller',
        channel: 1,
        note: 60,
        velocity: 100,
        noteOn: true,
        timestamp: Date.now()
      };

      router.routeEvent(event3);
      expect(parameterChanges).toHaveLength(0);
    });

    it('should filter by device name', () => {
      const mapping: MappingEntity = {
        id: 'device-specific',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1,
          device: 'Controller A'
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      // Correct device
      const event1: MidiInputEvent = {
        type: 'cc',
        device: 'Controller A',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event1);
      expect(parameterChanges).toHaveLength(1);

      // Wrong device
      const event2: MidiInputEvent = {
        type: 'cc',
        device: 'Controller B',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event2);
      expect(parameterChanges).toHaveLength(1); // Still 1, not 2
    });

    it('should handle dead zones by not emitting events', () => {
      const mapping: MappingEntity = {
        id: 'with-deadzone',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100],
          deadZone: 10 // Ignore values 0-10
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      // Value in dead zone
      const event1: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 1,
        value: 5,
        timestamp: Date.now()
      };

      router.routeEvent(event1);
      expect(parameterChanges).toHaveLength(0);

      // Value outside dead zone
      const event2: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event2);
      expect(parameterChanges).toHaveLength(1);
    });
  });

  describe('Macro Target Routing', () => {
    it('should expand macro to multiple parameter targets', () => {
      const macro: MacroEntity = {
        id: 'master-volume',
        targets: [
          { patternId: 'kick', parameter: 'velocity' },
          { patternId: 'snare', parameter: 'velocity' },
          { patternId: 'hihat', parameter: 'velocity' }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'master-volume'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);
      router.updateAvailablePatterns(['kick', 'snare', 'hihat']);

      const parameterChanges: any[] = [];
      const macroExpanded: any[] = [];

      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      router.on('macro-expanded', (event) => {
        macroExpanded.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 100,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(macroExpanded).toHaveLength(1);
      expect(macroExpanded[0].macroId).toBe('master-volume');
      expect(macroExpanded[0].targets).toHaveLength(3);

      expect(parameterChanges).toHaveLength(3);
      expect(parameterChanges[0]).toMatchObject({
        patternId: 'kick',
        parameter: 'velocity'
      });
      expect(parameterChanges[1]).toMatchObject({
        patternId: 'snare',
        parameter: 'velocity'
      });
      expect(parameterChanges[2]).toMatchObject({
        patternId: 'hihat',
        parameter: 'velocity'
      });
    });

    it('should apply scale and offset to macro targets', () => {
      const macro: MacroEntity = {
        id: 'scaled-macro',
        targets: [
          {
            patternId: 'kick',
            parameter: 'velocity',
            scale: 0.5,
            offset: 10
          },
          {
            patternId: 'snare',
            parameter: 'velocity',
            scale: 1.5,
            offset: -5
          }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'scaled-macro'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);
      router.updateAvailablePatterns(['kick', 'snare']);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 100,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(2);

      // kick: ~78.74 * 0.5 + 10 = ~49.37
      expect(parameterChanges[0].value).toBeCloseTo(49.37, 0.5);

      // snare: ~78.74 * 1.5 - 5 = ~113.11
      expect(parameterChanges[1].value).toBeCloseTo(113.11, 0.5);
    });

    it('should apply clamp to macro targets', () => {
      const macro: MacroEntity = {
        id: 'clamped-macro',
        targets: [
          {
            patternId: 'kick',
            parameter: 'velocity',
            scale: 2.0,
            clamp: { min: 0, max: 100 }
          }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'clamped-macro'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);
      router.updateAvailablePatterns(['kick']);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 127, // Max value
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(1);
      // 100 * 2.0 = 200, clamped to 100
      expect(parameterChanges[0].value).toBe(100);
    });

    it('should sort macro targets by priority', () => {
      const macro: MacroEntity = {
        id: 'priority-macro',
        targets: [
          { patternId: 'low', parameter: 'velocity', priority: 1 },
          { patternId: 'high', parameter: 'velocity', priority: 10 },
          { patternId: 'medium', parameter: 'velocity', priority: 5 }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'priority-macro'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);
      router.updateAvailablePatterns(['low', 'medium', 'high']);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(3);
      expect(parameterChanges[0].patternId).toBe('high'); // Priority 10
      expect(parameterChanges[1].patternId).toBe('medium'); // Priority 5
      expect(parameterChanges[2].patternId).toBe('low'); // Priority 1
    });

    it('should handle missing macro gracefully', () => {
      const mapping: MappingEntity = {
        id: 'cc-to-nonexistent-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'nonexistent'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      // Should not throw error
      expect(() => router.routeEvent(event)).not.toThrow();
      expect(parameterChanges).toHaveLength(0);
    });
  });

  describe('Wildcard Pattern Matching', () => {
    beforeEach(() => {
      router.updateAvailablePatterns([
        'kick',
        'snare',
        'drum-kick',
        'drum-snare',
        'drum-hihat',
        'synth-bass',
        'synth-lead',
        'kick-808',
        'snare-909'
      ]);
    });

    it('should match all patterns with * wildcard', () => {
      const macro: MacroEntity = {
        id: 'all-patterns',
        targets: [
          { patternId: '*', parameter: 'velocity' }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'all-patterns'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(9); // All patterns
    });

    it('should match patterns with prefix wildcard (prefix-*)', () => {
      const macro: MacroEntity = {
        id: 'drum-patterns',
        targets: [
          { patternId: 'drum-*', parameter: 'velocity' }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'drum-patterns'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(3);
      const patternIds = parameterChanges.map(p => p.patternId);
      expect(patternIds).toContain('drum-kick');
      expect(patternIds).toContain('drum-snare');
      expect(patternIds).toContain('drum-hihat');
    });

    it('should match patterns with suffix wildcard (*-suffix)', () => {
      const macro: MacroEntity = {
        id: 'kick-patterns',
        targets: [
          { patternId: '*-kick', parameter: 'velocity' }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'kick-patterns'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0].patternId).toBe('drum-kick');
    });

    it('should match exact pattern when no wildcard', () => {
      const macro: MacroEntity = {
        id: 'specific-pattern',
        targets: [
          { patternId: 'kick', parameter: 'velocity' }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'specific-pattern'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0].patternId).toBe('kick');
    });

    it('should return empty array for nonexistent exact pattern', () => {
      const macro: MacroEntity = {
        id: 'nonexistent-pattern',
        targets: [
          { patternId: 'nonexistent', parameter: 'velocity' }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'nonexistent-pattern'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(0);
    });

    it('should match multiple wildcard patterns in one macro', () => {
      const macro: MacroEntity = {
        id: 'multi-wildcard',
        targets: [
          { patternId: 'drum-*', parameter: 'velocity' },
          { patternId: 'synth-*', parameter: 'velocity' }
        ]
      };

      const mapping: MappingEntity = {
        id: 'cc-to-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'multi-wildcard'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 7,
        value: 64,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(parameterChanges).toHaveLength(5); // 3 drum-* + 2 synth-*
      const patternIds = parameterChanges.map(p => p.patternId);
      expect(patternIds).toContain('drum-kick');
      expect(patternIds).toContain('drum-snare');
      expect(patternIds).toContain('drum-hihat');
      expect(patternIds).toContain('synth-bass');
      expect(patternIds).toContain('synth-lead');
    });
  });

  describe('Scene Target Routing', () => {
    it('should trigger scene on note-on event', () => {
      const mapping: MappingEntity = {
        id: 'note-to-scene',
        source: {
          type: 'note',
          channel: 1,
          note: 60
        },
        target: {
          type: 'scene',
          sceneId: 'scene-1'
        },
        quantize: 'bar'
      };

      router.registerMapping(mapping);

      const sceneTriggered: any[] = [];
      router.on('scene-trigger', (event) => {
        sceneTriggered.push(event);
      });

      const event: MidiInputEvent = {
        type: 'note',
        device: 'Test Keyboard',
        channel: 1,
        note: 60,
        velocity: 100,
        noteOn: true,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(sceneTriggered).toHaveLength(1);
      expect(sceneTriggered[0]).toMatchObject({
        sceneId: 'scene-1',
        quantize: 'bar'
      });
    });

    it('should not trigger scene on note-off event', () => {
      const mapping: MappingEntity = {
        id: 'note-to-scene',
        source: {
          type: 'note',
          channel: 1,
          note: 60
        },
        target: {
          type: 'scene',
          sceneId: 'scene-1'
        }
      };

      router.registerMapping(mapping);

      const sceneTriggered: any[] = [];
      router.on('scene-trigger', (event) => {
        sceneTriggered.push(event);
      });

      const event: MidiInputEvent = {
        type: 'note',
        device: 'Test Keyboard',
        channel: 1,
        note: 60,
        velocity: 0,
        noteOn: false,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(sceneTriggered).toHaveLength(0);
    });

    it('should trigger scene on CC event', () => {
      const mapping: MappingEntity = {
        id: 'cc-to-scene',
        source: {
          type: 'cc',
          channel: 1,
          controller: 64
        },
        target: {
          type: 'scene',
          sceneId: 'scene-2'
        },
        quantize: 'beat'
      };

      router.registerMapping(mapping);

      const sceneTriggered: any[] = [];
      router.on('scene-trigger', (event) => {
        sceneTriggered.push(event);
      });

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test Controller',
        channel: 1,
        controller: 64,
        value: 127,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(sceneTriggered).toHaveLength(1);
      expect(sceneTriggered[0]).toMatchObject({
        sceneId: 'scene-2',
        quantize: 'beat'
      });
    });

    it('should trigger scene without quantize', () => {
      const mapping: MappingEntity = {
        id: 'note-to-scene-immediate',
        source: {
          type: 'note',
          channel: 1,
          note: 60
        },
        target: {
          type: 'scene',
          sceneId: 'scene-immediate'
        }
      };

      router.registerMapping(mapping);

      const sceneTriggered: any[] = [];
      router.on('scene-trigger', (event) => {
        sceneTriggered.push(event);
      });

      const event: MidiInputEvent = {
        type: 'note',
        device: 'Test Keyboard',
        channel: 1,
        note: 60,
        velocity: 100,
        noteOn: true,
        timestamp: Date.now()
      };

      router.routeEvent(event);

      expect(sceneTriggered).toHaveLength(1);
      expect(sceneTriggered[0].sceneId).toBe('scene-immediate');
      expect(sceneTriggered[0].quantize).toBeUndefined();
    });
  });

  describe('Smoothing State Management', () => {
    it('should maintain separate smoothing state per mapping', () => {
      const mapping1: MappingEntity = {
        id: 'mapping1',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100],
          smoothing: 100
        }
      };

      const mapping2: MappingEntity = {
        id: 'mapping2',
        source: {
          type: 'cc',
          channel: 1,
          controller: 2
        },
        target: {
          type: 'parameter',
          patternId: 'snare',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100],
          smoothing: 100
        }
      };

      router.registerMapping(mapping1);
      router.registerMapping(mapping2);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      // Send events to both mappings
      router.routeEvent({
        type: 'cc',
        device: 'Test',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      });

      router.routeEvent({
        type: 'cc',
        device: 'Test',
        channel: 1,
        controller: 2,
        value: 100,
        timestamp: Date.now()
      });

      expect(parameterChanges).toHaveLength(2);
      expect(parameterChanges[0].patternId).toBe('kick');
      expect(parameterChanges[1].patternId).toBe('snare');
    });

    it('should clear smoothing state when mapping is unregistered', () => {
      const mapping: MappingEntity = {
        id: 'test-mapping',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100],
          smoothing: 100
        }
      };

      router.registerMapping(mapping);

      // Send event to build smoothing state
      router.routeEvent({
        type: 'cc',
        device: 'Test',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      });

      router.unregisterMapping('test-mapping');

      // Re-register and send event
      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      router.routeEvent({
        type: 'cc',
        device: 'Test',
        channel: 1,
        controller: 1,
        value: 100,
        timestamp: Date.now()
      });

      // Should work without errors (smoothing state was cleared)
      expect(parameterChanges).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for parameter target without transform', () => {
      const mapping: any = {
        id: 'invalid-mapping',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        }
        // Missing transform
      };

      router.registerMapping(mapping);

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      };

      expect(() => router.routeEvent(event)).toThrow('Transform is required');
    });

    it('should throw error for macro target without transform', () => {
      const mapping: any = {
        id: 'invalid-macro-mapping',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'macro',
          macroId: 'test-macro'
        }
        // Missing transform
      };

      const macro: MacroEntity = {
        id: 'test-macro',
        targets: [
          { patternId: 'kick', parameter: 'velocity' }
        ]
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);

      const event: MidiInputEvent = {
        type: 'cc',
        device: 'Test',
        channel: 1,
        controller: 1,
        value: 64,
        timestamp: Date.now()
      };

      expect(() => router.routeEvent(event)).toThrow('Transform is required');
    });
  });

  describe('Resource Management', () => {
    it('should destroy router and clean up resources', () => {
      const mapping: MappingEntity = {
        id: 'test-mapping',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      const macro: MacroEntity = {
        id: 'test-macro',
        targets: [
          { patternId: 'kick', parameter: 'velocity' }
        ]
      };

      router.registerMapping(mapping);
      router.registerMacro(macro);
      router.updateAvailablePatterns(['kick', 'snare']);

      expect(router.getMappingCount()).toBe(1);
      expect(router.getMacroCount()).toBe(1);
      expect(router.getAvailablePatternsCount()).toBe(2);

      router.destroy();

      expect(router.getMappingCount()).toBe(0);
      expect(router.getMacroCount()).toBe(0);
      expect(router.getAvailablePatternsCount()).toBe(0);
    });
  });
});
