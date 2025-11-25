import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * T013: End-to-end type swap integration test (RED PHASE - MUST FAIL)
 *
 * Tests complete workflow for pattern type hot-reload:
 * 1. Start engine with pattern playing
 * 2. Edit pattern file to change type
 * 3. Verify type swap occurs at cycle boundary
 * 4. Verify transport continues without interruption
 * 5. Verify swap completes within 50ms
 *
 * This is the comprehensive integration test that validates User Story 1.
 * This test file MUST be created before integration implementation exists.
 */

describe('Type Swap Integration - End to End', () => {
  let engine: GenSeqEngine;
  let tempDir: string;
  let projectPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-integration-'));
    projectPath = path.join(tempDir, 'project.yaml');

    // Create directories
    await fs.mkdir(path.join(tempDir, 'patterns'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'routes'), { recursive: true });

    // Create clock.yaml for all tests
    await fs.writeFile(
      path.join(tempDir, 'clock.yaml'),
      `bpm: 120
ppq: 96
`
    );
  });

  afterEach(async () => {
    if (engine) {
      await engine.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('User Story 1: Live Type Experimentation', () => {
    it('should swap pattern type from euclidean to probability during playback', async () => {
      // Create initial project with Euclidean pattern
      const patternPath = path.join(tempDir, 'patterns', 'kick.yaml');
      await fs.writeFile(
        patternPath,
        `id: kick
name: Kick
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
  rotation: 0
  velocity: 100
  gateLength: 0.25
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      // Initialize and start engine
      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      let typeSwapScheduledEvent: any = null;
      let typeSwapCompleteEvent: any = null;

      engine.on('typeSwapScheduled', (event) => {
        typeSwapScheduledEvent = event;
      });

      engine.on('typeSwapComplete', (event) => {
        typeSwapCompleteEvent = event;
      });

      await engine.start();

      // Wait for initial playback
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Edit pattern file to change type to probability
      await fs.writeFile(
        patternPath,
        `id: kick
name: Kick
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
  velocity: 100
  gateLength: 0.25
`
      );

      // Wait for file watch debounce + cycle boundary
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify type swap was scheduled
      expect(typeSwapScheduledEvent).toBeDefined();
      expect(typeSwapScheduledEvent.patternId).toBe('kick');
      expect(typeSwapScheduledEvent.fromType).toBe('euclidean');
      expect(typeSwapScheduledEvent.toType).toBe('probability');

      // Verify type swap completed
      expect(typeSwapCompleteEvent).toBeDefined();
      expect(typeSwapCompleteEvent.patternId).toBe('kick');
      expect(typeSwapCompleteEvent.toType).toBe('probability');
      expect(typeSwapCompleteEvent.latency).toBeLessThan(50); // <50ms requirement
    });

    it('should swap pattern type from probability to phase during playback', async () => {
      // Create initial project with Probability pattern
      const patternPath = path.join(tempDir, 'patterns', 'hats.yaml');
      await fs.writeFile(
        patternPath,
        `id: hats
name: Hats
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
  velocity: 80
  gateLength: 0.1
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      let typeSwapCompleteEvent: any = null;
      engine.on('typeSwapComplete', (event) => {
        typeSwapCompleteEvent = event;
      });

      await engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Change to phase type
      await fs.writeFile(
        patternPath,
        `id: hats
name: Hats
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 1.5
  phaseOffset: 0.25
  velocity: 90
  gateLength: 0.5
`
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(typeSwapCompleteEvent).toBeDefined();
      expect(typeSwapCompleteEvent.fromType).toBe('probability');
      expect(typeSwapCompleteEvent.toType).toBe('phase');
    });

    it('should swap pattern type from phase to euclidean during playback', async () => {
      const patternPath = path.join(tempDir, 'patterns', 'bass.yaml');
      await fs.writeFile(
        patternPath,
        `id: bass
name: Bass
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 2.0
  phaseOffset: 0.5
  velocity: 90
  gateLength: 0.5
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'synth.yaml'),
        `id: synth
name: Synth
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      let typeSwapCompleteEvent: any = null;
      engine.on('typeSwapComplete', (event) => {
        typeSwapCompleteEvent = event;
      });

      await engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Change to euclidean type
      await fs.writeFile(
        patternPath,
        `id: bass
name: Bass
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
  rotation: 0
  velocity: 100
  gateLength: 0.25
`
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(typeSwapCompleteEvent).toBeDefined();
      expect(typeSwapCompleteEvent.fromType).toBe('phase');
      expect(typeSwapCompleteEvent.toType).toBe('euclidean');
    });

    it('should continue transport without interruption during type swap', async () => {
      const patternPath = path.join(tempDir, 'patterns', 'pattern1.yaml');
      await fs.writeFile(
        patternPath,
        `id: pattern1
name: Pattern1
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
  rotation: 0
  velocity: 100
  gateLength: 0.25
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      const ticksBefore: number[] = [];
      const ticksAfter: number[] = [];
      let swapOccurred = false;

      engine.on('tick', (tick: number) => {
        if (swapOccurred) {
          ticksAfter.push(tick);
        } else {
          ticksBefore.push(tick);
        }
      });

      engine.on('typeSwapComplete', () => {
        swapOccurred = true;
      });

      await engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Change type
      await fs.writeFile(
        patternPath,
        `id: pattern1
name: Pattern1
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
  velocity: 100
  gateLength: 0.25
`
      );

      await new Promise((resolve) => setTimeout(resolve, 600));

      // Verify ticks continued uninterrupted
      expect(ticksBefore.length).toBeGreaterThan(0);
      expect(ticksAfter.length).toBeGreaterThan(0);

      // Check tick sequence is continuous (no gaps)
      const allTicks = [...ticksBefore, ...ticksAfter];
      for (let i = 1; i < allTicks.length; i++) {
        expect(allTicks[i]).toBeGreaterThan(allTicks[i - 1]);
      }
    });

    it('should handle multiple consecutive type swaps', async () => {
      const patternPath = path.join(tempDir, 'patterns', 'multi.yaml');
      await fs.writeFile(
        patternPath,
        `id: multi
name: Multi
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
  rotation: 0
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      const typeSwapEvents: any[] = [];
      engine.on('typeSwapComplete', (event) => {
        typeSwapEvents.push(event);
      });

      await engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First swap: euclidean → probability
      await fs.writeFile(
        patternPath,
        `id: multi
name: Multi
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
`
      );

      await new Promise((resolve) => setTimeout(resolve, 600));

      // Second swap: probability → phase
      await fs.writeFile(
        patternPath,
        `id: multi
name: Multi
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 1.5
  phaseOffset: 0.25
`
      );

      await new Promise((resolve) => setTimeout(resolve, 600));

      // Third swap: phase → euclidean
      await fs.writeFile(
        patternPath,
        `id: multi
name: Multi
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 8
  pulses: 3
`
      );

      await new Promise((resolve) => setTimeout(resolve, 600));

      // Verify all three swaps occurred
      expect(typeSwapEvents.length).toBe(3);
      expect(typeSwapEvents[0].toType).toBe('probability');
      expect(typeSwapEvents[1].toType).toBe('phase');
      expect(typeSwapEvents[2].toType).toBe('euclidean');
    });
  });

  describe('GenSeqEngine integration', () => {
    it('should wire PatternFileWatcher type change events to PatternExecutor', async () => {
      const patternPath = path.join(tempDir, 'patterns', 'wired.yaml');
      await fs.writeFile(
        patternPath,
        `id: wired
name: Wired
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      // This method doesn't exist yet - test MUST FAIL
      const handlePatternTypeChange = (engine as any).handlePatternTypeChange;
      expect(handlePatternTypeChange).toBeDefined();
      expect(typeof handlePatternTypeChange).toBe('function');
    });

    it('should track initial pattern types in GenSeqEngine', async () => {
      const pattern1Path = path.join(tempDir, 'patterns', 'pattern1.yaml');
      const pattern2Path = path.join(tempDir, 'patterns', 'pattern2.yaml');

      await fs.writeFile(
        pattern1Path,
        `id: pattern1
name: Pattern1
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      await fs.writeFile(
        pattern2Path,
        `id: pattern2
name: Pattern2
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      // Verify initial types are tracked
      const initialTypes = (engine as any).initialPatternTypes;
      expect(initialTypes).toBeDefined();
      expect(initialTypes.get('pattern1')).toBe('euclidean');
      expect(initialTypes.get('pattern2')).toBe('probability');
    });

    it('should route type changes to scheduleTypeSwap instead of reloadPattern', async () => {
      const patternPath = path.join(tempDir, 'patterns', 'routed.yaml');
      await fs.writeFile(
        patternPath,
        `id: routed
name: Routed
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      let typeSwapScheduledCalled = false;
      engine.on('typeSwapScheduled', () => {
        typeSwapScheduledCalled = true;
      });

      await engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Change type
      await fs.writeFile(
        patternPath,
        `id: routed
name: Routed
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
`
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify type swap was called (not parameter reload)
      expect(typeSwapScheduledCalled).toBe(true);
    });
  });

  describe('performance validation', () => {
    it('should complete type swap within 50ms', async () => {
      const patternPath = path.join(tempDir, 'patterns', 'perf.yaml');
      await fs.writeFile(
        patternPath,
        `id: perf
name: Perf
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      const swapLatencies: number[] = [];
      engine.on('typeSwapComplete', (event) => {
        swapLatencies.push(event.latency);
      });

      await engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Change type
      await fs.writeFile(
        patternPath,
        `id: perf
name: Perf
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
`
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(swapLatencies.length).toBe(1);
      expect(swapLatencies[0]).toBeLessThan(50); // <50ms requirement
    });

    it('should complete all type combinations within 50ms', async () => {
      const patternPath = path.join(tempDir, 'patterns', 'allcombos.yaml');
      await fs.writeFile(
        patternPath,
        `id: allcombos
name: Allcombos
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 16
  pulses: 4
`
      );

      await fs.writeFile(
        path.join(tempDir, 'routes', 'drums.yaml'),
        `id: drums
name: Drums
midiOutput: IAC Driver Bus 1
enabled: true
`
      );

      await fs.writeFile(
        projectPath,
        `name: Integration Test
bpm: 120
ppq: 96
patternsPath: ${path.join(tempDir, 'patterns')}
routesPath: ${path.join(tempDir, 'routes')}
`
      );

      engine = new GenSeqEngine();
      await engine.initialize();
      await engine.loadProject(tempDir);

      const swapLatencies: number[] = [];
      engine.on('typeSwapComplete', (event) => {
        swapLatencies.push(event.latency);
      });

      await engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // euclidean → probability
      await fs.writeFile(
        patternPath,
        `id: allcombos
name: Allcombos
type: probability
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  probability: 0.75
  density: 0.8
`
      );

      await new Promise((resolve) => setTimeout(resolve, 600));

      // probability → phase
      await fs.writeFile(
        patternPath,
        `id: allcombos
name: Allcombos
type: phase
bus: synth
enabled: true
length: 1
division: 16
channel: 1
parameters:
  phaseRate: 1.5
  phaseOffset: 0.25
`
      );

      await new Promise((resolve) => setTimeout(resolve, 600));

      // phase → euclidean
      await fs.writeFile(
        patternPath,
        `id: allcombos
name: Allcombos
type: euclidean
bus: drums
enabled: true
length: 1
division: 16
channel: 10
parameters:
  steps: 8
  pulses: 3
`
      );

      await new Promise((resolve) => setTimeout(resolve, 600));

      // All swaps should be <50ms
      expect(swapLatencies.length).toBe(3);
      for (const latency of swapLatencies) {
        expect(latency).toBeLessThan(50);
      }
    });
  });
});
