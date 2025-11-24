# T051: Validation-Before-Apply Logic

## Overview

ConfigurationManager implements comprehensive validation-before-apply logic to ensure configuration integrity during hot-reload operations. Invalid configurations are rejected before swap, preserving system stability.

## Implementation Location

**File**: `/Users/jaredmcfarland/Developer/genseq/packages/genseq-engine/src/config/ConfigurationManager.ts`

**Key Method**: `swap()` (lines 152-188)

## Features

### 1. Validation Before Swap

The `swap()` method validates pending configuration before committing:

```typescript
async swap(): Promise<void> {
  // ... lock acquisition ...

  if (!this.pendingConfig) {
    throw new Error('No pending configuration to swap');
  }

  this.emit('beforeSwap');

  // Validate if enabled and validator is set
  if (this.options.validateOnSwap && this.validator) {
    try {
      this.validator(this.pendingConfig);
    } catch (error) {
      // Validation failed - rollback
      this.pendingConfig = null;
      this.emit('validationFailed', { errors: error });
      throw error;
    }
  }

  // Atomic swap
  this.activeConfig = this.pendingConfig;
  this.pendingConfig = null;

  this.emit('afterSwap');
}
```

### 2. Custom Validator Registration

Applications can register custom validators with business logic:

```typescript
manager.setValidator((config: ProjectConfig) => {
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
```

### 3. Validation Failure Handling

When validation fails:

1. **Pending buffer cleared**: `this.pendingConfig = null`
2. **Active config preserved**: No changes to `activeConfig`
3. **Event emitted**: `validationFailed` event with error details
4. **Error propagated**: Exception thrown to caller

### 4. Event Lifecycle

The swap process emits events for monitoring:

```typescript
// Success path
manager.on('beforeSwap', () => { /* ... */ });
manager.on('afterSwap', () => { /* ... */ });

// Failure path
manager.on('validationFailed', (event) => {
  console.error('Validation failed:', event.errors);
});
```

### 5. Optional Validation

Validation can be disabled via options:

```typescript
const manager = new ConfigurationManager({
  validateOnSwap: false  // Skip validation
});
```

## Usage Examples

### Example 1: Basic Validation

```typescript
import { ConfigurationManager } from '@genseq/engine';

const manager = new ConfigurationManager({ validateOnSwap: true });

// Set validator
manager.setValidator((config) => {
  if (config.bpm < 20 || config.bpm > 300) {
    throw new Error(`Invalid BPM: ${config.bpm}`);
  }
  return true;
});

// Set initial config
manager.setActive({ bpm: 120, ppq: 480 });

// Attempt invalid config
await manager.loadPending({ bpm: -50, ppq: 480 });

try {
  await manager.swap(); // Throws validation error
} catch (error) {
  console.error('Swap failed:', error.message);
  // Active config remains at bpm: 120
}
```

### Example 2: Event-Driven Validation

```typescript
const manager = new ConfigurationManager({ validateOnSwap: true });

manager.on('validationFailed', (event) => {
  console.error('Validation failed:', event.errors);
  // Log to monitoring system
  logValidationFailure(event.errors);
});

manager.setValidator((config) => {
  // Complex validation logic
  validateBpm(config.bpm);
  validatePpq(config.ppq);
  validatePatterns(config.patterns);
  return true;
});
```

### Example 3: Schema Validation Integration

```typescript
import { SchemaValidator } from '@genseq/engine';

const schemaValidator = new SchemaValidator();
const manager = new ConfigurationManager({ validateOnSwap: true });

manager.setValidator((config) => {
  const valid = schemaValidator.validate(config, 'project');
  if (!valid) {
    const errors = schemaValidator.getErrors();
    throw new Error(`Schema validation failed: ${JSON.stringify(errors)}`);
  }
  return true;
});
```

## Test Coverage

**Test File**: `/Users/jaredmcfarland/Developer/genseq/packages/genseq-engine/tests/unit/ConfigurationManager.test.ts`

**Key Tests**:

1. ✅ `should rollback to active config on validation failure` (lines 132-187)
   - Validates rejection of invalid BPM
   - Confirms active config preservation
   - Verifies `validationFailed` event emission
   - Checks pending buffer cleared

2. ✅ `should emit events during swap lifecycle` (lines 237-264)
   - Validates event ordering
   - Confirms `beforeSwap` → `afterSwap` sequence

3. ✅ `should perform atomic swap from pending to active buffer` (lines 33-68)
   - Validates successful swap with valid config

**Verification Script**: `/Users/jaredmcfarland/Developer/genseq/packages/genseq-engine/tests/verification/T051-validation-verification.ts`

Comprehensive test cases:
- Invalid BPM (negative value)
- Invalid PPQ (out of range)
- Empty patterns array
- Valid config (success path)
- Validation disabled

## Success Criteria

All requirements met:

✅ **Validate staged config before commit/swap**
- Implemented in `swap()` method (lines 168-177)
- Validator called before assignment

✅ **Reject invalid configs with detailed errors**
- Validator exceptions caught and preserved
- Error details passed to event listeners

✅ **Preserve active config on rejection**
- `pendingConfig = null` on validation failure (line 173)
- `activeConfig` never assigned on failure

✅ **Emit 'validationFailed' event with error details**
- Event emitted with `{ errors: error }` payload (line 174)

## Performance Characteristics

- **Validation overhead**: Depends on custom validator logic
- **No partial state**: Atomic swap guarantees consistency
- **Thread-safe**: Lock prevents concurrent swap attempts
- **Zero-copy on failure**: No active config mutation

## Integration Points

ConfigurationManager validation integrates with:

1. **HotReloadCoordinator**: Validates before bar-boundary swap
2. **SchemaValidator**: JSON Schema validation of configs
3. **ErrorLogger**: Logs validation failures for diagnostics
4. **GenSeqEngine**: Engine-level config validation

## Related Documentation

- **T047**: ConfigurationManager dual-buffer implementation
- **T048**: SchemaValidator integration
- **T049**: FileWatcher hot-reload
- **T050**: HotReloadCoordinator bar-boundary swap

## Future Enhancements

Potential improvements:

1. **Async Validators**: Support `async` validation functions
2. **Partial Validation**: Validate only changed properties
3. **Validation Cache**: Cache validation results for performance
4. **Rollback Stack**: Multiple-level rollback support
5. **Warning vs Error**: Support non-blocking validation warnings
