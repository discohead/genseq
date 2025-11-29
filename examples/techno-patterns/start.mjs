#!/usr/bin/env node
/**
 * Start script for techno-patterns example
 * Usage: node examples/techno-patterns/start.mjs
 *
 * Demonstrates all 4 techno pattern generators:
 * - TechnoKickBassPattern: 4-on-the-floor kick with interlocking bass
 * - TechnoHiHatPattern: Multi-layer hi-hat with swing and ghost notes
 * - TechnoChordPattern: Sparse syncopated chord stabs
 * - TechnoLeadPattern: Looping melodic phrases
 */
import { GenSeqEngine } from '../../packages/genseq-engine/dist/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectPath = __dirname;

// Enable verbose logging for debugging
const DEBUG = process.env.DEBUG === 'true';

function log(...args) {
  if (DEBUG) console.log(`[${new Date().toISOString()}]`, ...args);
}

console.log('='.repeat(60));
console.log('GenSeq Techno Pattern Generators Demo');
console.log('='.repeat(60));
console.log(`Project path: ${projectPath}`);
console.log('');

const engine = new GenSeqEngine();

// ========== EVENT LISTENERS ==========

// MIDI Input events
engine.on('midi:cc', (event) => {
  log('CC:', `ch=${event.channel} cc=${event.controller} val=${event.value}`);
});

// Parameter changes from mappings
engine.on('parameter-change', (event) => {
  console.log(`  Parameter: ${event.patternId}.${event.parameter} = ${event.value}`);
});

// Scene triggers
engine.on('scene-trigger', (event) => {
  console.log(`  Scene: "${event.sceneId}" triggered (quantize: ${event.quantize})`);
});

// Macro expansions
engine.on('macro-expanded', (event) => {
  log('Macro:', `"${event.macroId}" -> ${event.targets.length} targets`);
});

// Transport events
engine.on('transport:start', () => console.log('Transport: STARTED'));
engine.on('transport:stop', () => console.log('Transport: STOPPED'));
engine.on('transport:bpmChanged', (data) => console.log(`BPM: ${data.bpm}`));

// Pattern events
engine.on('pattern:added', (id) => console.log(`  Pattern added: ${id}`));

// Config events
engine.on('project:loaded', (data) => {
  console.log(`Project loaded: ${data.patterns} patterns, ${data.routes} routes`);
});

engine.on('config:error', (data) => console.error('Config error:', data.error));

// Errors
engine.on('error', (err) => {
  console.error('ENGINE ERROR:', err);
});

// ========== END EVENT LISTENERS ==========

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await engine.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await engine.stop();
  process.exit(0);
});

try {
  log('Initializing engine...');
  await engine.initialize();

  // List available MIDI ports
  const outputPorts = await engine.getMidiOutputPorts();
  console.log('\nAvailable MIDI OUTPUT ports:');
  outputPorts.forEach((port, i) => console.log(`  ${i}: ${port.name}`));

  console.log('');
  log('Loading project from:', projectPath);
  await engine.loadProject(projectPath);

  console.log('\n' + '='.repeat(60));
  console.log('CONTROLLER MAPPING (Intech Studio PBF4 "Grid")');
  console.log('='.repeat(60));
  console.log('');
  console.log('Channel 1 - GLOBAL CONTROLS');
  console.log('  Knob (CC1):   Master Density');
  console.log('  Fader (CC2):  Master Velocity');
  console.log('  Button (CC3): Intro Scene');
  console.log('');
  console.log('Channel 2 - KICK/BASS');
  console.log('  Knob (CC1):   Bass Syncopation (0-15 steps)');
  console.log('  Fader (CC2):  Kick Velocity');
  console.log('  Button (CC3): Main Scene');
  console.log('');
  console.log('Channel 3 - HI-HAT');
  console.log('  Knob (CC1):   Hi-Hat Swing (0-50%)');
  console.log('  Fader (CC2):  Ghost Note Probability');
  console.log('  Button (CC3): Breakdown Scene');
  console.log('');
  console.log('Channel 4 - MELODIC');
  console.log('  Knob (CC1):   Chord Density');
  console.log('  Fader (CC2):  Lead Velocity');
  console.log('  Button (CC3): Regenerate Lead Phrase');
  console.log('');
  console.log('='.repeat(60));

  log('Starting engine...');
  engine.start();

  console.log('\nEngine running at 128 BPM. Press Ctrl+C to stop.');
  console.log('Connect your PBF4 controller ("Grid" device) to control patterns.\n');
} catch (error) {
  console.error('Failed to start engine:', error.message);
  console.error(error.stack);
  process.exit(1);
}
