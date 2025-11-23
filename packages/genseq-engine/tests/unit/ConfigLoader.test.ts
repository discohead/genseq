import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigLoader } from '../../src/config/ConfigLoader';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * T014: ConfigLoader validation test
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * ConfigLoader class does not exist yet - implementation after Red phase.
 *
 * Requirements:
 * - Load JSON/YAML configuration files
 * - Watch files for changes and trigger reload
 * - Validate configuration against schema
 * - Handle file system errors gracefully
 */

describe('ConfigLoader - File Loading', () => {
  let configLoader: ConfigLoader;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test configs
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));

    // MUST FAIL - ConfigLoader doesn't exist
    configLoader = new ConfigLoader();
  });

  afterEach(async () => {
    if (configLoader) {
      await configLoader.dispose();
    }

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should load valid JSON configuration', async () => {
    const configPath = path.join(tempDir, 'config.json');
    const config = {
      bpm: 120,
      ppq: 480,
      midiOutputPort: 'Virtual Output'
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // MUST FAIL - ConfigLoader doesn't exist
    const loadedConfig = await configLoader.loadFile(configPath);

    expect(loadedConfig).toEqual(config);
    expect(loadedConfig.bpm).toBe(120);
    expect(loadedConfig.ppq).toBe(480);
  });

  it('should load valid YAML configuration', async () => {
    const configPath = path.join(tempDir, 'config.yaml');
    const yamlContent = `
bpm: 120
ppq: 480
midiOutputPort: 'Virtual Output'
timeSignature:
  numerator: 4
  denominator: 4
`;

    await fs.writeFile(configPath, yamlContent);

    // MUST FAIL - ConfigLoader doesn't exist
    const loadedConfig = await configLoader.loadFile(configPath);

    expect(loadedConfig.bpm).toBe(120);
    expect(loadedConfig.ppq).toBe(480);
    expect(loadedConfig.timeSignature.numerator).toBe(4);
  });

  it('should reject malformed JSON', async () => {
    const configPath = path.join(tempDir, 'bad-config.json');
    await fs.writeFile(configPath, '{ invalid json }');

    // MUST FAIL - ConfigLoader doesn't exist
    await expect(configLoader.loadFile(configPath)).rejects.toThrow(/JSON/i);
  });

  it('should reject malformed YAML', async () => {
    const configPath = path.join(tempDir, 'bad-config.yaml');
    await fs.writeFile(configPath, 'invalid:\n  - yaml\n    - structure');

    // MUST FAIL - ConfigLoader doesn't exist
    await expect(configLoader.loadFile(configPath)).rejects.toThrow(/YAML/i);
  });

  it('should handle non-existent files', async () => {
    const configPath = path.join(tempDir, 'non-existent.json');

    // MUST FAIL - ConfigLoader doesn't exist
    await expect(configLoader.loadFile(configPath)).rejects.toThrow(/not found|ENOENT/i);
  });

  it('should handle permission errors', async () => {
    const configPath = path.join(tempDir, 'restricted.json');
    await fs.writeFile(configPath, '{}');

    // Make file unreadable
    await fs.chmod(configPath, 0o000);

    // MUST FAIL - ConfigLoader doesn't exist
    await expect(configLoader.loadFile(configPath)).rejects.toThrow(/permission|EACCES/i);

    // Restore permissions for cleanup
    await fs.chmod(configPath, 0o644);
  });

  it('should support multiple file formats from extension', async () => {
    const jsonPath = path.join(tempDir, 'config.json');
    const yamlPath = path.join(tempDir, 'config.yaml');
    const ymlPath = path.join(tempDir, 'config.yml');

    const config = { bpm: 120 };

    await fs.writeFile(jsonPath, JSON.stringify(config));
    await fs.writeFile(yamlPath, 'bpm: 120');
    await fs.writeFile(ymlPath, 'bpm: 120');

    // MUST FAIL - ConfigLoader doesn't exist
    const jsonConfig = await configLoader.loadFile(jsonPath);
    const yamlConfig = await configLoader.loadFile(yamlPath);
    const ymlConfig = await configLoader.loadFile(ymlPath);

    expect(jsonConfig.bpm).toBe(120);
    expect(yamlConfig.bpm).toBe(120);
    expect(ymlConfig.bpm).toBe(120);
  });

  it('should preserve deep nested structures', async () => {
    const configPath = path.join(tempDir, 'nested.json');
    const config = {
      sequences: [
        {
          name: 'Main',
          tracks: [
            {
              channel: 0,
              patterns: [
                { notes: [60, 64, 67] }
              ]
            }
          ]
        }
      ]
    };

    await fs.writeFile(configPath, JSON.stringify(config));

    // MUST FAIL - ConfigLoader doesn't exist
    const loadedConfig = await configLoader.loadFile(configPath);

    expect(loadedConfig).toEqual(config);
    expect(loadedConfig.sequences[0].tracks[0].patterns[0].notes).toEqual([60, 64, 67]);
  });
});

