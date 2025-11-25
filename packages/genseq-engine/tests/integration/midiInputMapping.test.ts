import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { MidiInputHandler } from '../../src/midi/MidiInputHandler';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import type { MappingEntity } from '../../src/config/entities/MappingEntity';
import type { MacroEntity } from '../../src/config/entities/MacroEntity';

/**
 * User Story 3: MIDI Input Control Integration Tests (RED PHASE - MUST FAIL)
 *
 * End-to-end tests for gestural MIDI input control:
 * - CC to pattern parameter mapping with transformations
 * - Note to scene trigger mapping with quantization
 * - Macro expansion (one-to-many control)
 * - Smoothing and dead zone handling
 * - Performance contracts: parameter updates within one clock tick
 */

describe('US3: MIDI Input Control Integration', () => {
  let engine: GenSeqEngine;
  let inputHandler: MidiInputHandler;
  let tempProjectDir: string;
  let patternsDir: string;
  let mappingsDir: string;
  let macrosDir: string;
  let scenesDir: string;

  beforeEach(async () => {
    // Create temporary project directory
    tempProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-midi-input-test-'));
    patternsDir = path.join(tempProjectDir, 'patterns');
    mappingsDir = path.join(tempProjectDir, 'mappings');
    macrosDir = path.join(tempProjectDir, 'macros');
    scenesDir = path.join(tempProjectDir, 'scenes');

    await fs.mkdir(patternsDir, { recursive: true });
    await fs.mkdir(mappingsDir, { recursive: true });
    await fs.mkdir(macrosDir, { recursive: true });
    await fs.mkdir(scenesDir, { recursive: true });

    // Create clock configuration
    const clockFile = path.join(tempProjectDir, 'clock.yaml');
    await fs.writeFile(clockFile, yaml.dump({
      bpm: 120,
      ppq: 96,
      timeSignature: { numerator: 4, denominator: 4 }
    }));

    // Create initial patterns
    await createPatternFile('kick', 'euclidean', {
      steps: 16,
      pulses: 4,
      rotation: 0,
      velocity: 100,
      density: 1.0
    });

    await createPatternFile('hats', 'euclidean', {
      steps: 16,
      pulses: 8,
      rotation: 0,
      velocity: 80,
      density: 1.0
    });

    await createPatternFile('snare', 'euclidean', {
      steps: 16,
      pulses: 2,
      rotation: 4,
      velocity: 110,
      density: 1.0
    });

    // Create route for patterns
    const routeFile = path.join(tempProjectDir, 'routes', 'drums.yaml');
    await fs.mkdir(path.dirname(routeFile), { recursive: true });
    await fs.writeFile(routeFile, yaml.dump({
      id: 'drums',
      name: 'Drum Bus',
      output: 'IAC Driver Bus 1',
      channel: 10
    }));

    // Initialize engine
    engine = new GenSeqEngine(tempProjectDir);
    await engine.initialize();

    inputHandler = engine.getInputHandler();
  });

  afterEach(async () => {
    if (engine) {
      await engine.shutdown();
    }
    await fs.rm(tempProjectDir, { recursive: true, force: true });
  });

  // Helper to create pattern file
  async function createPatternFile(id: string, type: string, parameters: any) {
    const patternFile = path.join(patternsDir, `${id}.yaml`);
    await fs.writeFile(patternFile, yaml.dump({
      id,
      name: `${id} pattern`,
      type,
      enabled: true,
      bus: 'drums',
      channel: 10,
      note: id === 'kick' ? 36 : id === 'snare' ? 38 : 42,
      length: 1,
      parameters
    }));
  }

  // Helper to create mapping file
  async function createMappingFile(mapping: MappingEntity) {
    const mappingFile = path.join(mappingsDir, `${mapping.id}.yaml`);
    await fs.writeFile(mappingFile, yaml.dump(mapping));
  }

  // Helper to create macro file
  async function createMacroFile(macro: MacroEntity) {
    const macroFile = path.join(macrosDir, `${macro.id}.yaml`);
    await fs.writeFile(macroFile, yaml.dump(macro));
  }

  // Helper to create scene file
  async function createSceneFile(id: string, activePatterns: string[]) {
    const sceneFile = path.join(scenesDir, `${id}.yaml`);
    await fs.writeFile(sceneFile, yaml.dump({
      id,
      name: `${id} scene`,
      patterns: activePatterns
    }));
  }

  // ============================================================================
  // Acceptance Scenario 1: CC to Pattern Parameter with Linear Scaling
  // ============================================================================

  describe('Acceptance Scenario 1: CC to Pattern Parameter', () => {
    it('should map CC1 (0-127) to kick density (0.0-1.0) with linear scaling', async () => {
      // Create mapping: CC1 → kick.density (linear 0-127 → 0.0-1.0)
      await createMappingFile({
        id: 'cc1-kick-density',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
        }
      });

      await engine.reloadMappings();

      // Start transport
      await engine.start();
      expect(engine.isPlaying()).toBe(true);

      const parameterChanges: any[] = [];
      engine.on('pattern:parameterChanged', (event) => {
        parameterChanges.push(event);
      });

      // Simulate CC1 = 0 (fader at minimum)
      inputHandler.parseMessage([0xB0, 1, 0]);

      // Wait for parameter update (should be within one clock tick)
      await new Promise(resolve => setTimeout(resolve, 15)); // ~1 tick at 120 BPM, 96 PPQ

      expect(parameterChanges).toHaveLength(1);
      expect(parameterChanges[0].patternId).toBe('kick');
      expect(parameterChanges[0].parameter).toBe('density');
      expect(parameterChanges[0].value).toBeCloseTo(0.0, 2);

      // Simulate CC1 = 64 (fader at middle)
      inputHandler.parseMessage([0xB0, 1, 64]);
      await new Promise(resolve => setTimeout(resolve, 15));

      expect(parameterChanges).toHaveLength(2);
      expect(parameterChanges[1].value).toBeCloseTo(0.504, 2); // ~0.5

      // Simulate CC1 = 127 (fader at maximum)
      inputHandler.parseMessage([0xB0, 1, 127]);
      await new Promise(resolve => setTimeout(resolve, 15));

      expect(parameterChanges).toHaveLength(3);
      expect(parameterChanges[2].value).toBeCloseTo(1.0, 2);
    });

    it('should update parameter within one clock tick (<13ms at 120 BPM, 96 PPQ)', async () => {
      await createMappingFile({
        id: 'cc1-kick-velocity',
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
          outputRange: [60, 127]
        }
      });

      await engine.reloadMappings();
      await engine.start();

      let parameterChangeTime: number = 0;
      engine.on('pattern:parameterChanged', () => {
        parameterChangeTime = performance.now();
      });

      const sendTime = performance.now();
      inputHandler.parseMessage([0xB0, 1, 100]);

      // Wait for parameter change
      await new Promise(resolve => setTimeout(resolve, 20));

      const latency = parameterChangeTime - sendTime;

      // One clock tick at 120 BPM, 96 PPQ = 6.5ms
      expect(latency).toBeLessThan(13); // Within one clock tick
    });

    it('should reflect parameter change in MIDI output', async () => {
      await createMappingFile({
        id: 'cc7-hats-velocity',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'parameter',
          patternId: 'hats',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [40, 127]
        }
      });

      await engine.reloadMappings();
      await engine.start();

      const midiEvents: any[] = [];
      engine.on('midi:sent', (event) => {
        if (event.note === 42) { // Hats note
          midiEvents.push(event);
        }
      });

      // Change hats velocity via CC
      inputHandler.parseMessage([0xB0, 7, 64]);

      // Wait for MIDI output (should be on next pattern tick)
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(midiEvents.length).toBeGreaterThan(0);
      const avgVelocity = midiEvents.reduce((sum, e) => sum + e.velocity, 0) / midiEvents.length;

      // Velocity should reflect the transformed CC value (~83)
      expect(avgVelocity).toBeCloseTo(83, 5);
    });
  });

  // ============================================================================
  // Acceptance Scenario 2: Note to Scene Trigger with Quantization
  // ============================================================================

  describe('Acceptance Scenario 2: Note to Scene Trigger', () => {
    beforeEach(async () => {
      // Create scenes
      await createSceneFile('intro', ['kick', 'hats']);
      await createSceneFile('main', ['kick', 'hats', 'snare']);
      await createSceneFile('outro', ['kick']);
    });

    it('should trigger scene "main" on next bar when pad 36 is hit', async () => {
      await createMappingFile({
        id: 'pad36-main-scene',
        source: {
          type: 'note',
          channel: 10,
          note: 36
        },
        target: {
          type: 'scene',
          sceneId: 'main'
        },
        quantize: 'bar'
      });

      await engine.reloadMappings();

      // Start in "intro" scene
      await engine.setScene('intro');
      await engine.start();

      const sceneChanges: any[] = [];
      engine.on('scene:changed', (event) => {
        sceneChanges.push(event);
      });

      // Hit pad 36 (note-on)
      inputHandler.parseMessage([0x99, 36, 100]);

      // Scene should NOT change immediately
      expect(sceneChanges).toHaveLength(0);

      // Wait for next bar (4 beats at 120 BPM = 2000ms)
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Scene should have changed to "main"
      expect(sceneChanges).toHaveLength(1);
      expect(sceneChanges[0].sceneId).toBe('main');
      expect(sceneChanges[0].quantizedTo).toBe('bar');
    });

    it('should activate all patterns in new scene simultaneously', async () => {
      await createMappingFile({
        id: 'pad37-main-scene',
        source: {
          type: 'note',
          channel: 10,
          note: 37
        },
        target: {
          type: 'scene',
          sceneId: 'main'
        },
        quantize: 'bar'
      });

      await engine.reloadMappings();

      // Start in "intro" scene (kick + hats)
      await engine.setScene('intro');
      await engine.start();

      // Hit pad 37
      inputHandler.parseMessage([0x99, 37, 100]);

      // Wait for bar boundary
      await new Promise(resolve => setTimeout(resolve, 2100));

      // All patterns in "main" should be active (kick, hats, snare)
      const activePatterns = engine.getActivePatterns();
      expect(activePatterns).toContain('kick');
      expect(activePatterns).toContain('hats');
      expect(activePatterns).toContain('snare');

      // kick and hats should continue uninterrupted (they were already playing)
      const kickState = engine.getPatternState('kick');
      const hatsState = engine.getPatternState('hats');

      expect(kickState.phase).toBeGreaterThan(0); // Not reset
      expect(hatsState.phase).toBeGreaterThan(0); // Not reset
    });

    it('should quantize scene trigger to beat boundary', async () => {
      await createMappingFile({
        id: 'pad38-outro-beat',
        source: {
          type: 'note',
          channel: 10,
          note: 38
        },
        target: {
          type: 'scene',
          sceneId: 'outro'
        },
        quantize: 'beat' // Quantize to beat, not bar
      });

      await engine.reloadMappings();
      await engine.setScene('main');
      await engine.start();

      const sceneChanges: any[] = [];
      engine.on('scene:changed', (event) => {
        sceneChanges.push({ ...event, timestamp: performance.now() });
      });

      const triggerTime = performance.now();
      inputHandler.parseMessage([0x99, 38, 100]);

      // Wait for next beat (500ms at 120 BPM)
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(sceneChanges).toHaveLength(1);
      expect(sceneChanges[0].sceneId).toBe('outro');

      // Should happen within one beat (~500ms)
      const latency = sceneChanges[0].timestamp - triggerTime;
      expect(latency).toBeLessThan(550); // Within one beat + tolerance
    });

    it('should not trigger scene on note-off', async () => {
      await createMappingFile({
        id: 'pad39-scene',
        source: {
          type: 'note',
          channel: 10,
          note: 39
        },
        target: {
          type: 'scene',
          sceneId: 'main'
        },
        quantize: 'bar'
      });

      await engine.reloadMappings();
      await engine.setScene('intro');
      await engine.start();

      const sceneChanges: any[] = [];
      engine.on('scene:changed', (event) => sceneChanges.push(event));

      // Send note-off
      inputHandler.parseMessage([0x89, 39, 0]);

      await new Promise(resolve => setTimeout(resolve, 2100));

      // No scene change should occur
      expect(sceneChanges).toHaveLength(0);
    });
  });

  // ============================================================================
  // Acceptance Scenario 3: Smoothing
  // ============================================================================

  describe('Acceptance Scenario 3: Smoothing', () => {
    it('should smooth rapid fader changes over 30ms window', async () => {
      await createMappingFile({
        id: 'cc1-smoothed-density',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0],
          smoothing: 30 // 30ms averaging window
        }
      });

      await engine.reloadMappings();
      await engine.start();

      const parameterChanges: number[] = [];
      engine.on('pattern:parameterChanged', (event) => {
        if (event.parameter === 'density') {
          parameterChanges.push(event.value);
        }
      });

      // Simulate rapid fader movement (0 → 127 instantly)
      inputHandler.parseMessage([0xB0, 1, 0]);
      await new Promise(resolve => setTimeout(resolve, 10));

      inputHandler.parseMessage([0xB0, 1, 127]);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Value should not jump to 1.0 immediately
      expect(parameterChanges[parameterChanges.length - 1]).toBeLessThan(0.9);

      // Wait for smoothing window
      await new Promise(resolve => setTimeout(resolve, 35));

      inputHandler.parseMessage([0xB0, 1, 127]); // Send again to trigger update
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should converge to target after window
      expect(parameterChanges[parameterChanges.length - 1]).toBeCloseTo(1.0, 1);
    });

    it('should prevent abrupt value jumps with smoothing', async () => {
      await createMappingFile({
        id: 'cc74-smoothed-velocity',
        source: {
          type: 'cc',
          channel: 1,
          controller: 74
        },
        target: {
          type: 'parameter',
          patternId: 'snare',
          parameter: 'velocity'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [60, 127],
          smoothing: 30
        }
      });

      await engine.reloadMappings();
      await engine.start();

      const parameterChanges: number[] = [];
      engine.on('pattern:parameterChanged', (event) => {
        if (event.parameter === 'velocity') {
          parameterChanges.push(event.value);
        }
      });

      // Start at 60
      inputHandler.parseMessage([0xB0, 74, 0]);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Jump to 127
      inputHandler.parseMessage([0xB0, 74, 127]);
      await new Promise(resolve => setTimeout(resolve, 5));

      // Check for monotonic increase (no abrupt jumps)
      for (let i = 1; i < parameterChanges.length; i++) {
        const diff = parameterChanges[i] - parameterChanges[i - 1];
        expect(diff).toBeGreaterThanOrEqual(0); // Monotonic
        expect(diff).toBeLessThan(30); // No large jumps
      }
    });
  });

  // ============================================================================
  // Macro Expansion Tests (T066)
  // ============================================================================

  describe('Macro Expansion (One-to-Many Control)', () => {
    it('should control multiple pattern parameters with single CC via macro', async () => {
      // Create macro: density-all → kick.density, hats.density, snare.density
      await createMacroFile({
        id: 'density-all',
        targets: [
          { patternId: 'kick', parameter: 'density', scale: 1.0 },
          { patternId: 'hats', parameter: 'density', scale: 0.8 },
          { patternId: 'snare', parameter: 'density', scale: 0.6 }
        ]
      });

      // Create mapping: CC1 → macro
      await createMappingFile({
        id: 'cc1-density-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'macro',
          macroId: 'density-all'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0]
        }
      });

      await engine.reloadMacros();
      await engine.reloadMappings();
      await engine.start();

      const parameterChanges: any[] = [];
      engine.on('pattern:parameterChanged', (event) => {
        if (event.parameter === 'density') {
          parameterChanges.push(event);
        }
      });

      // Move CC1 to middle
      inputHandler.parseMessage([0xB0, 1, 64]);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should have 3 parameter changes (kick, hats, snare)
      expect(parameterChanges).toHaveLength(3);

      const kickChange = parameterChanges.find(e => e.patternId === 'kick');
      const hatsChange = parameterChanges.find(e => e.patternId === 'hats');
      const snareChange = parameterChanges.find(e => e.patternId === 'snare');

      expect(kickChange.value).toBeCloseTo(0.5, 1); // Full scale (1.0)
      expect(hatsChange.value).toBeCloseTo(0.4, 1); // 0.8 scale
      expect(snareChange.value).toBeCloseTo(0.3, 1); // 0.6 scale
    });

    it('should expand wildcard "*" to all patterns', async () => {
      await createMacroFile({
        id: 'velocity-all',
        targets: [
          { patternId: '*', parameter: 'velocity', scale: 1.0 }
        ]
      });

      await createMappingFile({
        id: 'cc7-velocity-macro',
        source: {
          type: 'cc',
          channel: 1,
          controller: 7
        },
        target: {
          type: 'macro',
          macroId: 'velocity-all'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [60, 127]
        }
      });

      await engine.reloadMacros();
      await engine.reloadMappings();
      await engine.start();

      const parameterChanges: any[] = [];
      engine.on('pattern:parameterChanged', (event) => {
        if (event.parameter === 'velocity') {
          parameterChanges.push(event);
        }
      });

      inputHandler.parseMessage([0xB0, 7, 100]);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should affect all 3 patterns (kick, hats, snare)
      expect(parameterChanges).toHaveLength(3);
      expect(parameterChanges.map(e => e.patternId).sort()).toEqual(['hats', 'kick', 'snare']);
    });
  });

  // ============================================================================
  // Dead Zone Tests (T068)
  // ============================================================================

  describe('Dead Zone Handling', () => {
    it('should ignore CC values in dead zone', async () => {
      await createMappingFile({
        id: 'cc1-deadzone-density',
        source: {
          type: 'cc',
          channel: 1,
          controller: 1
        },
        target: {
          type: 'parameter',
          patternId: 'kick',
          parameter: 'density'
        },
        transform: {
          type: 'linear',
          inputRange: [0, 127],
          outputRange: [0.0, 1.0],
          deadZone: 10 // Ignore 0-10
        }
      });

      await engine.reloadMappings();
      await engine.start();

      const parameterChanges: any[] = [];
      engine.on('pattern:parameterChanged', (event) => parameterChanges.push(event));

      // Send values in dead zone
      inputHandler.parseMessage([0xB0, 1, 0]);
      inputHandler.parseMessage([0xB0, 1, 5]);
      inputHandler.parseMessage([0xB0, 1, 10]);

      await new Promise(resolve => setTimeout(resolve, 50));

      // No parameter changes should occur
      expect(parameterChanges).toHaveLength(0);

      // Send value outside dead zone
      inputHandler.parseMessage([0xB0, 1, 11]);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Now parameter should change
      expect(parameterChanges).toHaveLength(1);
    });
  });

  // ============================================================================
  // Hot-Reload Tests
  // ============================================================================

  describe('Mapping Hot-Reload', () => {
    it('should reload mappings when mapping file changes', async () => {
      await createMappingFile({
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      });

      await engine.reloadMappings();
      await engine.start();

      // Edit mapping file (change output range)
      await createMappingFile({
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.5, 1.0] } // Changed
      });

      const reloadEvents: any[] = [];
      engine.on('mappings:reloaded', (event) => reloadEvents.push(event));

      // Wait for file watcher + hot-reload
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(reloadEvents).toHaveLength(1);

      // Test new mapping takes effect
      const parameterChanges: any[] = [];
      engine.on('pattern:parameterChanged', (event) => parameterChanges.push(event));

      inputHandler.parseMessage([0xB0, 1, 0]); // Min value
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should now map to 0.5 (not 0.0)
      expect(parameterChanges[0].value).toBeCloseTo(0.5, 2);
    });

    it('should reload mappings within <50ms', async () => {
      await createMappingFile({
        id: 'cc1-test',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      });

      await engine.reloadMappings();
      await engine.start();

      let reloadLatency: number = 0;
      engine.on('mappings:reloaded', (event) => {
        reloadLatency = event.latency;
      });

      const editStart = performance.now();

      // Edit mapping
      await createMappingFile({
        id: 'cc1-test',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'velocity' }, // Changed
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [60, 127] }
      });

      // Wait for reload
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(reloadLatency).toBeLessThan(50); // <50ms reload latency
    });
  });

  // ============================================================================
  // Circular Dependency Detection (T067)
  // ============================================================================

  describe('Circular Dependency Detection', () => {
    it('should detect and reject circular mapping dependencies', async () => {
      // Create circular dependency:
      // CC1 → macro "density-all"
      // macro "density-all" → kick.density
      // kick.density → macro "density-all" (circular!)

      await createMacroFile({
        id: 'density-all',
        targets: [{ patternId: 'kick', parameter: 'density' }]
      });

      await createMappingFile({
        id: 'cc1-macro',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'macro', macroId: 'density-all' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      });

      // This would create a circular dependency
      await createMappingFile({
        id: 'param-macro-circular',
        source: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        target: { type: 'macro', macroId: 'density-all' },
        transform: { type: 'linear', inputRange: [0.0, 1.0], outputRange: [0.0, 1.0] }
      });

      const errors: any[] = [];
      engine.on('error', (error) => errors.push(error));

      await engine.reloadMappings();

      // Should detect circular dependency
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toMatch(/circular.*dependency/i);
    });
  });
});
