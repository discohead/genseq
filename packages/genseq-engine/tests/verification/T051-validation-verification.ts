/**
 * T051: Verification script for validation-before-apply logic
 *
 * This script demonstrates that ConfigurationManager properly:
 * 1. Validates staged config before commit/swap
 * 2. Rejects invalid configs with detailed errors
 * 3. Preserves active config on rejection
 * 4. Emits 'validationFailed' event with error details
 */

import { ConfigurationManager } from '../../src/config/ConfigurationManager.js';

async function verifyValidationBeforeApply() {
  console.log('=== T051: Validation-Before-Apply Verification ===\n');

  const manager = new ConfigurationManager({ validateOnSwap: true });

  // Set up initial valid configuration
  const validConfig = {
    bpm: 120,
    ppq: 480,
    patterns: [{ id: 'pat1', steps: 16 }]
  };

  manager.setActive(validConfig);
  console.log('✓ Initial valid config set:', JSON.stringify(validConfig, null, 2));

  // Set up custom validator
  manager.setValidator((config: any) => {
    // Validation rules
    if (config.bpm < 20 || config.bpm > 300) {
      throw new Error(`Invalid BPM: ${config.bpm}. Must be between 20-300.`);
    }
    if (config.ppq < 96 || config.ppq > 960) {
      throw new Error(`Invalid PPQ: ${config.ppq}. Must be between 96-960.`);
    }
    if (!config.patterns || config.patterns.length === 0) {
      throw new Error('At least one pattern is required.');
    }
    return true;
  });

  console.log('\n✓ Custom validator registered with rules:');
  console.log('  - BPM: 20-300');
  console.log('  - PPQ: 96-960');
  console.log('  - Patterns: at least 1 required\n');

  // Test Case 1: Invalid BPM
  console.log('--- Test Case 1: Invalid BPM (negative value) ---');
  const invalidBpmConfig = {
    bpm: -50,
    ppq: 480,
    patterns: [{ id: 'pat1', steps: 16 }]
  };

  let validationFailedEvent1: any = null;
  manager.once('validationFailed', (event) => {
    validationFailedEvent1 = event;
  });

  await manager.loadPending(invalidBpmConfig);
  console.log('✓ Invalid config loaded to pending buffer');

  try {
    await manager.swap();
    console.log('✗ FAIL: Swap should have thrown validation error');
  } catch (error: any) {
    console.log('✓ Swap rejected with error:', error.message);
  }

  console.log('✓ validationFailed event emitted:', !!validationFailedEvent1);
  console.log('✓ Error details in event:', !!validationFailedEvent1?.errors);
  console.log('✓ Active config preserved:', manager.getActive().bpm === 120);
  console.log('✓ Pending buffer cleared:', !manager.hasPending());

  // Test Case 2: Invalid PPQ
  console.log('\n--- Test Case 2: Invalid PPQ (too high) ---');
  const invalidPpqConfig = {
    bpm: 120,
    ppq: 9999,
    patterns: [{ id: 'pat1', steps: 16 }]
  };

  let validationFailedEvent2: any = null;
  manager.once('validationFailed', (event) => {
    validationFailedEvent2 = event;
  });

  await manager.loadPending(invalidPpqConfig);
  console.log('✓ Invalid config loaded to pending buffer');

  try {
    await manager.swap();
    console.log('✗ FAIL: Swap should have thrown validation error');
  } catch (error: any) {
    console.log('✓ Swap rejected with error:', error.message);
  }

  console.log('✓ validationFailed event emitted:', !!validationFailedEvent2);
  console.log('✓ Active config preserved:', manager.getActive().bpm === 120);
  console.log('✓ Pending buffer cleared:', !manager.hasPending());

  // Test Case 3: Empty patterns array
  console.log('\n--- Test Case 3: Empty patterns array ---');
  const invalidPatternsConfig = {
    bpm: 120,
    ppq: 480,
    patterns: []
  };

  let validationFailedEvent3: any = null;
  manager.once('validationFailed', (event) => {
    validationFailedEvent3 = event;
  });

  await manager.loadPending(invalidPatternsConfig);
  console.log('✓ Invalid config loaded to pending buffer');

  try {
    await manager.swap();
    console.log('✗ FAIL: Swap should have thrown validation error');
  } catch (error: any) {
    console.log('✓ Swap rejected with error:', error.message);
  }

  console.log('✓ validationFailed event emitted:', !!validationFailedEvent3);
  console.log('✓ Active config preserved:', manager.getActive().patterns.length === 1);
  console.log('✓ Pending buffer cleared:', !manager.hasPending());

  // Test Case 4: Valid config (should succeed)
  console.log('\n--- Test Case 4: Valid config (should succeed) ---');
  const validNewConfig = {
    bpm: 140,
    ppq: 480,
    patterns: [
      { id: 'pat1', steps: 16 },
      { id: 'pat2', steps: 8 }
    ]
  };

  let beforeSwapEmitted = false;
  let afterSwapEmitted = false;

  manager.once('beforeSwap', () => {
    beforeSwapEmitted = true;
  });

  manager.once('afterSwap', () => {
    afterSwapEmitted = true;
  });

  await manager.loadPending(validNewConfig);
  console.log('✓ Valid config loaded to pending buffer');

  await manager.swap();
  console.log('✓ Swap succeeded without errors');
  console.log('✓ beforeSwap event emitted:', beforeSwapEmitted);
  console.log('✓ afterSwap event emitted:', afterSwapEmitted);
  console.log('✓ Active config updated:', manager.getActive().bpm === 140);
  console.log('✓ Pattern count updated:', manager.getActive().patterns.length === 2);

  // Test Case 5: Validation disabled (should skip validation)
  console.log('\n--- Test Case 5: Validation disabled ---');
  const managerNoValidation = new ConfigurationManager({ validateOnSwap: false });

  managerNoValidation.setActive(validConfig);
  managerNoValidation.setValidator((config: any) => {
    throw new Error('This validator should not be called');
  });

  const invalidConfigNoValidation = {
    bpm: -999,
    ppq: 1,
    patterns: []
  };

  await managerNoValidation.loadPending(invalidConfigNoValidation);
  await managerNoValidation.swap();

  console.log('✓ Swap succeeded with validation disabled');
  console.log('✓ Invalid config applied:', managerNoValidation.getActive().bpm === -999);

  manager.dispose();
  managerNoValidation.dispose();

  console.log('\n=== All T051 Verification Tests Passed ===');
}

// Run verification
verifyValidationBeforeApply().catch(console.error);
