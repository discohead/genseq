# Quick Start: Pattern Type Hot-Reload

**Feature**: Pattern Type Hot-Reload
**Branch**: `002-pattern-type-hotreload`

## Overview

This guide helps developers implement pattern type hot-reload, enabling seamless switching between pattern generator types (euclidean, probability, phase, script) during live playback without transport interruption.

## Prerequisites

- GenSeq engine with hot-reload infrastructure (User Story 2)
- Pattern execution system (User Story 1)
- Node.js 18+ with TypeScript 5+
- Vitest for testing

## Implementation Steps

### Step 1: Create Pattern Types (if missing)

First, implement any missing pattern types in `packages/genseq-patterns/src/`:

```typescript
// packages/genseq-patterns/src/probability/ProbabilityPattern.ts
import type { PatternContext, MidiEvent } from '../types';

export class ProbabilityPattern {
  private config: {
    probability: number;  // 0-1
    density: number;      // events per bar
    note: number;
    velocity: number | number[];
    duration: number;
    seed?: number;
  };

  constructor(config: any) {
    this.config = config;
  }

  tick(context: PatternContext): MidiEvent[] {
    // Implementation here
  }

  updateConfig(config: Partial<any>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    // Reset any internal state
  }
}
```

### Step 2: Create PatternFactory

Create the centralized factory in `packages/genseq-engine/src/patterns/PatternFactory.ts`:

```typescript
import { EuclideanPattern } from '@genseq/patterns';
import { ProbabilityPattern } from '@genseq/patterns';
// Import other pattern types...

export class PatternFactory {
  private schemas: Map<string, JSONSchema> = new Map();
  private validator: Ajv;

  constructor() {
    this.validator = new Ajv();
    this.loadSchemas();
  }

  createPattern(entity: PatternEntity): PatternInstance {
    // Validate parameters first
    const validation = this.validateParameters(entity.type, entity.parameters);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${JSON.stringify(validation.errors)}`);
    }

    // Create appropriate pattern type
    switch (entity.type) {
      case 'euclidean':
        return new EuclideanPattern(entity.parameters);
      case 'probability':
        return new ProbabilityPattern(entity.parameters);
      case 'phase':
        return new PhasePattern(entity.parameters);
      case 'script':
        return new ScriptPattern(entity.parameters);
      default:
        throw new Error(`Unknown pattern type: ${entity.type}`);
    }
  }

  validateParameters(type: PatternType, params: Record<string, any>): ValidationResult {
    const schema = this.schemas.get(type);
    if (!schema) {
      return { valid: false, errors: [{ path: '/', message: 'Unknown pattern type' }] };
    }

    const valid = this.validator.validate(schema, params);
    if (!valid) {
      return {
        valid: false,
        errors: this.validator.errors?.map(e => ({
          path: e.instancePath,
          message: e.message || ''
        })) || []
      };
    }

    return { valid: true };
  }

  getParameterSchema(type: PatternType): JSONSchema {
    const schema = this.schemas.get(type);
    if (!schema) {
      throw new Error(`No schema for pattern type: ${type}`);
    }
    return schema;
  }

  private loadSchemas(): void {
    // Load schemas for each pattern type
    // These would typically be loaded from JSON files
    this.schemas.set('euclidean', euclideanSchema);
    this.schemas.set('probability', probabilitySchema);
    this.schemas.set('phase', phaseSchema);
    this.schemas.set('script', scriptSchema);
  }
}
```

### Step 3: Extend ActivePattern State

Update the ActivePattern interface in `PatternExecutor.ts`:

```typescript
export interface ActivePattern {
  // Existing fields...
  entity: PatternEntity;
  generator: PatternGeneratorFn | null;
  patternInstance?: any;
  enabled: boolean;
  lastTick: number;
  pendingUpdate: boolean;
  currentCycleStart?: number;

  // Add type swap tracking
  pendingTypeSwap: boolean;
  targetType: PatternType | null;
  targetEntity: PatternEntity | null;
  swapScheduledAt: bigint | null;
}
```

### Step 4: Add Type Swap Methods to PatternExecutor

Add these methods to the PatternExecutor class:

```typescript
export class PatternExecutor extends EventEmitter {
  private factory: PatternFactory;

  constructor(config: PatternExecutorConfig) {
    super();
    this.clock = config.clock;
    this.factory = new PatternFactory();
  }

