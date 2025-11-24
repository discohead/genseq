import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HotReloadCoordinator } from '../../src/config/HotReloadCoordinator';
import { ConfigurationManager } from '../../src/config/ConfigurationManager';
import { FileWatcher } from '../../src/config/FileWatcher';
import { GenSeqEngine } from '../../src/GenSeqEngine';
import { Clock } from '../../src/clock/Clock';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * T046: Simultaneous file edits integration test
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * All classes do not exist yet - implementation after Red phase.
 *
 * Requirements:
 * - Handle multiple file saves within 50ms window
 * - Atomic batch application of all valid changes
 * - Partial failure handling (some valid, some invalid)
 * - Rollback invalid changes while applying valid ones
 */

describe('Simultaneous File Edits - Batch Application', () => {
  let coordinator: HotReloadCoordinator;
  let configManager: ConfigurationManager;
  let fileWatcher: FileWatcher;
  let engine: GenSeqEngine;
  let clock: Clock;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-batch-'));

    // MUST FAIL - Classes don't exist
    clock = new Clock({ bpm: 120, ppq: 480 });
    configManager = new ConfigurationManager();
    fileWatcher = new FileWatcher({ debounceMs: 30 });
    engine = new GenSeqEngine({ clock, configManager });

    coordinator = new HotReloadCoordinator({
      engine,
      configManager,
      fileWatcher,
      batchWindow: 50 // 50ms window for batching changes
    });
  });

  afterEach(async () => {
    await coordinator?.dispose();
    await fileWatcher?.dispose();
    await engine?.stop();
    clock?.stop();

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should batch multiple file saves within 50ms window into single application', async () => {
    const file1 = path.join(tempDir, 'config1.json');
    const file2 = path.join(tempDir, 'config2.json');
    const file3 = path.join(tempDir, 'config3.json');

    const initialConfigs = {
      config1: { bpm: 120 },
      config2: { patterns: [{ id: 'p1', steps: 16 }] },
      config3: { routes: [{ from: 'p1', to: 'out1' }] }
    };

    const updatedConfigs = {
      config1: { bpm: 140 },
      config2: { patterns: [{ id: 'p1', steps: 16 }, { id: 'p2', steps: 8 }] },
      config3: { routes: [{ from: 'p1', to: 'out1' }, { from: 'p2', to: 'out2' }] }
    };

    // Write initial configs
    await fs.writeFile(file1, JSON.stringify(initialConfigs.config1));
    await fs.writeFile(file2, JSON.stringify(initialConfigs.config2));
    await fs.writeFile(file3, JSON.stringify(initialConfigs.config3));

    await coordinator.watchProject(tempDir);

    const batchApplications: number[] = [];

    coordinator.on('batchApplied', () => {
      batchApplications.push(performance.now());
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simultaneous edits within 50ms window
    const editPromises = [
      fs.writeFile(file1, JSON.stringify(updatedConfigs.config1)),
      new Promise(r => setTimeout(r, 10)).then(() =>
        fs.writeFile(file2, JSON.stringify(updatedConfigs.config2))
      ),
      new Promise(r => setTimeout(r, 20)).then(() =>
        fs.writeFile(file3, JSON.stringify(updatedConfigs.config3))
      )
    ];

    await Promise.all(editPromises);

    // Wait for batch processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // MUST FAIL - Classes don't exist
    // Should have batched into single application
    expect(batchApplications.length).toBe(1);

    // All configs should be updated
    const finalConfig = engine.getActiveConfig();
    expect(finalConfig.bpm).toBe(140);
    expect(finalConfig.patterns.length).toBe(2);
    expect(finalConfig.routes.length).toBe(2);
  });

  it('should apply valid changes and reject invalid ones in mixed batch', async () => {
    const file1 = path.join(tempDir, 'valid1.json');
    const file2 = path.join(tempDir, 'invalid.json');
    const file3 = path.join(tempDir, 'valid2.json');

    const initialState = {
      bpm: 120,
      patterns: [{ id: 'p1', steps: 16 }],
      routes: []
    };

    const validUpdate1 = { bpm: 140 };
    const invalidUpdate = { bpm: -50 }; // Invalid: negative BPM
    const validUpdate2 = { patterns: [{ id: 'p1', steps: 16 }, { id: 'p2', steps: 8 }] };

    await fs.writeFile(file1, JSON.stringify(validUpdate1));
    await fs.writeFile(file2, JSON.stringify(invalidUpdate));
    await fs.writeFile(file3, JSON.stringify(validUpdate2));

    // Set initial state
    await coordinator.loadConfig(file1);

    const validationErrors: any[] = [];
    const appliedChanges: string[] = [];

    coordinator.on('validationFailed', (error: any) => {
      validationErrors.push(error);
    });

    coordinator.on('changeApplied', (filePath: string) => {
      appliedChanges.push(path.basename(filePath));
    });

    await coordinator.watchProject(tempDir);
    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simultaneous edits (2 valid, 1 invalid)
    await Promise.all([
      fs.writeFile(file1, JSON.stringify({ bpm: 150 })), // Valid
      new Promise(r => setTimeout(r, 10)).then(() =>
        fs.writeFile(file2, JSON.stringify(invalidUpdate)) // Invalid
      ),
      new Promise(r => setTimeout(r, 20)).then(() =>
        fs.writeFile(file3, JSON.stringify(validUpdate2)) // Valid
      )
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    // MUST FAIL - Classes don't exist
    // Should have 1 validation error for invalid file
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].file).toContain('invalid.json');

    // Should have applied 2 valid changes
    expect(appliedChanges).toContain('valid1.json');
    expect(appliedChanges).toContain('valid2.json');
    expect(appliedChanges).not.toContain('invalid.json');

    // Final config should have valid changes only
    const finalConfig = engine.getActiveConfig();
    expect(finalConfig.bpm).toBe(150); // Valid update applied
    expect(finalConfig.patterns.length).toBe(2); // Valid update applied
  });

  it('should handle dependency order in simultaneous edits', async () => {
    const patternsFile = path.join(tempDir, 'patterns.json');
    const routesFile = path.join(tempDir, 'routes.json');

    const initialPatterns = {
      patterns: [{ id: 'p1', steps: 16 }]
    };

    const initialRoutes = {
      routes: [{ from: 'p1', to: 'out1' }]
    };

    const updatedPatterns = {
      patterns: [
        { id: 'p1', steps: 16 },
        { id: 'p2', steps: 8 }
      ]
    };

    const updatedRoutes = {
      routes: [
        { from: 'p1', to: 'out1' },
        { from: 'p2', to: 'out2' } // References new pattern p2
      ]
    };

    await fs.writeFile(patternsFile, JSON.stringify(initialPatterns));
    await fs.writeFile(routesFile, JSON.stringify(initialRoutes));

    await coordinator.watchProject(tempDir);
    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Edit both files simultaneously
    // Routes reference pattern that's being added in same batch
    await Promise.all([
      fs.writeFile(patternsFile, JSON.stringify(updatedPatterns)),
      new Promise(r => setTimeout(r, 10)).then(() =>
        fs.writeFile(routesFile, JSON.stringify(updatedRoutes))
      )
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    const finalConfig = engine.getActiveConfig();

    // MUST FAIL - Classes don't exist
    // Should apply in correct dependency order (patterns before routes)
    expect(finalConfig.patterns.length).toBe(2);
    expect(finalConfig.routes.length).toBe(2);
    expect(finalConfig.routes[1].from).toBe('p2'); // Route to new pattern exists
  });

  it('should rollback entire batch if any change causes system instability', async () => {
    const file1 = path.join(tempDir, 'change1.json');
    const file2 = path.join(tempDir, 'breaking-change.json');
    const file3 = path.join(tempDir, 'change3.json');

    const initialConfig = {
      bpm: 120,
      patterns: [{ id: 'p1', steps: 16 }],
      activePatterns: ['p1']
    };

    const update1 = { bpm: 140 };
    const breakingUpdate = {
      patterns: [] // Remove all patterns while some are active
    };
    const update3 = { activePatterns: ['p1', 'p2'] };

    await fs.writeFile(file1, JSON.stringify(update1));
    await fs.writeFile(file2, JSON.stringify(breakingUpdate));
    await fs.writeFile(file3, JSON.stringify(update3));

    configManager.setActive(initialConfig);
    await coordinator.watchProject(tempDir);

    const rollbackEvents: number[] = [];

    coordinator.on('batchRollback', () => {
      rollbackEvents.push(performance.now());
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simultaneous edits that would cause instability
    await Promise.all([
      fs.writeFile(file1, JSON.stringify(update1)),
      new Promise(r => setTimeout(r, 10)).then(() =>
        fs.writeFile(file2, JSON.stringify(breakingUpdate))
      ),
      new Promise(r => setTimeout(r, 20)).then(() =>
        fs.writeFile(file3, JSON.stringify(update3))
      )
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    // MUST FAIL - Classes don't exist
    // Should have rolled back entire batch
    expect(rollbackEvents.length).toBeGreaterThan(0);

    // Config should remain at initial state
    const finalConfig = engine.getActiveConfig();
    expect(finalConfig.bpm).toBe(120); // Not updated
    expect(finalConfig.patterns.length).toBe(1); // Not removed
    expect(finalConfig.activePatterns).toEqual(['p1']); // Not updated
  });

  it('should handle rapid successive batch windows', async () => {
    const configFile = path.join(tempDir, 'rapid.json');

    await fs.writeFile(configFile, JSON.stringify({ version: 0 }));
    await coordinator.watchProject(tempDir);

    const batchApplications: number[] = [];

    coordinator.on('batchApplied', () => {
      batchApplications.push(performance.now());
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create 3 separate batch windows with edits
    // Batch 1: versions 1-3 (within 50ms)
    await fs.writeFile(configFile, JSON.stringify({ version: 1 }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(configFile, JSON.stringify({ version: 2 }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(configFile, JSON.stringify({ version: 3 }));

    // Wait for batch 1 to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Batch 2: versions 4-6
    await fs.writeFile(configFile, JSON.stringify({ version: 4 }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(configFile, JSON.stringify({ version: 5 }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(configFile, JSON.stringify({ version: 6 }));

    // Wait for batch 2
    await new Promise(resolve => setTimeout(resolve, 100));

    // Batch 3: versions 7-9
    await fs.writeFile(configFile, JSON.stringify({ version: 7 }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(configFile, JSON.stringify({ version: 8 }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(configFile, JSON.stringify({ version: 9 }));

    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - Classes don't exist
    // Should have 3 batch applications
    expect(batchApplications.length).toBe(3);

    // Final version should be 9
    const finalConfig = engine.getActiveConfig();
    expect(finalConfig.version).toBe(9);
  });

  it('should provide detailed batch summary after application', async () => {
    const file1 = path.join(tempDir, 'file1.json');
    const file2 = path.join(tempDir, 'file2.json');
    const file3 = path.join(tempDir, 'file3.json');

    await fs.writeFile(file1, JSON.stringify({ data: 'a' }));
    await fs.writeFile(file2, JSON.stringify({ data: 'b' }));
    await fs.writeFile(file3, JSON.stringify({ data: 'c' }));

    await coordinator.watchProject(tempDir);

    let batchSummary: any = null;

    coordinator.on('batchApplied', (summary: any) => {
      batchSummary = summary;
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simultaneous edits
    await Promise.all([
      fs.writeFile(file1, JSON.stringify({ data: 'a-updated' })),
      new Promise(r => setTimeout(r, 10)).then(() =>
        fs.writeFile(file2, JSON.stringify({ data: 'b-updated' }))
      ),
      new Promise(r => setTimeout(r, 20)).then(() =>
        fs.writeFile(file3, JSON.stringify({ data: 'c-updated' }))
      )
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    // MUST FAIL - Classes don't exist
    expect(batchSummary).not.toBeNull();
    expect(batchSummary.filesChanged).toBe(3);
    expect(batchSummary.validChanges).toBe(3);
    expect(batchSummary.invalidChanges).toBe(0);
    expect(batchSummary.changedFiles).toContain('file1.json');
    expect(batchSummary.changedFiles).toContain('file2.json');
    expect(batchSummary.changedFiles).toContain('file3.json');
  });

  it('should handle file deletion in batch with other edits', async () => {
    const file1 = path.join(tempDir, 'keep.json');
    const file2 = path.join(tempDir, 'delete.json');
    const file3 = path.join(tempDir, 'update.json');

    await fs.writeFile(file1, JSON.stringify({ name: 'keep' }));
    await fs.writeFile(file2, JSON.stringify({ name: 'delete' }));
    await fs.writeFile(file3, JSON.stringify({ name: 'update' }));

    await coordinator.watchProject(tempDir);

    const batchEvents: any[] = [];

    coordinator.on('batchApplied', (summary: any) => {
      batchEvents.push(summary);
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Batch with deletion and updates
    await Promise.all([
      fs.writeFile(file1, JSON.stringify({ name: 'keep-updated' })),
      new Promise(r => setTimeout(r, 10)).then(() => fs.unlink(file2)),
      new Promise(r => setTimeout(r, 20)).then(() =>
        fs.writeFile(file3, JSON.stringify({ name: 'update-updated' }))
      )
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    // MUST FAIL - Classes don't exist
    expect(batchEvents.length).toBe(1);
    expect(batchEvents[0].filesDeleted).toBe(1);
    expect(batchEvents[0].filesUpdated).toBe(2);
  });

  it('should prioritize critical file changes in batch', async () => {
    const globalConfig = path.join(tempDir, 'global.json'); // Critical
    const pattern1 = path.join(tempDir, 'pattern1.json');
    const pattern2 = path.join(tempDir, 'pattern2.json');

    await fs.writeFile(globalConfig, JSON.stringify({ bpm: 120, critical: true }));
    await fs.writeFile(pattern1, JSON.stringify({ id: 'p1' }));
    await fs.writeFile(pattern2, JSON.stringify({ id: 'p2' }));

    coordinator.setPriority(globalConfig, 'critical');

    await coordinator.watchProject(tempDir);

    const applicationOrder: string[] = [];

    coordinator.on('fileApplied', (filePath: string) => {
      applicationOrder.push(path.basename(filePath));
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simultaneous edits
    await Promise.all([
      fs.writeFile(pattern1, JSON.stringify({ id: 'p1', updated: true })),
      new Promise(r => setTimeout(r, 10)).then(() =>
        fs.writeFile(globalConfig, JSON.stringify({ bpm: 140, critical: true }))
      ),
      new Promise(r => setTimeout(r, 20)).then(() =>
        fs.writeFile(pattern2, JSON.stringify({ id: 'p2', updated: true }))
      )
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    // MUST FAIL - Classes don't exist
    // Critical file should be applied first despite being edited later
    expect(applicationOrder[0]).toBe('global.json');
  });

  it('should handle circular dependencies in simultaneous edits', async () => {
    const fileA = path.join(tempDir, 'a.json');
    const fileB = path.join(tempDir, 'b.json');

    // A references B, B references A (circular)
    const configA = { id: 'a', references: ['b'] };
    const configB = { id: 'b', references: ['a'] };

    await fs.writeFile(fileA, JSON.stringify(configA));
    await fs.writeFile(fileB, JSON.stringify(configB));

    await coordinator.watchProject(tempDir);

    const errors: any[] = [];

    coordinator.on('circularDependencyDetected', (error: any) => {
      errors.push(error);
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update both simultaneously
    configA.references = ['b', 'c'];
    configB.references = ['a', 'd'];

    await Promise.all([
      fs.writeFile(fileA, JSON.stringify(configA)),
      new Promise(r => setTimeout(r, 10)).then(() =>
        fs.writeFile(fileB, JSON.stringify(configB))
      )
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    // MUST FAIL - Classes don't exist
    // Should detect circular dependency
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].files).toContain('a.json');
    expect(errors[0].files).toContain('b.json');
  });

  it('should measure batch processing performance', async () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      path.join(tempDir, `file${i}.json`)
    );

    // Create 10 files
    for (const file of files) {
      await fs.writeFile(file, JSON.stringify({ value: 0 }));
    }

    await coordinator.watchProject(tempDir);

    let batchProcessingTime = 0;

    coordinator.on('batchApplied', (summary: any) => {
      batchProcessingTime = summary.processingTime;
    });

    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Edit all 10 files simultaneously
    await Promise.all(
      files.map((file, i) =>
        new Promise(r => setTimeout(r, i * 5)).then(() =>
          fs.writeFile(file, JSON.stringify({ value: i + 1 }))
        )
      )
    );

    await new Promise(resolve => setTimeout(resolve, 300));

    // MUST FAIL - Classes don't exist
    // Batch processing should complete efficiently
    expect(batchProcessingTime).toBeLessThan(100); // <100ms for 10 files
    expect(batchProcessingTime).toBeGreaterThan(0);
  });
});
