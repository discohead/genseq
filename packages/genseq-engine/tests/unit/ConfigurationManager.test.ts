import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationManager } from '../../src/config/ConfigurationManager';

/**
 * T042: ConfigurationManager dual-buffer swap test
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * ConfigurationManager class does not exist yet - implementation after Red phase.
 *
 * Requirements:
 * - Atomic config swaps between active/pending buffers
 * - No partial state during swap
 * - Rollback on validation failure
 * - Thread-safe buffer management
 */

describe('ConfigurationManager - Dual-Buffer Swap', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    // MUST FAIL - ConfigurationManager doesn't exist
    configManager = new ConfigurationManager({
      validateOnSwap: true
    });
  });

  afterEach(() => {
    if (configManager) {
      configManager.dispose();
    }
  });

  it('should perform atomic swap from pending to active buffer', async () => {
    const initialConfig = {
      bpm: 120,
      ppq: 480,
      patterns: [
        { id: 'pat1', steps: 16 }
      ]
    };

    const updatedConfig = {
      bpm: 140,
      ppq: 480,
      patterns: [
        { id: 'pat1', steps: 16 },
        { id: 'pat2', steps: 8 }
      ]
    };

    // Set initial active config
    configManager.setActive(initialConfig);
    expect(configManager.getActive()).toEqual(initialConfig);

    // Load config into pending buffer
    await configManager.loadPending(updatedConfig);

    // Verify active hasn't changed yet
    expect(configManager.getActive()).toEqual(initialConfig);
    expect(configManager.getPending()).toEqual(updatedConfig);

    // Perform atomic swap
    await configManager.swap();

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(configManager.getActive()).toEqual(updatedConfig);
    expect(configManager.getActive().patterns.length).toBe(2);
  });

  it('should ensure no partial state is visible during swap', async () => {
    const initialConfig = {
      bpm: 120,
      patterns: ['a', 'b', 'c'],
      routes: ['x', 'y', 'z']
    };

    const updatedConfig = {
      bpm: 140,
      patterns: ['d', 'e', 'f'],
      routes: ['w', 'v', 'u']
    };

    configManager.setActive(initialConfig);
    await configManager.loadPending(updatedConfig);

    // Monitor config state during swap from multiple read threads
    const readThreadResults: any[] = [];
    const readThreadCount = 10;

    // Start concurrent read threads
    const readPromises = Array.from({ length: readThreadCount }, async (_, i) => {
      // Read config repeatedly during swap
      for (let j = 0; j < 20; j++) {
        const config = configManager.getActive();
        readThreadResults.push({
          threadId: i,
          iteration: j,
          config: JSON.parse(JSON.stringify(config)) // Deep clone
        });
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    });

    // Trigger swap while reads are happening
    const swapPromise = (async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      await configManager.swap();
    })();

    await Promise.all([swapPromise, ...readPromises]);

    // Verify all read states are either fully initial or fully updated
    const invalidStates = readThreadResults.filter(result => {
      const config = result.config;
      // Check for mixed state (partial update)
      const hasOldPatterns = config.patterns?.includes('a');
      const hasNewPatterns = config.patterns?.includes('d');
      const hasOldRoutes = config.routes?.includes('x');
      const hasNewRoutes = config.routes?.includes('w');

      // Invalid if has mix of old and new
      return (hasOldPatterns && hasNewPatterns) ||
             (hasOldRoutes && hasNewRoutes) ||
             (hasOldPatterns && hasNewRoutes) ||
             (hasNewPatterns && hasOldRoutes);
    });

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(invalidStates.length).toBe(0);
  });

  it('should rollback to active config on validation failure', async () => {
    const validConfig = {
      bpm: 120,
      ppq: 480,
      patterns: [{ id: 'pat1', steps: 16 }]
    };

    const invalidConfig = {
      bpm: -50, // Invalid: negative BPM
      ppq: 480,
      patterns: []
    };

    // Set valid initial config
    configManager.setActive(validConfig);

    // Set custom validator that rejects invalid BPM
    configManager.setValidator((config: any) => {
      if (config.bpm < 20 || config.bpm > 300) {
        throw new Error(`Invalid BPM: ${config.bpm}`);
      }
      return true;
    });

    // Listen for validationFailed event
    let validationFailedEvent: any = null;
    configManager.on('validationFailed', (event) => {
      validationFailedEvent = event;
    });

    // Attempt to load invalid config
    await configManager.loadPending(invalidConfig);

    // Attempt swap - should fail and rollback
    let swapError: Error | null = null;
    try {
      await configManager.swap();
    } catch (error: any) {
      swapError = error;
    }

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(swapError).not.toBeNull();
    expect(swapError?.message).toContain('Invalid BPM');

    // Verify validationFailed event was emitted with error details
    expect(validationFailedEvent).not.toBeNull();
    expect(validationFailedEvent.errors).toBeDefined();

    // Active config should remain unchanged
    expect(configManager.getActive()).toEqual(validConfig);
    expect(configManager.getActive().bpm).toBe(120);

    // Pending should be cleared or marked invalid
    expect(configManager.hasPending()).toBe(false);
  });

  it('should handle rapid successive swaps without corruption', async () => {
    const configs = Array.from({ length: 10 }, (_, i) => ({
      bpm: 120 + (i * 5),
      iteration: i,
      timestamp: Date.now()
    }));

    configManager.setActive(configs[0]);

    // Perform rapid swaps
    for (let i = 1; i < configs.length; i++) {
      await configManager.loadPending(configs[i]);
      await configManager.swap();

      // Verify active is exactly the expected config
      const active = configManager.getActive();
      expect(active.iteration).toBe(i);
      expect(active.bpm).toBe(120 + (i * 5));
    }

    // Final verification
    const finalActive = configManager.getActive();

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(finalActive.iteration).toBe(9);
    expect(finalActive.bpm).toBe(165); // 120 + (9 * 5)
  });

  it('should support conditional swap with predicate function', async () => {
    const initialConfig = { bpm: 120, measure: 1 };
    const updatedConfig = { bpm: 140, measure: 1 };

    configManager.setActive(initialConfig);
    await configManager.loadPending(updatedConfig);

    let currentMeasure = 1;

    // Swap only at measure boundaries (simulating bar-boundary constraint)
    const swapPredicate = () => {
      return currentMeasure % 4 === 0; // Swap only at 4-bar boundaries
    };

    // Attempt swap at measure 1 (should be deferred)
    const swapped1 = await configManager.swapIf(swapPredicate);
    expect(swapped1).toBe(false);
    expect(configManager.getActive().bpm).toBe(120);

    // Advance to measure 4
    currentMeasure = 4;

    // Attempt swap at measure 4 (should succeed)
    const swapped2 = await configManager.swapIf(swapPredicate);

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(swapped2).toBe(true);
    expect(configManager.getActive().bpm).toBe(140);
  });

  it('should emit events during swap lifecycle', async () => {
    const initialConfig = { bpm: 120 };
    const updatedConfig = { bpm: 140 };

    const events: Array<{ type: string; timestamp: number }> = [];

    configManager.on('beforeSwap', () => {
      events.push({ type: 'beforeSwap', timestamp: performance.now() });
    });

    configManager.on('afterSwap', () => {
      events.push({ type: 'afterSwap', timestamp: performance.now() });
    });

    configManager.on('validationFailed', () => {
      events.push({ type: 'validationFailed', timestamp: performance.now() });
    });

    configManager.setActive(initialConfig);
    await configManager.loadPending(updatedConfig);
    await configManager.swap();

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(events.length).toBe(2);
    expect(events[0].type).toBe('beforeSwap');
    expect(events[1].type).toBe('afterSwap');
    expect(events[1].timestamp).toBeGreaterThan(events[0].timestamp);
  });

  it('should protect against concurrent swap attempts', async () => {
    const config1 = { bpm: 120, id: 1 };
    const config2 = { bpm: 130, id: 2 };
    const config3 = { bpm: 140, id: 3 };

    configManager.setActive(config1);

    // Load pending and trigger first swap
    await configManager.loadPending(config2);
    const swap1Promise = configManager.swap();

    // Attempt to load new pending during active swap
    const load2Promise = configManager.loadPending(config3);

    // Wait for both operations
    await Promise.all([swap1Promise, load2Promise]);

    // First swap should complete
    // Second pending load should either wait or be queued
    const active = configManager.getActive();

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(active.id).toBeGreaterThanOrEqual(2);

    // If second load succeeded, we should be able to swap to it
    if (configManager.hasPending()) {
      await configManager.swap();
      expect(configManager.getActive().id).toBe(3);
    }
  });

  it('should preserve config object immutability after swap', async () => {
    const initialConfig = {
      bpm: 120,
      patterns: [{ id: 'pat1', steps: 16 }]
    };

    const updatedConfig = {
      bpm: 140,
      patterns: [{ id: 'pat2', steps: 8 }]
    };

    configManager.setActive(initialConfig);

    // Get reference to active config
    const activeRef1 = configManager.getActive();

    await configManager.loadPending(updatedConfig);
    await configManager.swap();

    // Get reference to new active config
    const activeRef2 = configManager.getActive();

    // Attempt to mutate old reference
    activeRef1.bpm = 999;
    activeRef1.patterns.push({ id: 'hacked', steps: 1 });

    // Current active should be unaffected
    const currentActive = configManager.getActive();

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(currentActive.bpm).toBe(140);
    expect(currentActive.patterns.length).toBe(1);
    expect(currentActive.patterns[0].id).toBe('pat2');
  });
});

