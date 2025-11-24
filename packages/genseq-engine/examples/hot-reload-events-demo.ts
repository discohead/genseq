#!/usr/bin/env tsx
/**
 * Demo: Hot-Reload Event Forwarding (T053)
 *
 * Demonstrates how GenSeqEngine forwards hot-reload events
 * from HotReloadCoordinator to simplify the API for consumers.
 *
 * Usage:
 *   npx tsx examples/hot-reload-events-demo.ts
 */

import { GenSeqEngine } from '../src/GenSeqEngine';
import { Clock } from '../src/clock/Clock';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

async function main() {
  console.log('🎵 GenSeqEngine Hot-Reload Event Forwarding Demo\n');

  // Create temporary config directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genseq-hotreload-'));
  const configPath = path.join(tempDir, 'config.json');

  console.log(`📁 Config directory: ${tempDir}\n`);

  // Create initial config
  await fs.writeFile(configPath, JSON.stringify({
    bpm: 120,
    ppq: 96
  }, null, 2));

  // Initialize engine with hot-reload enabled
  const clock = new Clock({ bpm: 120, ppq: 96 });
  const engine = new GenSeqEngine({
    clock,
    midi: { enableVirtualLoopback: true },
    enableHotReload: true  // Hot-reload is enabled by default
  });

  // Set up event listeners
  engine.on('config:reloaded', (event) => {
    console.log('✅ config:reloaded event received:');
    console.log(`   - Timestamp: ${new Date(event.timestamp).toISOString()}`);
    console.log(`   - Latency: ${event.latencyMs}ms`);
    console.log(`   - Files changed: ${JSON.stringify(event.filesChanged)}`);
    console.log('');
  });

  engine.on('config:error', (event) => {
    console.log('❌ config:error event received:');
    console.log(`   - Timestamp: ${new Date(event.timestamp).toISOString()}`);
    console.log(`   - Error: ${event.error}`);
    console.log(`   - Details: ${JSON.stringify(event.details, null, 2)}`);
    console.log('');
  });

  engine.on('error', (event) => {
    if (event.source === 'hotReloadCoordinator') {
      console.log('🔧 HotReloadCoordinator error forwarded:');
      console.log(`   - Error: ${event.error.message}`);
      console.log('');
    }
  });

  // Initialize engine
  await engine.initialize();
  console.log('🎹 Engine initialized\n');

  // Get HotReloadCoordinator instance
  const coordinator = (engine as any).hotReloadCoordinator;

  // Load initial config
  await coordinator.loadConfig(configPath);
  console.log('📝 Initial config loaded\n');

  // Test 1: Successful reload
  console.log('Test 1: Successful config reload\n');
  await fs.writeFile(configPath, JSON.stringify({
    bpm: 140,
    ppq: 96
  }, null, 2));

  await coordinator.reloadConfig(configPath, { immediate: true });
  await new Promise(resolve => setTimeout(resolve, 100));

  // Test 2: Invalid config (triggers error event)
  console.log('Test 2: Invalid config (negative BPM)\n');
  await fs.writeFile(configPath, JSON.stringify({
    bpm: -1,  // Invalid BPM
    ppq: 96
  }, null, 2));

  // Use batch processing to trigger validation
  await (coordinator as any).onFileChange(configPath);
  await new Promise(resolve => setTimeout(resolve, 200));

  // Test 3: Direct error forwarding
  console.log('Test 3: Direct error from HotReloadCoordinator\n');
  coordinator.emit('error', new Error('Simulated coordinator error'));
  await new Promise(resolve => setTimeout(resolve, 100));

  // Cleanup
  console.log('🧹 Cleaning up...\n');
  await engine.shutdown();
  await fs.rm(tempDir, { recursive: true, force: true });

  console.log('✨ Demo complete!\n');
  console.log('Key takeaways:');
  console.log('  - GenSeqEngine forwards config:reloaded events with latency info');
  console.log('  - GenSeqEngine forwards config:error events with error details');
  console.log('  - GenSeqEngine forwards general errors from HotReloadCoordinator');
  console.log('  - Consumers only need to listen to GenSeqEngine, not HotReloadCoordinator');
}

main().catch(console.error);
