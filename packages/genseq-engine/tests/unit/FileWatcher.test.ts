import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWatcher } from '../../src/config/FileWatcher';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * T043: FileWatcher debouncing test
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * FileWatcher class does not exist yet - implementation after Red phase.
 *
 * Requirements:
 * - 30ms debounce window for rapid file saves
 * - Multiple file type support (JSON, YAML, YML)
 * - Accurate file change detection
 * - Resource cleanup on dispose
 */

describe('FileWatcher - Debouncing', () => {
  let fileWatcher: FileWatcher;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));

    // MUST FAIL - FileWatcher doesn't exist
    fileWatcher = new FileWatcher({
      debounceMs: 30
    });
  });

  afterEach(async () => {
    if (fileWatcher) {
      await fileWatcher.dispose();
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should debounce rapid file saves to single event within 30ms window', async () => {
    const testFile = path.join(tempDir, 'debounce.json');
    await fs.writeFile(testFile, JSON.stringify({ value: 0 }));

    const changeEvents: Array<{ path: string; timestamp: number }> = [];

    fileWatcher.on('change', (filePath: string) => {
      changeEvents.push({
        path: filePath,
        timestamp: performance.now()
      });
    });

    await fileWatcher.watch(testFile);

    // Wait for initial watch setup
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate rapid saves (10 saves within 20ms)
    const startTime = performance.now();
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(testFile, JSON.stringify({ value: i }));
      await new Promise(resolve => setTimeout(resolve, 2));
    }

    // Wait for debounce window to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    // Should have collapsed 10 rapid changes into 1-2 events
    expect(changeEvents.length).toBeLessThan(3);
    expect(changeEvents.length).toBeGreaterThan(0);

    // Verify debounce timing
    if (changeEvents.length > 1) {
      const timeBetweenEvents = changeEvents[1].timestamp - changeEvents[0].timestamp;
      expect(timeBetweenEvents).toBeGreaterThanOrEqual(30);
    }
  });

  it('should separate independent file saves outside debounce window', async () => {
    const testFile = path.join(tempDir, 'separate-saves.json');
    await fs.writeFile(testFile, JSON.stringify({ value: 0 }));

    const changeEvents: number[] = [];

    fileWatcher.on('change', () => {
      changeEvents.push(Date.now());
    });

    await fileWatcher.watch(testFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    // First save
    await fs.writeFile(testFile, JSON.stringify({ value: 1 }));

    // Wait longer than debounce window
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second save (should be separate event)
    await fs.writeFile(testFile, JSON.stringify({ value: 2 }));

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(changeEvents.length).toBe(2);
  });

  it('should handle custom debounce duration', async () => {
    // Create watcher with 100ms debounce
    const customWatcher = new FileWatcher({ debounceMs: 100 });

    const testFile = path.join(tempDir, 'custom-debounce.json');
    await fs.writeFile(testFile, JSON.stringify({ value: 0 }));

    const changeEvents: number[] = [];

    customWatcher.on('change', () => {
      changeEvents.push(performance.now());
    });

    await customWatcher.watch(testFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Rapid saves
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(testFile, JSON.stringify({ value: i }));
      await new Promise(resolve => setTimeout(resolve, 15));
    }

    // Wait shorter than custom debounce (50ms < 100ms)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should not have fired yet
    expect(changeEvents.length).toBe(0);

    // Wait for full debounce window
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(changeEvents.length).toBe(1);

    await customWatcher.dispose();
  });

  it('should restart debounce timer on each file change', async () => {
    const testFile = path.join(tempDir, 'restart-timer.json');
    await fs.writeFile(testFile, JSON.stringify({ value: 0 }));

    const changeEvents: number[] = [];

    fileWatcher.on('change', () => {
      changeEvents.push(performance.now());
    });

    await fileWatcher.watch(testFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Save every 20ms for 100ms (5 saves)
    // Each save should restart the 30ms timer
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(testFile, JSON.stringify({ value: i }));
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    // Timer should fire ~30ms after last save
    await new Promise(resolve => setTimeout(resolve, 60));

    // MUST FAIL - FileWatcher doesn't exist
    expect(changeEvents.length).toBe(1);
  });

  it('should handle debounce across multiple watched files independently', async () => {
    const file1 = path.join(tempDir, 'file1.json');
    const file2 = path.join(tempDir, 'file2.json');

    await fs.writeFile(file1, JSON.stringify({ id: 1 }));
    await fs.writeFile(file2, JSON.stringify({ id: 2 }));

    const file1Events: number[] = [];
    const file2Events: number[] = [];

    fileWatcher.on('change', (filePath: string) => {
      if (filePath.includes('file1')) {
        file1Events.push(performance.now());
      } else if (filePath.includes('file2')) {
        file2Events.push(performance.now());
      }
    });

    await fileWatcher.watch(file1);
    await fileWatcher.watch(file2);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Rapid saves to file1
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(file1, JSON.stringify({ id: 1, value: i }));
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // Single save to file2
    await fs.writeFile(file2, JSON.stringify({ id: 2, value: 1 }));

    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(file1Events.length).toBe(1); // Debounced to 1 event
    expect(file2Events.length).toBe(1); // Single event
  });

  it('should not debounce across different file paths', async () => {
    const file1 = path.join(tempDir, 'path1.json');
    const file2 = path.join(tempDir, 'path2.json');

    await fs.writeFile(file1, '{}');
    await fs.writeFile(file2, '{}');

    const allEvents: string[] = [];

    fileWatcher.on('change', (filePath: string) => {
      allEvents.push(path.basename(filePath));
    });

    await fileWatcher.watch(file1);
    await fileWatcher.watch(file2);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Interleaved rapid saves
    await fs.writeFile(file1, '{"a":1}');
    await new Promise(resolve => setTimeout(resolve, 5));
    await fs.writeFile(file2, '{"b":1}');
    await new Promise(resolve => setTimeout(resolve, 5));
    await fs.writeFile(file1, '{"a":2}');
    await new Promise(resolve => setTimeout(resolve, 5));
    await fs.writeFile(file2, '{"b":2}');

    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    // Each file should generate 1 debounced event
    const file1EventCount = allEvents.filter(f => f === 'path1.json').length;
    const file2EventCount = allEvents.filter(f => f === 'path2.json').length;

    expect(file1EventCount).toBe(1);
    expect(file2EventCount).toBe(1);
  });
});

