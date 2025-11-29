#!/usr/bin/env node
/**
 * Start script for live-performance example
 * Usage: node examples/live-performance/start.mjs
 */
import { GenSeqEngine } from '../../packages/genseq-engine/dist/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectPath = __dirname;

// Enable verbose logging
const DEBUG = false;

function log(...args) {
  if (DEBUG) console.log(`[${new Date().toISOString()}]`, ...args);
}

console.log('Starting GenSeq Live Performance...');
console.log(`Project path: ${projectPath}`);

const engine = new GenSeqEngine();

// ========== DEBUG EVENT LISTENERS ==========

// MIDI Input events
engine.on('midi:received', (event) => {
  log('📥 MIDI RECEIVED:', JSON.stringify(event));
});

engine.on('midi:cc', (event) => {
  log('🎛️  CC:', `ch=${event.channel} cc=${event.controller} val=${event.value} dev="${event.device}"`);
});

engine.on('midi:note', (event) => {
  log('🎹 NOTE:', `ch=${event.channel} note=${event.note} vel=${event.velocity} on=${event.noteOn} dev="${event.device}"`);
});

engine.on('midi:pitchbend', (event) => {
  log('🎚️  PITCHBEND:', `ch=${event.channel} val=${event.value} dev="${event.device}"`);
});

// MIDI Output events
engine.on('midi:noteOn', (event) => {
  log('📤 NOTE ON:', JSON.stringify(event));
});

engine.on('midi:noteOff', (event) => {
  log('📤 NOTE OFF:', JSON.stringify(event));
});

// Parameter changes from mappings
engine.on('parameter-change', (event) => {
  log('🔧 PARAM CHANGE:', `pattern="${event.patternId}" param="${event.parameter}" value=${event.value}`);
});

// Scene triggers
engine.on('scene-trigger', (event) => {
  log('🎬 SCENE TRIGGER:', `scene="${event.sceneId}" quantize=${event.quantize}`);
});

// Macro expansions
engine.on('macro-expanded', (event) => {
  log('🎯 MACRO EXPANDED:', `macro="${event.macroId}" targets=${event.targets.length}`);
});

// Transport events
engine.on('transport:start', () => log('▶️  TRANSPORT START'));
engine.on('transport:stop', () => log('⏹️  TRANSPORT STOP'));
engine.on('transport:bpmChanged', (data) => log('🎵 BPM CHANGED:', data.bpm));

// Pattern events
engine.on('pattern:added', (id) => log('➕ PATTERN ADDED:', id));
engine.on('pattern:updated', (data) => log('🔄 PATTERN UPDATED:', data.id));
engine.on('pattern:regenerated', (data) => log('♻️  PATTERN REGENERATED:', data.id));

// Config events
engine.on('project:loaded', (data) => {
  log('📂 PROJECT LOADED:', `patterns=${data.patterns} routes=${data.routes}`);
});

engine.on('config:reloaded', (data) => log('🔃 CONFIG RELOADED:', data));
engine.on('config:error', (data) => log('❌ CONFIG ERROR:', data.error));

// Errors
engine.on('error', (err) => {
  console.error('❌ ENGINE ERROR:', err);
});

// ========== END DEBUG LISTENERS ==========

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

  // List available MIDI ports for debugging
  const outputPorts = await engine.getMidiOutputPorts();
  console.log('\n📡 Available MIDI OUTPUT ports:');
  outputPorts.forEach((port, i) => console.log(`  ${i}: ${port.name}`));

  log('Loading project from:', projectPath);
  await engine.loadProject(projectPath);

  log('Starting engine...');
  engine.start();

  console.log('\n✅ Engine running. Press Ctrl+C to stop.');
  console.log('🎛️  Waiting for MIDI input... (move a fader or knob on your controller)\n');
} catch (error) {
  console.error('Failed to start engine:', error.message);
  console.error(error.stack);
  process.exit(1);
}