  /**
   * Schedule a type swap for the next cycle boundary
   */
  scheduleTypeSwap(patternId: string, newEntity: PatternEntity): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    // Validate new entity
    const validation = this.factory.validateParameters(newEntity.type, newEntity.parameters);
    if (!validation.valid) {
      this.emit('typeSwapFailed', {
        patternId,
        error: `Validation failed: ${JSON.stringify(validation.errors)}`
      });
      return;
    }

    // Schedule swap
    pattern.pendingTypeSwap = true;
    pattern.targetType = newEntity.type;
    pattern.targetEntity = newEntity;
    pattern.swapScheduledAt = process.hrtime.bigint();

    this.emit('typeSwapScheduled', {
      patternId,
      oldType: pattern.entity.type,
      newType: newEntity.type
    });
  }

  /**
   * Execute pending type swap (called at cycle boundary)
   */
  private executeTypeSwap(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern || !pattern.pendingTypeSwap || !pattern.targetEntity) {
      return;
    }

    const startTime = process.hrtime.bigint();
    const oldInstance = pattern.patternInstance;
    const oldType = pattern.entity.type;

    try {
      // Create new instance
      const newInstance = this.factory.createPattern(pattern.targetEntity);

      // Create new generator function
      const newGenerator = (context: PatternContext) => {
        return newInstance.tick(context);
      };

      // Atomic swap
      pattern.patternInstance = newInstance;
      pattern.generator = newGenerator;
      pattern.entity = pattern.targetEntity;

      // Clear swap state
      pattern.pendingTypeSwap = false;
      pattern.targetType = null;
      pattern.targetEntity = null;
      pattern.swapScheduledAt = null;

      // Clean up old instance
      if (oldInstance && typeof oldInstance.destroy === 'function') {
        oldInstance.destroy();
      }

      const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // Convert to ms

      this.emit('typeSwapComplete', {
        patternId,
        oldType,
        newType: pattern.entity.type,
        duration
      });
    } catch (error) {
      this.rollbackTypeSwap(patternId, error as Error);
    }
  }

  /**
   * Rollback failed type swap
   */
  private rollbackTypeSwap(patternId: string, error: Error): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    // Clear swap state
    pattern.pendingTypeSwap = false;
    pattern.targetType = null;
    pattern.targetEntity = null;
    pattern.swapScheduledAt = null;

    this.emit('typeSwapFailed', {
      patternId,
      error: error.message
    });
  }

  // Modify onTick to check for pending type swaps
  private onTick(tick: number): void {
    // ... existing code ...

    for (const [id, pattern] of this.patterns.entries()) {
      // Check for new cycle
      const ticksPerCycle = ppq * 4 * pattern.entity.length;
      const isNewCycle = pattern.currentCycleStart === undefined ||
                        (tick - pattern.currentCycleStart) >= ticksPerCycle;

      if (isNewCycle) {
        pattern.currentCycleStart = tick;

        // Execute type swap if pending
        if (pattern.pendingTypeSwap) {
          this.executeTypeSwap(id);
        }

        // Apply parameter updates
        if (pattern.pendingUpdate) {
          pattern.pendingUpdate = false;
          this.emit('patternRegenerated', { id, tick, parameters: pattern.entity.parameters });
        }
      }

      // ... rest of existing tick logic ...
    }
  }
}
```

### Step 5: Add Type Change Detection to PatternFileWatcher

Extend PatternFileWatcher to detect type changes:

```typescript
export class PatternFileWatcher extends EventEmitter {
  private previousTypes: Map<string, PatternType> = new Map();

  private async handlePatternFileChange(filePath: string): Promise<void> {
    try {
      // Load updated pattern
      const pattern = PatternEntityLoader.loadFromFile(filePath);

      // Check for type change
      const previousType = this.previousTypes.get(pattern.id);
      const typeChanged = previousType && previousType !== pattern.type;

      if (typeChanged) {
        // Type change detected
        this.emit('typeChangeDetected', {
          patternId: pattern.id,
          oldType: previousType,
          newType: pattern.type,
          file: filePath
        });

        // Update tracked type
        this.previousTypes.set(pattern.id, pattern.type);

        // Emit for type swap scheduling
        this.emit('patternTypeChanged', { id: pattern.id, pattern });
      } else {
        // Regular parameter update
        this.pendingUpdates.set(pattern.id, pattern);
        this.emit('patternUpdated', { id: pattern.id, pattern });
      }

      // ... rest of existing logic ...
    } catch (error) {
      this.emit('error', error);
    }
  }
}
```

### Step 6: Wire Up in GenSeqEngine

Connect the components in the main engine:

```typescript
export class GenSeqEngine {
  private patternFileWatcher: PatternFileWatcher;
  private patternExecutor: PatternExecutor;

