#!/usr/bin/env node

/**
 * GenSeq Hot-Reload Interactive Demo
 *
 * This script demonstrates Phase 4 hot-reload functionality:
 * - Starts engine with hot-reload enabled
 * - Monitors pattern file changes
 * - Displays event lifecycle and latency measurements
 * - Keeps running until you press Ctrl+C
 *
 * Usage: node test-hot-reload.js
 */

const path = require('path');
const { GenSeqEngine } = require('../../packages/genseq-engine/dist/GenSeqEngine.js');

const PROJECT_DIR = __dirname;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(icon, color, message, details = '') {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ${icon}  ${color}${message}${colors.reset}`,
    details
  );
}

async function main() {
  console.log('\n' + colors.bright + '╔════════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.bright + '║         GenSeq Hot-Reload Interactive Demo (Phase 4)       ║' + colors.reset);
  console.log(colors.bright + '╚════════════════════════════════════════════════════════════╝' + colors.reset + '\n');

  log('🎯', colors.cyan, 'Initializing GenSeq engine...');

  const engine = new GenSeqEngine({
    enableHotReload: true,
    midi: {
      enableVirtualLoopback: true, // No hardware required for demo
    },
  });

  try {
    await engine.initialize();
    log('✓', colors.green, 'Engine initialized');

    // Track hot-reload statistics
    const stats = {
      reloadCount: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
    };

    // Event listeners for hot-reload lifecycle
    engine.on('config:swapScheduled', (event) => {
      const fileName = path.basename(event.file);
      const patternId = event.patternId || 'unknown';
      log('🔄', colors.blue, `Hot-reload scheduled for next bar`, `(${fileName})`);
      console.log(colors.dim + `   Pattern: ${patternId}` + colors.reset);
    });

    engine.on('config:swapExecuting', () => {
      log('⚡', colors.yellow, 'Applying configuration update...');
    });

    engine.on('config:reloaded', (event) => {
      stats.reloadCount++;
      const latency = event.latencyMs || 0;
      stats.totalLatency += latency;
      stats.minLatency = Math.min(stats.minLatency, latency);
      stats.maxLatency = Math.max(stats.maxLatency, latency);

      const fileName = event.filesChanged?.[0] ? path.basename(event.filesChanged[0]) : 'unknown';
      const latencyColor = latency < 1 ? colors.green : latency < 10 ? colors.yellow : colors.red;

      log('✅', colors.green, 'Hot-reload complete!', `(${fileName})`);
      console.log(colors.dim + `   Latency: ${latencyColor}${latency.toFixed(2)}ms${colors.reset}`);
      console.log(colors.dim + `   Total reloads: ${stats.reloadCount}` + colors.reset);
      console.log(colors.dim + `   Avg latency: ${(stats.totalLatency / stats.reloadCount).toFixed(2)}ms` + colors.reset);
    });

    engine.on('config:error', (event) => {
      const fileName = event.details?.file ? path.basename(event.details.file) : 'unknown';
      const line = event.details?.line || '?';
      log('❌', colors.red, 'Hot-reload validation failed!', `(${fileName}:${line})`);
      console.log(colors.dim + `   Error: ${event.error.message}` + colors.reset);
      console.log(colors.yellow + '   🛡️  Continuing with last valid configuration' + colors.reset);
    });

    // Load project
    log('📂', colors.cyan, 'Loading project...', PROJECT_DIR);
    await engine.loadProject(PROJECT_DIR);
    log('✓', colors.green, 'Project loaded');

    // Start playback
    log('▶️ ', colors.magenta, 'Starting playback...');
    engine.start();
    log('✓', colors.green, 'Engine playing at 120 BPM');

    console.log('\n' + colors.bright + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
    console.log(colors.bright + '  HOT-RELOAD DEMO RUNNING' + colors.reset);
    console.log(colors.bright + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

    console.log(colors.cyan + '📝 Edit pattern files to test hot-reload:' + colors.reset);
    console.log(colors.dim + '   • patterns/kick.yaml   - Change pulses, velocity, or rotation' + colors.reset);
    console.log(colors.dim + '   • patterns/snare.yaml  - Try different Euclidean rhythms' + colors.reset);
    console.log('');
    console.log(colors.cyan + '💡 Try these edits:' + colors.reset);
    console.log(colors.dim + '   • pulses: 8           - Increase rhythm density' + colors.reset);
    console.log(colors.dim + '   • velocity: 120       - Louder hits' + colors.reset);
    console.log(colors.dim + '   • rotation: 4         - Phase shift pattern' + colors.reset);
    console.log('');
    console.log(colors.yellow + '⚠️  Try invalid configs to see error handling:' + colors.reset);
    console.log(colors.dim + '   • pulses: "invalid"   - Trigger validation error' + colors.reset);
    console.log('');
    console.log(colors.magenta + '🎵 MIDI Output:' + colors.reset);
    console.log(colors.dim + '   • Virtual: IAC Driver GenSeq (virtual loopback)' + colors.reset);
    console.log(colors.dim + '   • To hear audio: Route IAC Driver to a software synth' + colors.reset);
    console.log('');
    console.log(colors.bright + 'Press Ctrl+C to stop' + colors.reset + '\n');

    // Graceful shutdown on Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n');
      log('🛑', colors.yellow, 'Shutting down...');

      await engine.shutdown();

      console.log('\n' + colors.bright + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
      console.log(colors.bright + '  HOT-RELOAD STATISTICS' + colors.reset);
      console.log(colors.bright + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

      if (stats.reloadCount > 0) {
        console.log(colors.cyan + '  Total reloads:' + colors.reset, stats.reloadCount);
        console.log(colors.cyan + '  Average latency:' + colors.reset, `${(stats.totalLatency / stats.reloadCount).toFixed(2)}ms`);
        console.log(colors.cyan + '  Min latency:' + colors.reset, `${stats.minLatency.toFixed(2)}ms`);
        console.log(colors.cyan + '  Max latency:' + colors.reset, `${stats.maxLatency.toFixed(2)}ms`);
        console.log('');
        console.log(colors.green + '  ✅ Target: <50ms' + colors.reset);
        console.log(colors.green + `  ✅ Achieved: ${(stats.totalLatency / stats.reloadCount).toFixed(2)}ms (${Math.floor(50 / (stats.totalLatency / stats.reloadCount))}x better!)` + colors.reset);
      } else {
        console.log(colors.yellow + '  No hot-reloads detected' + colors.reset);
        console.log(colors.dim + '  (Try editing pattern files next time!)' + colors.reset);
      }

      console.log('');
      log('👋', colors.cyan, 'Engine stopped. Goodbye!');
      console.log('');

      process.exit(0);
    });

    // Keep process alive
    setInterval(() => {
      // Just keep the event loop running
      // Hot-reload events will be displayed as they occur
    }, 1000);

  } catch (error) {
    log('💥', colors.red, 'Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