describe('ConfigLoader - File Watching', () => {
  let configLoader: ConfigLoader;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));
    configLoader = new ConfigLoader({ watchEnabled: true });
  });

  afterEach(async () => {
    await configLoader?.dispose();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should watch files and trigger reload on change', async () => {
    const configPath = path.join(tempDir, 'watch-config.json');
    const initialConfig = { bpm: 120 };
    const updatedConfig = { bpm: 140 };

    await fs.writeFile(configPath, JSON.stringify(initialConfig));

    const reloadEvents: any[] = [];

    configLoader.on('reload', (config) => {
      reloadEvents.push(config);
    });

    // MUST FAIL - ConfigLoader doesn't exist
    await configLoader.watch(configPath);

    // Wait for initial watch setup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Modify file
    await fs.writeFile(configPath, JSON.stringify(updatedConfig));

    // Wait for file change detection
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should have triggered reload
    expect(reloadEvents.length).toBeGreaterThan(0);
    expect(reloadEvents[reloadEvents.length - 1].bpm).toBe(140);
  });

  it('should debounce rapid file changes', async () => {
    const configPath = path.join(tempDir, 'debounce-config.json');
    await fs.writeFile(configPath, JSON.stringify({ bpm: 120 }));

    const reloadEvents: any[] = [];

    configLoader.on('reload', (config) => {
      reloadEvents.push(config);
    });

    await configLoader.watch(configPath, { debounceMs: 200 });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Make rapid changes
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(configPath, JSON.stringify({ bpm: 120 + i }));
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 400));

    // Should have debounced to 1-2 reload events, not 10
    // MUST FAIL - ConfigLoader doesn't exist
    expect(reloadEvents.length).toBeLessThan(5);
  });

  it('should handle file deletion during watch', async () => {
    const configPath = path.join(tempDir, 'delete-config.json');
    await fs.writeFile(configPath, JSON.stringify({ bpm: 120 }));

    const errorEvents: Error[] = [];

    configLoader.on('error', (error) => {
      errorEvents.push(error);
    });

    await configLoader.watch(configPath);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Delete file
    await fs.unlink(configPath);

    await new Promise(resolve => setTimeout(resolve, 300));

    // Should emit error event
    // MUST FAIL - ConfigLoader doesn't exist
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  it('should stop watching when dispose is called', async () => {
    const configPath = path.join(tempDir, 'dispose-config.json');
    await fs.writeFile(configPath, JSON.stringify({ bpm: 120 }));

    const reloadEvents: any[] = [];

    configLoader.on('reload', (config) => {
      reloadEvents.push(config);
    });

    await configLoader.watch(configPath);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dispose (stop watching)
    await configLoader.dispose();

    // Modify file after dispose
    await fs.writeFile(configPath, JSON.stringify({ bpm: 140 }));
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should not have triggered reload
    // MUST FAIL - ConfigLoader doesn't exist
    expect(reloadEvents.length).toBe(0);
  });

  it('should watch multiple files independently', async () => {
    const config1Path = path.join(tempDir, 'config1.json');
    const config2Path = path.join(tempDir, 'config2.json');

    await fs.writeFile(config1Path, JSON.stringify({ name: 'config1' }));
    await fs.writeFile(config2Path, JSON.stringify({ name: 'config2' }));

    const reloadEvents: Array<{ file: string; config: any }> = [];

    configLoader.on('reload', (config, filePath) => {
      reloadEvents.push({ file: filePath, config });
    });

    await configLoader.watch(config1Path);
    await configLoader.watch(config2Path);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Modify config1
    await fs.writeFile(config1Path, JSON.stringify({ name: 'config1-updated' }));
    await new Promise(resolve => setTimeout(resolve, 300));

    // Modify config2
    await fs.writeFile(config2Path, JSON.stringify({ name: 'config2-updated' }));
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should have separate reload events
    // MUST FAIL - ConfigLoader doesn't exist
    expect(reloadEvents.length).toBeGreaterThanOrEqual(2);

    const config1Events = reloadEvents.filter(e => e.file.includes('config1'));
    const config2Events = reloadEvents.filter(e => e.file.includes('config2'));

    expect(config1Events.length).toBeGreaterThan(0);
    expect(config2Events.length).toBeGreaterThan(0);
  });
});