  private setupHotReload(): void {
    // Listen for type changes
    this.patternFileWatcher.on('patternTypeChanged', ({ id, pattern }) => {
      this.patternExecutor.scheduleTypeSwap(id, pattern);
    });

    // Listen for regular updates
    this.patternFileWatcher.on('patternUpdated', ({ id, pattern }) => {
      this.patternExecutor.updatePatternParameters(id, pattern.parameters);
    });

    // Forward type swap events
    this.patternExecutor.on('typeSwapComplete', (event) => {
      console.log(`Type swap complete: ${event.patternId} ${event.oldType} → ${event.newType} in ${event.duration}ms`);
    });

    this.patternExecutor.on('typeSwapFailed', (event) => {
      console.error(`Type swap failed: ${event.patternId}:`, event.error);
    });
  }
}
```

## Testing

### Unit Tests

Create test files following TDD principles:

```typescript
// packages/genseq-engine/tests/patterns/PatternFactory.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PatternFactory } from '../../src/patterns/PatternFactory';

describe('PatternFactory', () => {
  let factory: PatternFactory;

  beforeEach(() => {
    factory = new PatternFactory();
  });

  it('should create euclidean pattern with valid parameters', () => {
    const entity = {
      id: 'test',
      type: 'euclidean',
      enabled: true,
      bus: 'main',
      channel: 1,
      length: 1,
      parameters: {
        steps: 16,
        pulses: 4,
        note: 60,
        velocity: 100,
        duration: 0.25
      }
    };

    const pattern = factory.createPattern(entity);
    expect(pattern).toBeDefined();
    expect(pattern.tick).toBeDefined();
  });

  it('should reject invalid parameters', () => {
    const entity = {
      id: 'test',
      type: 'probability',
      parameters: {
        probability: 2.0, // Invalid: > 1
        density: 4
      }
    };

    const validation = factory.validateParameters(entity.type, entity.parameters);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContainEqual(
      expect.objectContaining({
        path: '/probability',
        message: expect.stringContaining('must be')
      })
    );
  });
});
```

### Integration Tests

Test the full type swap flow:

```typescript
// packages/genseq-engine/tests/integration/typeSwapIntegration.test.ts
describe('Type Swap Integration', () => {
  it('should swap from euclidean to probability at cycle boundary', async () => {
    // Create engine with euclidean pattern
    // Change pattern file to probability type
    // Wait for cycle boundary
    // Verify new pattern is active
    // Verify timing < 50ms
  });

  it('should handle all 12 type transitions', async () => {
    const types = ['euclidean', 'probability', 'phase', 'script'];

    for (const fromType of types) {
      for (const toType of types) {
        if (fromType === toType) continue;

        // Test transition from fromType to toType
        // Verify success and timing
      }
    }
  });
});
```

## Performance Validation

Monitor these metrics during development:

1. **Type swap latency**: Must be < 50ms
2. **Memory usage**: Check for leaks after 100 swaps
3. **CPU spike**: Should be < 10% during swap
4. **Transport continuity**: Zero interruption

Use the performance monitor:

```typescript
const startTime = performance.now();
// Perform type swap
const duration = performance.now() - startTime;
console.log(`Type swap completed in ${duration}ms`);
```

## Troubleshooting

### Common Issues

**Issue**: Type swap exceeds 50ms
- Check pattern constructor performance
- Profile schema validation
- Ensure no blocking I/O

**Issue**: Memory leak detected
- Verify destroy() is called on old instances
- Check for circular references
- Use heap snapshots to find retained objects

**Issue**: Transport interruption during swap
- Verify atomic swap at cycle boundary
- Check for exceptions in swap logic
- Ensure generator function is valid

**Issue**: Validation errors not clear
- Enhance error messages with file/line info
- Include parameter path in errors
- Show expected vs actual values

## Next Steps

After implementing the core functionality:

1. Run all tests to verify functionality
2. Performance benchmark all 12 transitions
3. Memory leak testing with extended sessions
4. Update VS Code extension for type change diagnostics
5. Document pattern type parameters in user guide

## Resources

- [Pattern Types Documentation](../001-midi-sequencer-engine/patterns.md)
- [Hot-Reload Architecture](../001-midi-sequencer-engine/hot-reload.md)
- [Performance Requirements](../../.specify/memory/constitution.md#iii-performance-as-contract)
- [Test-First Development](../../.specify/memory/constitution.md#ii-test-first-development)