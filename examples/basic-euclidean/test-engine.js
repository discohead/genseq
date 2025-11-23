#!/usr/bin/env node

/**
 * Manual test script for basic-euclidean example
 *
 * Usage:
 *   node test-engine.js
 *
 * Press Ctrl+C to stop playback
 */

const { GenSeqEngine } = require('../../packages/genseq-engine/dist/index.js');
const path = require('path');

async function main() {
  console.log('🎵 GenSeq Engine Test\n');

  // Initialize engine
  console.log('Initializing GenSeq Engine...');
  const engine = new GenSeqEngine({
    clock: { bpm: 120, ppq: 96 },
    midi: { enableVirtualLoopback: false }
  });

  // Event listeners for debugging
  engine.on('transport:started', () => {
    console.log('✅ Transport started');
  });

  engine.on('transport:stopped', () => {
    console.log('⏹️  Transport stopped');
  });

  engine.on('pattern:added', (patternId) => {
    console.log(`📝 Pattern added: ${patternId}`);
  });

  engine.on('midi:noteOn', (event) => {
    console.log(`🎹 Note ON:  ${event.note} velocity ${event.velocity} (channel ${event.channel})`);
  });

  engine.on('midi:noteOff', (event) => {
    console.log(`🎹 Note OFF: ${event.note} (channel ${event.channel})`);
  });

  engine.on('performance:warning', (warning) => {
    console.warn(`⚠️  Performance warning: ${warning.message}`);
  });

  try {
    // Initialize MIDI
    console.log('Initializing MIDI I/O...');
    await engine.initialize();
    console.log('✅ MIDI initialized\n');

    // Load project configuration
    const projectPath = path.resolve(__dirname);
    console.log(`Loading project from: ${projectPath}`);
    await engine.loadProject(projectPath);
    console.log('✅ Project loaded\n');

    // Get engine status
    const status = engine.getStatus();
    console.log('Engine Status:');
    console.log(`  BPM: ${status.bpm}`);
    console.log(`  Active Patterns: ${status.activePatterns}`);
    console.log(`  Transport State: ${status.transportState}\n`);

    // Start playback
    console.log('▶️  Starting playback...\n');
    await engine.start();

    // Keep running until Ctrl+C
    console.log('Press Ctrl+C to stop playback\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nStopping engine...');
      await engine.stop();
      await engine.dispose();
      console.log('✅ Engine stopped');
      process.exit(0);
    });

    // Print status every 4 bars
    setInterval(() => {
      const status = engine.getStatus();
      console.log(`\n📊 Position: Bar ${status.position.bar}, Beat ${status.position.beat}`);
      console.log(`   Transport: ${status.transportState}`);
      console.log(`   Active Patterns: ${status.activePatterns}\n`);
    }, 8000); // Every ~4 bars at 120 BPM

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
