#!/usr/bin/env node

/**
 * MIDI Output Verification Test for Hot-Reload
 *
 * This test verifies that hot-reload changes actually affect MIDI output,
 * not just fire events. It captures MIDI messages before and after a pattern
 * change to confirm the output changed.
 */

const { GenSeqEngine } = require('../../packages/genseq-engine/dist/GenSeqEngine.js');
const path = require('path');
const fs = require('fs');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(emoji, color, ...args) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  console.log(`${colors.gray}[${timestamp}]${colors.reset} ${emoji} ${color}${args.join(' ')}${colors.reset}`);
}

// Capture MIDI output for analysis
class MidiCapture {
  constructor() {
    this.messages = [];
    this.noteOns = [];
  }

  capture(message) {
    this.messages.push({
      timestamp: Date.now(),
      status: message[0],
      data1: message[1],
      data2: message[2]
    });

    // Track note-on messages (status 0x90-0x9F)
    const status = message[0] & 0xF0;
    if (status === 0x90 && message[2] > 0) {
      this.noteOns.push({
        timestamp: Date.now(),
        note: message[1],
        velocity: message[2]
      });
    }
  }

  getUniqueNotes() {
    return [...new Set(this.noteOns.map(m => m.note))];
  }

  getVelocityRange() {
    const velocities = this.noteOns.map(m => m.velocity);
    return {
      min: Math.min(...velocities),
      max: Math.max(...velocities),
      avg: velocities.reduce((a, b) => a + b, 0) / velocities.length
    };
  }

  getNoteCount(note) {
    return this.noteOns.filter(m => m.note === note).length;
  }

  clear() {
    this.messages = [];
    this.noteOns = [];
  }

  summary() {
    return {
      totalMessages: this.messages.length,
      totalNoteOns: this.noteOns.length,
      uniqueNotes: this.getUniqueNotes(),
      velocityRange: this.noteOns.length > 0 ? this.getVelocityRange() : null
    };
  }
}

async function main() {
  log('🎯', colors.cyan, 'MIDI Output Verification Test');
  log('📋', colors.gray, 'This test verifies hot-reload actually changes MIDI output\n');

  const projectPath = __dirname;
  const snarePatternPath = path.join(projectPath, 'patterns', 'snare.json');

  // Read original pattern
  const originalPattern = JSON.parse(fs.readFileSync(snarePatternPath, 'utf-8'));
  const originalPulses = originalPattern.euclidean.pulses;
  const originalVelocity = originalPattern.euclidean.velocity;

  log('📄', colors.blue, `Original snare pattern: pulses=${originalPulses}, velocity=${originalVelocity}`);

  // Create engine with MIDI capture
  const engine = new GenSeqEngine({
    enableHotReload: true,
    midi: {
      enableVirtualLoopback: true
    }
  });

  const midiCapture = new MidiCapture();

  // Hook into MIDI output
  engine.on('midi:noteOn', (event) => {
    midiCapture.capture([0x90 | (event.channel - 1), event.note, event.velocity]);
  });

  engine.on('midi:noteOff', (event) => {
    midiCapture.capture([0x80 | (event.channel - 1), event.note, event.velocity || 0]);
  });

  await engine.initialize();
  await engine.loadProject(projectPath);

  log('⏳', colors.yellow, 'Waiting for file watcher to initialize...');
  await new Promise(resolve => setTimeout(resolve, 300));

  log('▶️', colors.green, 'Starting playback...\n');
  engine.start();

  // Phase 1: Capture baseline MIDI output
  log('📊', colors.cyan, 'Phase 1: Capturing baseline MIDI output (4 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 4000));

  const baseline = midiCapture.summary();
  log('✓', colors.green, `Baseline captured: ${baseline.totalNoteOns} note-ons`);
  log('  ', colors.gray, `Notes: ${baseline.uniqueNotes.join(', ')}`);
  if (baseline.velocityRange) {
    log('  ', colors.gray, `Velocity range: ${baseline.velocityRange.min}-${baseline.velocityRange.max} (avg: ${baseline.velocityRange.avg.toFixed(1)})`);
  }

  const snareNote = originalPattern.note;
  const baselineSnareCount = midiCapture.getNoteCount(snareNote);
  log('  ', colors.gray, `Snare (note ${snareNote}) hits: ${baselineSnareCount}\n`);

  // Phase 2: Modify pattern and capture new output
  log('🔄', colors.blue, 'Phase 2: Modifying snare pattern...');
  const modifiedPattern = { ...originalPattern };
  modifiedPattern.euclidean = {
    ...originalPattern.euclidean,
    pulses: originalPulses === 5 ? 3 : 5, // Change pulses significantly
    velocity: 0 // Silence the snare completely
  };

  log('  ', colors.yellow, `Changing: pulses ${originalPulses} → ${modifiedPattern.euclidean.pulses}`);
  log('  ', colors.yellow, `Changing: velocity ${originalVelocity} → 0 (silence)`);

  fs.writeFileSync(snarePatternPath, JSON.stringify(modifiedPattern, null, 2));

  log('⏳', colors.gray, 'Waiting for hot-reload to apply...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  midiCapture.clear();

  log('📊', colors.cyan, 'Capturing modified MIDI output (4 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 4000));

  const modified = midiCapture.summary();
  log('✓', colors.green, `Modified output captured: ${modified.totalNoteOns} note-ons`);
  log('  ', colors.gray, `Notes: ${modified.uniqueNotes.join(', ')}`);
  if (modified.velocityRange) {
    log('  ', colors.gray, `Velocity range: ${modified.velocityRange.min}-${modified.velocityRange.max} (avg: ${modified.velocityRange.avg.toFixed(1)})`);
  }

  const modifiedSnareCount = midiCapture.getNoteCount(snareNote);
  log('  ', colors.gray, `Snare (note ${snareNote}) hits: ${modifiedSnareCount}\n`);

  // Phase 3: Analysis
  log('🔍', colors.cyan, 'Phase 3: Analyzing results...\n');

  const snareCountChanged = baselineSnareCount !== modifiedSnareCount;
  const velocityChanged = baseline.velocityRange && modified.velocityRange &&
                         Math.abs(baseline.velocityRange.avg - modified.velocityRange.avg) > 5;

  if (snareCountChanged) {
    log('✅', colors.green, `PASS: Snare hit count changed (${baselineSnareCount} → ${modifiedSnareCount})`);
  } else {
    log('❌', colors.red, `FAIL: Snare hit count did NOT change (${baselineSnareCount} → ${modifiedSnareCount})`);
  }

  if (velocityChanged) {
    log('✅', colors.green, `PASS: Velocity changed (${baseline.velocityRange.avg.toFixed(1)} → ${modified.velocityRange.avg.toFixed(1)})`);
  } else {
    log('❌', colors.red, `FAIL: Velocity did NOT change significantly`);
  }

  const testPassed = snareCountChanged || velocityChanged;

  log('', colors.reset, '');
  if (testPassed) {
    log('✅', colors.green, 'TEST PASSED: Hot-reload changed MIDI output');
  } else {
    log('❌', colors.red, 'TEST FAILED: Hot-reload did NOT change MIDI output');
    log('💡', colors.yellow, 'This indicates hot-reload events fire but pattern execution is not updating');
  }

  // Restore original pattern
  fs.writeFileSync(snarePatternPath, JSON.stringify(originalPattern, null, 2));

  await engine.shutdown();
  process.exit(testPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