describe('ConfigurationManager - Buffer State Management', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  afterEach(() => {
    configManager?.dispose();
  });

  it('should track buffer state accurately', () => {
    expect(configManager.hasActive()).toBe(false);
    expect(configManager.hasPending()).toBe(false);

    configManager.setActive({ bpm: 120 });
    expect(configManager.hasActive()).toBe(true);
    expect(configManager.hasPending()).toBe(false);

    configManager.loadPending({ bpm: 140 });

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(configManager.hasActive()).toBe(true);
    expect(configManager.hasPending()).toBe(true);
  });

  it('should clear pending buffer without affecting active', async () => {
    const activeConfig = { bpm: 120 };
    const pendingConfig = { bpm: 140 };

    configManager.setActive(activeConfig);
    await configManager.loadPending(pendingConfig);

    expect(configManager.hasPending()).toBe(true);

    configManager.clearPending();

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(configManager.hasPending()).toBe(false);
    expect(configManager.getActive()).toEqual(activeConfig);
  });

  it('should support config diff between active and pending', async () => {
    const activeConfig = {
      bpm: 120,
      ppq: 480,
      patterns: [{ id: 'pat1', steps: 16 }]
    };

    const pendingConfig = {
      bpm: 140, // Changed
      ppq: 480, // Same
      patterns: [
        { id: 'pat1', steps: 16 }, // Same
        { id: 'pat2', steps: 8 }   // Added
      ]
    };

    configManager.setActive(activeConfig);
    await configManager.loadPending(pendingConfig);

    const diff = configManager.getDiff();

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(diff.changed).toContain('bpm');
    expect(diff.changed).toContain('patterns');
    expect(diff.unchanged).toContain('ppq');
    expect(diff.added).toEqual(['patterns[1]']);
  });

  it('should support config snapshots for rollback', async () => {
    const configs = [
      { bpm: 120, version: 1 },
      { bpm: 130, version: 2 },
      { bpm: 140, version: 3 }
    ];

    // Create snapshots as we progress
    configManager.setActive(configs[0]);
    const snapshot1 = configManager.createSnapshot();

    await configManager.loadPending(configs[1]);
    await configManager.swap();
    const snapshot2 = configManager.createSnapshot();

    await configManager.loadPending(configs[2]);
    await configManager.swap();

    // Current state is version 3
    expect(configManager.getActive().version).toBe(3);

    // Restore to snapshot 2 (version 2)
    configManager.restoreSnapshot(snapshot2);

    // MUST FAIL - ConfigurationManager doesn't exist
    expect(configManager.getActive().version).toBe(2);
    expect(configManager.getActive().bpm).toBe(130);
  });
});
