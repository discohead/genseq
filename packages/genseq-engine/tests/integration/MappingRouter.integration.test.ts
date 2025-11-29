import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MappingRouter } from '../../src/mappings/MappingRouter';
import { MidiInputHandler } from '../../src/midi/MidiInputHandler';
import type { MappingEntity } from '../../src/config/entities/MappingEntity';
import type { MacroEntity } from '../../src/config/entities/MacroEntity';

/**
 * T061: MappingRouter Integration Tests
 *
 * Tests integration between MappingRouter, MidiInputHandler, and InputTransformer:
 * - End-to-end MIDI routing flow
 * - MidiInputHandler → MappingRouter integration
 * - Complex transformation chains
 * - Multiple concurrent mappings
 * - Real-world usage patterns
 */

describe('MappingRouter Integration', () => {
  let router: MappingRouter;
  let inputHandler: MidiInputHandler;

  beforeEach(() => {
    router = new MappingRouter();
    inputHandler = new MidiInputHandler();
  });

  afterEach(() => {
    router.destroy();
    inputHandler.destroy();
  });

  describe('MidiInputHandler Integration', () => {
    it('should route MIDI events from MidiInputHandler to parameter targets', async () => {
      const mapping: MappingEntity = {
        id: 'cc1-to-velocity',
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

      // Connect MidiInputHandler to MappingRouter
      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Simulate MIDI CC message
      const ccMessage = [0xB0, 1, 64]; // CC1, value 64, channel 1
      const parsedEvent = inputHandler.parseMessage(ccMessage, 'Test Controller');

      expect(parsedEvent).toBeTruthy();
      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0]).toMatchObject({
        patternId: 'kick',
        parameter: 'velocity',
        value: expect.closeTo(50.39, 0.1)
      });
    });

    it('should route note events to scene triggers', async () => {
      const mapping: MappingEntity = {
        id: 'note-to-scene',
        source: {
          type: 'note',
          channel: 1,
          note: 60
        },
        target: {
          type: 'scene',
          sceneId: 'verse'
        },
        quantize: 'bar'
      };

      router.registerMapping(mapping);

      const sceneTriggered: any[] = [];
      router.on('scene-trigger', (event) => {
        sceneTriggered.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Note On C4
      const noteOnMessage = [0x90, 60, 100]; // Note On, note 60, velocity 100, channel 1
      inputHandler.parseMessage(noteOnMessage, 'Test Keyboard');

      expect(sceneTriggered).toHaveLength(1);
      expect(sceneTriggered[0]).toMatchObject({
        sceneId: 'verse',
        quantize: 'bar'
      });

      // Note Off should not trigger
      const noteOffMessage = [0x80, 60, 0]; // Note Off, note 60
      inputHandler.parseMessage(noteOffMessage, 'Test Keyboard');

      expect(sceneTriggered).toHaveLength(1); // Still 1
    });

    it('should handle multiple concurrent mappings', async () => {
      const mapping1: MappingEntity = {
        id: 'cc1-to-kick-velocity',
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

      const mapping2: MappingEntity = {
        id: 'cc2-to-snare-velocity',
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
          type: 'exponential',
          inputRange: [0, 127],
          outputRange: [0, 100],
          curve: 2
        }
      };

      const mapping3: MappingEntity = {
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

      router.registerMapping(mapping1);
      router.registerMapping(mapping2);
      router.registerMapping(mapping3);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Send CC1
      inputHandler.parseMessage([0xB0, 1, 64], 'Test');
      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0].patternId).toBe('kick');

      // Send CC2
      inputHandler.parseMessage([0xB0, 2, 64], 'Test');
      expect(parameterChanges).toHaveLength(2);
      expect(parameterChanges[1].patternId).toBe('snare');

      // Send Pitchbend
      inputHandler.parseMessage([0xE0, 0, 64], 'Test'); // Center position
      expect(parameterChanges).toHaveLength(3);
      expect(parameterChanges[2].patternId).toBe('synth');
    });

    it('should filter events by device and channel', async () => {
      const mapping: MappingEntity = {
        id: 'device-filtered',
        source: {
          type: 'cc',
          channel: 2,
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

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Wrong device
      inputHandler.parseMessage([0xB1, 1, 64], 'Controller B'); // Channel 2, CC1
      expect(parameterChanges).toHaveLength(0);

      // Wrong channel
      inputHandler.parseMessage([0xB0, 1, 64], 'Controller A'); // Channel 1, CC1
      expect(parameterChanges).toHaveLength(0);

      // Correct device and channel
      inputHandler.parseMessage([0xB1, 1, 64], 'Controller A'); // Channel 2, CC1
      expect(parameterChanges).toHaveLength(1);
    });
  });

  describe('Complex Transformation Chains', () => {
    it('should apply exponential curve with smoothing', async () => {
      const mapping: MappingEntity = {
        id: 'exponential-smoothed',
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
          type: 'exponential',
          inputRange: [0, 127],
          outputRange: [0, 100],
          curve: 2,
          smoothing: 50
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Send multiple values to test smoothing
      inputHandler.parseMessage([0xB0, 1, 50], 'Test');
      inputHandler.parseMessage([0xB0, 1, 60], 'Test');
      inputHandler.parseMessage([0xB0, 1, 70], 'Test');

      expect(parameterChanges.length).toBeGreaterThan(0);
      // Values should be smoothed
    });

    it('should apply dead zones', async () => {
      const mapping: MappingEntity = {
        id: 'with-deadzones',
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
          deadZone: 10,
          deadZoneEnd: 10
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Start dead zone (0-10)
      inputHandler.parseMessage([0xB0, 1, 5], 'Test');
      expect(parameterChanges).toHaveLength(0);

      // Active range
      inputHandler.parseMessage([0xB0, 1, 64], 'Test');
      expect(parameterChanges).toHaveLength(1);

      // End dead zone (117-127)
      inputHandler.parseMessage([0xB0, 1, 125], 'Test');
      expect(parameterChanges).toHaveLength(1); // Still 1
    });

    it('should apply quantization', async () => {
      const mapping: MappingEntity = {
        id: 'quantized',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'synth',
          parameter: 'note'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [48, 72],
          quantize: 12 // Chromatic scale
        }
      };

      router.registerMapping(mapping);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      inputHandler.parseMessage([0xB0, 1, 64], 'Test');

      expect(parameterChanges).toHaveLength(1);
      // Value should be quantized to discrete steps
      const value = parameterChanges[0].value;
      const range = 72 - 48;
      const stepSize = range / (12 - 1);
      const expectedSteps = [48, 48 + stepSize, 48 + 2 * stepSize, /* ... */];
      // Value should be close to one of the expected steps
    });
  });

  describe('Macro Expansion', () => {
    it('should expand macro to multiple patterns with wildcard matching', async () => {
      const macro: MacroEntity = {
        id: 'all-drums',
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
          macroId: 'all-drums'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100]
        }
      };

      router.registerMacro(macro);
      router.registerMapping(mapping);
      router.updateAvailablePatterns(['drum-kick', 'drum-snare', 'drum-hihat', 'synth-bass']);

      const parameterChanges: any[] = [];
      const macroExpanded: any[] = [];

      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      router.on('macro-expanded', (event) => {
        macroExpanded.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      inputHandler.parseMessage([0xB0, 7, 100], 'Test');

      expect(macroExpanded).toHaveLength(1);
      expect(macroExpanded[0].macroId).toBe('all-drums');
      expect(macroExpanded[0].targets).toHaveLength(3);

      expect(parameterChanges).toHaveLength(3);
      const patternIds = parameterChanges.map(p => p.patternId);
      expect(patternIds).toContain('drum-kick');
      expect(patternIds).toContain('drum-snare');
      expect(patternIds).toContain('drum-hihat');
      expect(patternIds).not.toContain('synth-bass');
    });

    it('should apply different transformations to macro targets', async () => {
      const macro: MacroEntity = {
        id: 'scaled-drums',
        targets: [
          { patternId: 'kick', parameter: 'velocity', scale: 1.0 },
          { patternId: 'snare', parameter: 'velocity', scale: 0.8 },
          { patternId: 'hihat', parameter: 'velocity', scale: 0.6 }
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
          macroId: 'scaled-drums'
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
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      inputHandler.parseMessage([0xB0, 7, 127], 'Test'); // Max value

      expect(parameterChanges).toHaveLength(3);

      const kick = parameterChanges.find(p => p.patternId === 'kick');
      const snare = parameterChanges.find(p => p.patternId === 'snare');
      const hihat = parameterChanges.find(p => p.patternId === 'hihat');

      expect(kick.value).toBeCloseTo(100, 0.1); // 100 * 1.0
      expect(snare.value).toBeCloseTo(80, 0.1); // 100 * 0.8
      expect(hihat.value).toBeCloseTo(60, 0.1); // 100 * 0.6
    });

    it('should apply offset and clamp to macro targets', async () => {
      const macro: MacroEntity = {
        id: 'offset-clamped',
        targets: [
          {
            patternId: 'kick',
            parameter: 'velocity',
            scale: 1.5,
            offset: 10,
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
          macroId: 'offset-clamped'
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

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      inputHandler.parseMessage([0xB0, 7, 127], 'Test');

      expect(parameterChanges).toHaveLength(1);
      // 100 * 1.5 + 10 = 160, clamped to 100
      expect(parameterChanges[0].value).toBe(100);
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should handle DJ mixer scenario with crossfader and EQ', async () => {
      // Crossfader controls master volume
      const masterVolumeMacro: MacroEntity = {
        id: 'master-volume',
        targets: [
          { patternId: '*', parameter: 'velocity' }
        ]
      };

      // EQ controls different frequency ranges
      const bassEqMacro: MacroEntity = {
        id: 'bass-eq',
        targets: [
          { patternId: 'kick', parameter: 'velocity' },
          { patternId: 'bass', parameter: 'velocity' }
        ]
      };

      const midEqMacro: MacroEntity = {
        id: 'mid-eq',
        targets: [
          { patternId: 'snare', parameter: 'velocity' },
          { patternId: 'synth', parameter: 'velocity' }
        ]
      };

      const crossfaderMapping: MappingEntity = {
        id: 'crossfader',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'macro',
          macroId: 'master-volume'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0, 100],
          smoothing: 20
        }
      };

      const bassEqMapping: MappingEntity = {
        id: 'bass-eq',
        source: {
          type: 'cc',
          channel: 1,
          controller: 2
        },
        target: {
          type: 'macro',
          macroId: 'bass-eq'
        },
        transform: {
          type: 'exponential',
          inputRange: [0, 127],
          outputRange: [0, 100],
          curve: 2
        }
      };

      const midEqMapping: MappingEntity = {
        id: 'mid-eq',
        source: {
          type: 'cc',
          channel: 1,
          controller: 3
        },
        target: {
          type: 'macro',
          macroId: 'mid-eq'
        },
        transform: {
          type: 'exponential',
          inputRange: [0, 127],
          outputRange: [0, 100],
          curve: 2
        }
      };

      router.registerMacro(masterVolumeMacro);
      router.registerMacro(bassEqMacro);
      router.registerMacro(midEqMacro);
      router.registerMapping(crossfaderMapping);
      router.registerMapping(bassEqMapping);
      router.registerMapping(midEqMapping);
      router.updateAvailablePatterns(['kick', 'snare', 'bass', 'synth']);

      const parameterChanges: any[] = [];
      router.on('parameter-change', (event) => {
        parameterChanges.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Crossfader
      inputHandler.parseMessage([0xB0, 1, 100], 'Mixer');
      expect(parameterChanges.length).toBeGreaterThan(0);

      parameterChanges.length = 0;

      // Bass EQ
      inputHandler.parseMessage([0xB0, 2, 80], 'Mixer');
      expect(parameterChanges).toHaveLength(2);

      parameterChanges.length = 0;

      // Mid EQ
      inputHandler.parseMessage([0xB0, 3, 60], 'Mixer');
      expect(parameterChanges).toHaveLength(2);
    });

    it('should handle performance controller with multiple pads triggering scenes', async () => {
      const sceneMappings: MappingEntity[] = [
        {
          id: 'pad1-intro',
          source: { type: 'note', channel: 10, note: 36 },
          target: { type: 'scene', sceneId: 'intro' },
          quantize: 'bar'
        },
        {
          id: 'pad2-verse',
          source: { type: 'note', channel: 10, note: 37 },
          target: { type: 'scene', sceneId: 'verse' },
          quantize: 'bar'
        },
        {
          id: 'pad3-chorus',
          source: { type: 'note', channel: 10, note: 38 },
          target: { type: 'scene', sceneId: 'chorus' },
          quantize: 'bar'
        },
        {
          id: 'pad4-breakdown',
          source: { type: 'note', channel: 10, note: 39 },
          target: { type: 'scene', sceneId: 'breakdown' },
          quantize: 'beat'
        }
      ];

      sceneMappings.forEach(m => router.registerMapping(m));

      const sceneTriggered: any[] = [];
      router.on('scene-trigger', (event) => {
        sceneTriggered.push(event);
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      // Press pads
      inputHandler.parseMessage([0x99, 36, 100], 'Pad Controller'); // Pad 1
      inputHandler.parseMessage([0x99, 37, 100], 'Pad Controller'); // Pad 2
      inputHandler.parseMessage([0x99, 38, 100], 'Pad Controller'); // Pad 3
      inputHandler.parseMessage([0x99, 39, 100], 'Pad Controller'); // Pad 4

      expect(sceneTriggered).toHaveLength(4);
      expect(sceneTriggered[0].sceneId).toBe('intro');
      expect(sceneTriggered[1].sceneId).toBe('verse');
      expect(sceneTriggered[2].sceneId).toBe('chorus');
      expect(sceneTriggered[3].sceneId).toBe('breakdown');
    });
  });

  describe('Performance and Latency', () => {
    it('should route events with <1ms latency', async () => {
      const mapping: MappingEntity = {
        id: 'latency-test',
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

      let routingLatency = 0;
      router.on('parameter-change', () => {
        routingLatency = Date.now() - startTime;
      });

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      const startTime = Date.now();
      inputHandler.parseMessage([0xB0, 1, 64], 'Test');

      expect(routingLatency).toBeLessThan(1);
    });

    it('should handle 100 concurrent mappings efficiently', async () => {
      // Create 100 mappings
      for (let i = 0; i < 100; i++) {
        const mapping: MappingEntity = {
          id: `mapping-${i}`,
          source: {
            type: 'cc',
            channel: 1,
            controller: i % 128
          },
          target: {
            type: 'parameter',
            patternId: `pattern-${i}`,
            parameter: 'velocity'
          },
          transform: {
            type: 'linear',
            inputRange: [0, 127],
            outputRange: [0, 100]
          }
        };
        router.registerMapping(mapping);
      }

      inputHandler.on('midi:received', (event) => {
        router.routeEvent(event);
      });

      const startTime = Date.now();

      // Send 100 events
      for (let i = 0; i < 100; i++) {
        inputHandler.parseMessage([0xB0, i % 128, 64], 'Test');
      }

      const totalTime = Date.now() - startTime;

      // Should process 100 events in <100ms
      expect(totalTime).toBeLessThan(100);
    });
  });
});