describe('FileWatcher - File Change Detection', () => {
  let fileWatcher: FileWatcher;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));
    fileWatcher = new FileWatcher({ debounceMs: 30 });
  });

  afterEach(async () => {
    await fileWatcher?.dispose();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should detect JSON file changes', async () => {
    const jsonFile = path.join(tempDir, 'config.json');
    await fs.writeFile(jsonFile, JSON.stringify({ version: 1 }));

    let changeDetected = false;

    fileWatcher.on('change', () => {
      changeDetected = true;
    });

    await fileWatcher.watch(jsonFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    await fs.writeFile(jsonFile, JSON.stringify({ version: 2 }));
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(changeDetected).toBe(true);
  });

  it('should detect YAML file changes', async () => {
    const yamlFile = path.join(tempDir, 'config.yaml');
    await fs.writeFile(yamlFile, 'version: 1\n');

    let changeDetected = false;

    fileWatcher.on('change', (filePath: string) => {
      if (filePath.endsWith('.yaml')) {
        changeDetected = true;
      }
    });

    await fileWatcher.watch(yamlFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    await fs.writeFile(yamlFile, 'version: 2\n');
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(changeDetected).toBe(true);
  });

  it('should detect YML file changes', async () => {
    const ymlFile = path.join(tempDir, 'config.yml');
    await fs.writeFile(ymlFile, 'version: 1\n');

    let changeDetected = false;

    fileWatcher.on('change', (filePath: string) => {
      if (filePath.endsWith('.yml')) {
        changeDetected = true;
      }
    });

    await fileWatcher.watch(ymlFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    await fs.writeFile(ymlFile, 'version: 2\n');
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(changeDetected).toBe(true);
  });

  it('should handle file deletion', async () => {
    const testFile = path.join(tempDir, 'delete-me.json');
    await fs.writeFile(testFile, '{}');

    const events: Array<{ type: string; path: string }> = [];

    fileWatcher.on('change', (filePath: string) => {
      events.push({ type: 'change', path: filePath });
    });

    fileWatcher.on('unlink', (filePath: string) => {
      events.push({ type: 'unlink', path: filePath });
    });

    await fileWatcher.watch(testFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    await fs.unlink(testFile);
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    const unlinkEvents = events.filter(e => e.type === 'unlink');
    expect(unlinkEvents.length).toBeGreaterThan(0);
  });

  it('should handle file recreation after deletion', async () => {
    const testFile = path.join(tempDir, 'recreate.json');
    await fs.writeFile(testFile, JSON.stringify({ state: 'initial' }));

    const events: string[] = [];

    fileWatcher.on('change', () => events.push('change'));
    fileWatcher.on('unlink', () => events.push('unlink'));
    fileWatcher.on('add', () => events.push('add'));

    await fileWatcher.watch(testFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Delete file
    await fs.unlink(testFile);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Recreate file
    await fs.writeFile(testFile, JSON.stringify({ state: 'recreated' }));
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(events).toContain('unlink');
    expect(events).toContain('add');
  });

  it('should ignore changes to non-watched files in same directory', async () => {
    const watchedFile = path.join(tempDir, 'watched.json');
    const ignoredFile = path.join(tempDir, 'ignored.json');

    await fs.writeFile(watchedFile, '{}');
    await fs.writeFile(ignoredFile, '{}');

    const changeEvents: string[] = [];

    fileWatcher.on('change', (filePath: string) => {
      changeEvents.push(path.basename(filePath));
    });

    // Only watch one file
    await fileWatcher.watch(watchedFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Modify both files
    await fs.writeFile(watchedFile, '{"watched":true}');
    await fs.writeFile(ignoredFile, '{"ignored":true}');

    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(changeEvents).toContain('watched.json');
    expect(changeEvents).not.toContain('ignored.json');
  });

  it('should provide file stats with change events', async () => {
    const testFile = path.join(tempDir, 'stats.json');
    await fs.writeFile(testFile, '{}');

    let statsReceived: any = null;

    fileWatcher.on('change', (filePath: string, stats: any) => {
      statsReceived = stats;
    });

    await fileWatcher.watch(testFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    await fs.writeFile(testFile, '{"modified":true}');
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(statsReceived).not.toBeNull();
    expect(statsReceived).toHaveProperty('size');
    expect(statsReceived).toHaveProperty('mtime');
  });
});

describe('FileWatcher - Resource Management', () => {
  let fileWatcher: FileWatcher;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));
    fileWatcher = new FileWatcher();
  });

  afterEach(async () => {
    await fileWatcher?.dispose();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should clean up resources on dispose', async () => {
    const testFile = path.join(tempDir, 'cleanup.json');
    await fs.writeFile(testFile, '{}');

    await fileWatcher.watch(testFile);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Dispose watcher
    await fileWatcher.dispose();

    // Modify file after dispose
    await fs.writeFile(testFile, '{"after":"dispose"}');
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    // No events should fire after dispose
    expect(fileWatcher.isWatching()).toBe(false);
  });

  it('should unwatch specific files', async () => {
    const file1 = path.join(tempDir, 'file1.json');
    const file2 = path.join(tempDir, 'file2.json');

    await fs.writeFile(file1, '{}');
    await fs.writeFile(file2, '{}');

    const events: string[] = [];

    fileWatcher.on('change', (filePath: string) => {
      events.push(path.basename(filePath));
    });

    await fileWatcher.watch(file1);
    await fileWatcher.watch(file2);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Unwatch file1
    await fileWatcher.unwatch(file1);

    // Modify both files
    await fs.writeFile(file1, '{"a":1}');
    await fs.writeFile(file2, '{"b":1}');

    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - FileWatcher doesn't exist
    expect(events).not.toContain('file1.json');
    expect(events).toContain('file2.json');
  });

  it('should report watched file count', async () => {
    const files = ['a.json', 'b.json', 'c.json'].map(f =>
      path.join(tempDir, f)
    );

    for (const file of files) {
      await fs.writeFile(file, '{}');
    }

    expect(fileWatcher.getWatchedCount()).toBe(0);

    await fileWatcher.watch(files[0]);
    expect(fileWatcher.getWatchedCount()).toBe(1);

    await fileWatcher.watch(files[1]);
    await fileWatcher.watch(files[2]);

    // MUST FAIL - FileWatcher doesn't exist
    expect(fileWatcher.getWatchedCount()).toBe(3);
  });

  it('should handle rapid watch/unwatch cycles', async () => {
    const testFile = path.join(tempDir, 'cycle.json');
    await fs.writeFile(testFile, '{}');

    for (let i = 0; i < 10; i++) {
      await fileWatcher.watch(testFile);
      await fileWatcher.unwatch(testFile);
    }

    // Should not crash or leak resources
    // MUST FAIL - FileWatcher doesn't exist
    expect(fileWatcher.getWatchedCount()).toBe(0);
  });
});