describe('ConfigLoader - Validation Integration', () => {
  let configLoader: ConfigLoader;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));

    // MUST FAIL - ConfigLoader doesn't exist
    configLoader = new ConfigLoader({
      validateOnLoad: true
    });
  });

  afterEach(async () => {
    await configLoader?.dispose();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should validate config against schema on load', async () => {
    const schemaPath = path.join(tempDir, 'schema.json');
    const configPath = path.join(tempDir, 'config.json');

    const schema = {
      type: 'object',
      required: ['bpm', 'ppq'],
      properties: {
        bpm: { type: 'number', minimum: 20, maximum: 300 },
        ppq: { type: 'number', enum: [96, 192, 480, 960] }
      }
    };

    const validConfig = { bpm: 120, ppq: 480 };

    await fs.writeFile(schemaPath, JSON.stringify(schema));
    await fs.writeFile(configPath, JSON.stringify(validConfig));

    configLoader.setSchema(schema);

    // MUST FAIL - ConfigLoader doesn't exist
    const loadedConfig = await configLoader.loadFile(configPath);
    expect(loadedConfig).toEqual(validConfig);
  });

  it('should reject config that violates schema', async () => {
    const schema = {
      type: 'object',
      required: ['bpm'],
      properties: {
        bpm: { type: 'number', minimum: 20, maximum: 300 }
      }
    };

    const invalidConfig = { bpm: 999 }; // Exceeds maximum

    const configPath = path.join(tempDir, 'invalid-config.json');
    await fs.writeFile(configPath, JSON.stringify(invalidConfig));

    configLoader.setSchema(schema);

    // MUST FAIL - ConfigLoader doesn't exist
    await expect(configLoader.loadFile(configPath)).rejects.toThrow(/validation|schema/i);
  });

  it('should provide detailed validation error messages', async () => {
    const schema = {
      type: 'object',
      required: ['bpm', 'ppq', 'midiOutputPort'],
      properties: {
        bpm: { type: 'number' },
        ppq: { type: 'number' },
        midiOutputPort: { type: 'string' }
      }
    };

    const invalidConfig = {
      bpm: '120', // Wrong type
      ppq: 480
      // Missing midiOutputPort
    };

    const configPath = path.join(tempDir, 'detailed-error-config.json');
    await fs.writeFile(configPath, JSON.stringify(invalidConfig));

    configLoader.setSchema(schema);

    try {
      await configLoader.loadFile(configPath);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      // MUST FAIL - ConfigLoader doesn't exist
      expect(error.message).toContain('bpm');
      expect(error.message).toContain('midiOutputPort');
      expect(error.validationErrors).toBeDefined();
      expect(error.validationErrors.length).toBeGreaterThan(0);
    }
  });

  it('should support disabling validation for specific loads', async () => {
    const schema = {
      type: 'object',
      required: ['bpm'],
      properties: {
        bpm: { type: 'number' }
      }
    };

    const invalidConfig = { bpm: 'invalid' };

    const configPath = path.join(tempDir, 'no-validate-config.json');
    await fs.writeFile(configPath, JSON.stringify(invalidConfig));

    configLoader.setSchema(schema);

    // Load without validation
    // MUST FAIL - ConfigLoader doesn't exist
    const loadedConfig = await configLoader.loadFile(configPath, { validate: false });

    expect(loadedConfig.bpm).toBe('invalid'); // Loaded despite being invalid
  });
});

describe('ConfigLoader - Caching and Performance', () => {
  let configLoader: ConfigLoader;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-test-'));
    configLoader = new ConfigLoader({ enableCache: true });
  });

  afterEach(async () => {
    await configLoader?.dispose();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should cache loaded configurations', async () => {
    const configPath = path.join(tempDir, 'cache-config.json');
    const config = { bpm: 120 };

    await fs.writeFile(configPath, JSON.stringify(config));

    const loadStartTime = performance.now();
    const firstLoad = await configLoader.loadFile(configPath);
    const firstLoadTime = performance.now() - loadStartTime;

    const cacheStartTime = performance.now();
    const secondLoad = await configLoader.loadFile(configPath);
    const cacheLoadTime = performance.now() - cacheStartTime;

    // MUST FAIL - ConfigLoader doesn't exist
    expect(secondLoad).toEqual(firstLoad);
    expect(cacheLoadTime).toBeLessThan(firstLoadTime); // Cached load should be faster
  });

  it('should invalidate cache when file changes', async () => {
    const configPath = path.join(tempDir, 'invalidate-cache-config.json');

    await fs.writeFile(configPath, JSON.stringify({ bpm: 120 }));

    const firstLoad = await configLoader.loadFile(configPath);

    // Modify file
    await new Promise(resolve => setTimeout(resolve, 10)); // Ensure timestamp changes
    await fs.writeFile(configPath, JSON.stringify({ bpm: 140 }));

    const secondLoad = await configLoader.loadFile(configPath);

    // MUST FAIL - ConfigLoader doesn't exist
    expect(firstLoad.bpm).toBe(120);
    expect(secondLoad.bpm).toBe(140);
  });

  it('should support manual cache clearing', async () => {
    const configPath = path.join(tempDir, 'clear-cache-config.json');
    await fs.writeFile(configPath, JSON.stringify({ bpm: 120 }));

    await configLoader.loadFile(configPath);

    const isCached = configLoader.isCached(configPath);
    expect(isCached).toBe(true);

    configLoader.clearCache();

    const stillCached = configLoader.isCached(configPath);

    // MUST FAIL - ConfigLoader doesn't exist
    expect(stillCached).toBe(false);
  });
});
