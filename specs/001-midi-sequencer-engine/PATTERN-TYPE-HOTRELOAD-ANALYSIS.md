# Pattern Type Hot-Reload Analysis

**Status**: Not Yet Implemented
**Complexity**: High (8-12 hours estimated)
**Risk**: Medium-High (complex state management, generator swapping)
**Priority**: Low (nice-to-have feature, not critical for MVP)

---

## Overview

This document analyzes the remaining work to support hot-reload for pattern `type` field changes (e.g., switching from `euclidean` to `probability` during playback without restarting the engine).

### Current State

As of the latest implementation, the following hot-reload capabilities are **fully supported**:

✅ Pattern entity fields (`note`, `channel`, `enabled`, `bus`)
✅ Pattern parameters (`steps`, `pulses`, `velocity`, `gateLength`, etc.)
✅ Route configuration (`device`, `channel`, `transform`)
✅ Clock BPM changes

❌ **Pattern type changes** - Requires engine restart

---

## Problem Statement

When a user changes the `type` field in a pattern file:

```json
// Before: patterns/kick.json
{
  "id": "kick",
  "type": "euclidean",  // ← Change this
  "euclidean": {
    "steps": 16,
    "pulses": 4
  }
}

// After: patterns/kick.json
{
  "id": "kick",
  "type": "probability",  // ← To this
  "probability": {
    "probability": 0.75,
    "density": 0.5
  }
}
```

**Current behavior**: Pattern continues using old generator; parameters are ignored
**Desired behavior**: Pattern switches to new generator type at cycle boundary

---

## Technical Challenges

### 1. Generator Function Incompatibility

**Current Architecture**:
```typescript
// PatternExecutor.ts (ActivePattern interface)
interface ActivePattern {
  entity: PatternEntity;
  generator: PatternGeneratorFn | null;  // ← Function pointer
  patternInstance?: any;  // ← Type-specific instance
  enabled: boolean;
  lastTick: number;
  pendingUpdate: boolean;
  currentCycleStart?: number;
}
```

**Problem**: Each pattern type has a different generator signature:

```typescript
// Euclidean generator
euclideanPattern.tick(context: PatternContext): MidiEvent[]

// Probability generator (hypothetical)
probabilityPattern.tick(context: PatternContext): MidiEvent[]

// Phase generator (hypothetical)
phasePattern.tick(context: PatternContext): MidiEvent[]
```

While the signatures are the same, the **internal state** and **helper dependencies** differ:
- Euclidean uses Bjorklund algorithm helpers
- Probability uses random number generation with seed state
- Phase uses accumulator state for LFO-based patterns

**Impact**: Can't simply call `pattern.patternInstance.updateConfig()` with new parameters—the instance itself is the wrong type.

---

### 2. Parameter Incompatibility

**Current Parameter Translation**:
```typescript
// GenSeqEngine.ts:524-526
if (patternEntity.type === 'euclidean' && translatedParams.gateLength !== undefined) {
  translatedParams.duration = translatedParams.gateLength;
}
```

**Problem**: Parameter mappings are type-specific and non-transferable:

| Euclidean Parameters | Probability Parameters | Phase Parameters |
|---------------------|------------------------|------------------|
| `steps` (int)       | `probability` (0-1)    | `frequency` (Hz) |
| `pulses` (int)      | `density` (0-1)        | `waveform` (enum)|
| `rotation` (int)    | `seed` (int)           | `phase` (0-360)  |
| `velocity` (0-127)  | `velocity` (0-127)     | `velocity` (0-127)|

**No safe mapping**: `steps: 16` has no equivalent in `probability` or `phase` types.

**Impact**: Type swap requires **complete parameter replacement**, not parameter merging.

---

### 3. State Lifecycle Management

**Current Update Flow**:
```typescript
// PatternExecutor.ts:187-233 (updatePatternParameters)
updatePatternParameters(id: string, parameters: Record<string, any>): void {
  const pattern = this.patterns.get(id);

  // Separate entity fields from parameters
  Object.assign(pattern.entity, entityUpdates);  // ← Direct mutation

  pattern.entity.parameters = {
    ...pattern.entity.parameters,
    ...parameterUpdates  // ← Deep merge
  };

  // Update instance if available
  if (pattern.patternInstance && typeof pattern.patternInstance.updateConfig === 'function') {
    pattern.patternInstance.updateConfig(parameters);  // ← Instance method call
  }

  pattern.pendingUpdate = true;  // ← Flag for cycle boundary reload
}
```

**Problem**: Type swap requires **destroying** the old instance and **creating** a new one:

```typescript
// Hypothetical type swap flow
if (oldType !== newType) {
  // 1. Destroy old instance state
  if (pattern.patternInstance && typeof pattern.patternInstance.destroy === 'function') {
    pattern.patternInstance.destroy();
  }

  // 2. Create new instance
  const newInstance = createPatternInstance(newType, newParameters);

  // 3. Update generator function
  pattern.generator = (context) => newInstance.tick(context);

  // 4. Store new instance
  pattern.patternInstance = newInstance;
}
```

**Challenges**:
- Old instance may have in-flight state (e.g., probability seed, phase accumulator)
- New instance needs **full initialization** at cycle boundary
- What if creation fails? Need rollback to old instance
- Race condition: file change during cycle regeneration

**Impact**: Requires new state machine with `pendingTypeSwap` flag separate from `pendingUpdate`.

---

### 4. Validation Ordering

**Current Validation Flow**:
```typescript
// RouteEntityLoader (example)
RouteEntityLoader.loadFromFile(filePath)  // ← Validates against RouteEntity schema
```

**Problem**: Type-specific parameter validation must happen **before** type swap:

```typescript
// Desired flow
1. Load file → parse JSON
2. Validate entity structure (type, id, bus, etc.)
3. **Validate type-specific parameters** (e.g., euclidean.steps must be integer)
4. If invalid → reject entire change, keep old pattern
5. If valid → proceed with type swap
```

**Current gap**: No centralized type-specific parameter validation. Each pattern type validates internally:

```typescript
// EuclideanPattern.ts (example)
constructor(config: EuclideanPatternConfig) {
  if (config.steps <= 0 || !Number.isInteger(config.steps)) {
    throw new Error('steps must be positive integer');
  }
  // ...
}
```

**Impact**: Need to call pattern constructors **during validation phase** to verify parameters, then discard instance if file watcher decides not to apply change.

---

### 5. Testing Complexity

**Current Test Coverage**:
- Pattern parameter hot-reload: 6 tests (PatternFileWatcher.test.ts)
- Route hot-reload: 6 tests (RouteFileWatcher.test.ts)
- Clock hot-reload: 6 tests (ClockFileWatcher.test.ts)

**Pattern Type Hot-Reload Test Matrix**:

| From/To     | Euclidean | Probability | Phase | Script |
|-------------|-----------|-------------|-------|--------|
| Euclidean   | N/A       | ✓ Test    | ✓ Test| ✓ Test|
| Probability | ✓ Test  | N/A         | ✓ Test| ✓ Test|
| Phase       | ✓ Test  | ✓ Test    | N/A   | ✓ Test|
| Script      | ✓ Test  | ✓ Test    | ✓ Test| N/A    |

**Total**: 12 type-combination tests (n² where n=4 types)

**Plus edge cases**:
- Type swap with invalid parameters → rollback
- Type swap mid-cycle → waits for cycle boundary
- Type swap with simultaneous param update → merge both
- Type swap during pattern regeneration → queue second swap
- Type swap when pattern disabled → apply immediately or wait?

**Impact**: ~20-25 test cases required for comprehensive coverage.

---

## Recommended Approach

### Phase 1: Pattern Factory Infrastructure

**Goal**: Centralize pattern instance creation and validation

```typescript
// NEW FILE: src/patterns/PatternFactory.ts
export class PatternFactory {
  /**
   * Create pattern instance from entity
   * Validates parameters and throws if invalid
   */
  static createInstance(patternEntity: PatternEntity): any {
    switch (patternEntity.type) {
      case 'euclidean':
        return this.createEuclidean(patternEntity);
      case 'probability':
        return this.createProbability(patternEntity);
      case 'phase':
        return this.createPhase(patternEntity);
      case 'script':
        return this.createScript(patternEntity);
      default:
        throw new Error(`Unknown pattern type: ${patternEntity.type}`);
    }
  }

  /**
   * Create generator function for pattern instance
   */
  static createGenerator(instance: any): PatternGeneratorFn {
    return (context: PatternContext) => instance.tick(context);
  }

  /**
   * Validate parameters without creating instance
   * Returns validation errors or null if valid
   */
  static validateParameters(patternEntity: PatternEntity): string[] | null {
    try {
      // Attempt to create instance (validation happens in constructor)
      this.createInstance(patternEntity);
      return null;  // Valid
    } catch (error) {
      return [error.message];
    }
  }

  private static createEuclidean(entity: PatternEntity): EuclideanPattern {
    return new EuclideanPattern({
      steps: entity.parameters.steps || 16,
      pulses: entity.parameters.pulses || 4,
      rotation: entity.parameters.rotation || 0,
      note: entity.note || 60,
      velocity: entity.parameters.velocity || 100,
      duration: entity.parameters.gateLength || 0.25
    });
  }

  // Similar methods for probability, phase, script...
}
```

**Benefits**:
- Single source of truth for pattern creation
- Validation happens before instance creation
- Easy to extend for new pattern types

---

### Phase 2: PatternExecutor Type Swap State Machine

**Goal**: Add type-swap-specific state tracking

```typescript
// MODIFIED: src/patterns/PatternExecutor.ts
interface ActivePattern {
  entity: PatternEntity;
  generator: PatternGeneratorFn | null;
  patternInstance?: any;
  enabled: boolean;
  lastTick: number;
  pendingUpdate: boolean;          // ← Existing: parameter updates
  pendingTypeSwap: boolean;         // ← NEW: type swap flag
  targetType?: PatternType;         // ← NEW: type to swap to
  targetEntity?: PatternEntity;     // ← NEW: full entity for swap
  currentCycleStart?: number;
}

class PatternExecutor extends EventEmitter {
  // ...

  /**
   * Handle type swap (called at cycle boundary)
   */
  private applyTypeSwap(pattern: ActivePattern): void {
    if (!pattern.pendingTypeSwap || !pattern.targetEntity) {
      return;
    }

    try {
      // 1. Destroy old instance
      if (pattern.patternInstance && typeof pattern.patternInstance.destroy === 'function') {
        pattern.patternInstance.destroy();
      }

      // 2. Create new instance using factory
      const newInstance = PatternFactory.createInstance(pattern.targetEntity);
      const newGenerator = PatternFactory.createGenerator(newInstance);

      // 3. Update pattern
      pattern.entity = pattern.targetEntity;
      pattern.generator = newGenerator;
      pattern.patternInstance = newInstance;
      pattern.pendingTypeSwap = false;
      pattern.targetType = undefined;
      pattern.targetEntity = undefined;

      // 4. Emit success event
      this.emit('typeSwapComplete', {
        id: pattern.entity.id,
        oldType: pattern.entity.type,
        newType: pattern.targetEntity.type
      });

    } catch (error) {
      // 5. Rollback on failure (keep old pattern)
      this.emit('typeSwapFailed', {
        id: pattern.entity.id,
        error: error.message
      });

      pattern.pendingTypeSwap = false;
      pattern.targetType = undefined;
      pattern.targetEntity = undefined;
    }
  }

  /**
   * Modified tick() to apply type swaps at cycle boundaries
   */
  tick(): void {
    const currentTick = this.clock.getPosition().tick;

    for (const [id, pattern] of this.patterns.entries()) {
      // ... existing cycle boundary detection ...

      if (atCycleBoundary) {
        // Apply type swap FIRST (before regeneration)
        if (pattern.pendingTypeSwap) {
          this.applyTypeSwap(pattern);
        }

        // Then regenerate pattern with new type
        if (pattern.pendingUpdate || pattern.pendingTypeSwap) {
          this.regeneratePattern(id, pattern);
        }
      }

      // ... rest of tick logic ...
    }
  }
}
```

---

### Phase 3: PatternFileWatcher Type Detection

**Goal**: Detect type changes in file watcher

```typescript
// MODIFIED: src/hotreload/PatternFileWatcher.ts
export class PatternFileWatcher extends EventEmitter {
  private previousTypes: Map<string, PatternType> = new Map();  // ← NEW

  /**
   * Register initial pattern type
   */
  registerPattern(patternId: string, type: PatternType): void {
    this.previousTypes.set(patternId, type);
  }

  /**
   * Handle pattern file change
   */
  private async handlePatternFileChange(filePath: string): Promise<void> {
    try {
      const patternEntity = PatternEntityLoader.loadFromFile(filePath);

      // Detect type change
      const previousType = this.previousTypes.get(patternEntity.id);
      const typeChanged = previousType !== undefined && previousType !== patternEntity.type;

      // Validate type-specific parameters
      const validationErrors = PatternFactory.validateParameters(patternEntity);
      if (validationErrors) {
        this.emit('config:error', {
          error: new Error(`Invalid parameters: ${validationErrors.join(', ')}`),
          details: { file: filePath, patternId: patternEntity.id }
        });
        return;  // Reject entire change
      }

      // Queue update
      this.pendingUpdates.set(patternEntity.id, patternEntity);
      this.previousTypes.set(patternEntity.id, patternEntity.type);

      // Emit type change event
      if (typeChanged) {
        this.emit('typeChangeDetected', {
          patternId: patternEntity.id,
          oldType: previousType,
          newType: patternEntity.type
        });
      }

      // Schedule swap at cycle boundary
      this.emit('config:swapScheduled', {
        file: filePath,
        patternId: patternEntity.id,
        typeChanged,
        scheduledFor: 'next cycle boundary'
      });

    } catch (error) {
      this.emit('config:error', { error, details: { file: filePath } });
    }
  }
}
```

---

### Phase 4: GenSeqEngine Integration

**Goal**: Wire up type swap handling

```typescript
// MODIFIED: src/GenSeqEngine.ts
export class GenSeqEngine extends EventEmitter {
  private initialPatternTypes: Map<string, PatternType> = new Map();  // ← NEW

  async loadProject(projectPath: string): Promise<void> {
    // ... existing code ...

    // Load patterns
    for (const pattern of patterns) {
      this.loadPattern(pattern);

      // Store initial type for hot-reload tracking
      this.initialPatternTypes.set(pattern.id, pattern.type);
    }

    // Start watching patterns directory
    if (this.hotReloadCoordinator) {
      this.patternFileWatcher = new PatternFileWatcher({
        clock: this.clock,
        patternsPath,
        swapAtCycleBoundary: true
      });

      // Register initial types
      for (const [patternId, type] of this.initialPatternTypes.entries()) {
        this.patternFileWatcher.registerPattern(patternId, type);
      }

      // Handle type change events
      this.patternFileWatcher.on('typeChangeDetected', (event: any) => {
        this.handlePatternTypeChange(event.patternId, event.oldType, event.newType);
      });

      // ... existing event handlers ...
    }
  }

  /**
   * Handle pattern type change
   */
  private handlePatternTypeChange(patternId: string, oldType: PatternType, newType: PatternType): void {
    // PatternExecutor will handle the actual swap at cycle boundary
    // Just emit event for monitoring
    this.emit('pattern:typeChanging', {
      id: patternId,
      oldType,
      newType,
      timestamp: Date.now()
    });
  }

  /**
   * Modified reloadPattern to handle type swaps
   */
  private reloadPattern(id: string, patternEntity: PatternEntity): void {
    try {
      const existingPattern = this.patternExecutor.getPattern(id);
      const typeChanged = existingPattern && existingPattern.entity.type !== patternEntity.type;

      if (typeChanged) {
        // Type swap: queue entire entity replacement
        this.patternExecutor.queueTypeSwap(id, patternEntity);
      } else {
        // Parameter update: use existing logic
        const translatedParams = this.translateParameters(patternEntity);
        this.patternExecutor.updatePatternParameters(id, translatedParams);
      }

    } catch (error) {
      this.emit('error', { source: 'reloadPattern', error, patternId: id });
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// NEW FILE: tests/unit/PatternFactory.test.ts
describe('PatternFactory', () => {
  it('should create euclidean pattern from entity', () => {
    const entity = { type: 'euclidean', parameters: { steps: 16, pulses: 4 } };
    const instance = PatternFactory.createInstance(entity);
    expect(instance).toBeInstanceOf(EuclideanPattern);
  });

  it('should validate euclidean parameters', () => {
    const entity = { type: 'euclidean', parameters: { steps: -1 } };
    const errors = PatternFactory.validateParameters(entity);
    expect(errors).toContain('steps must be positive integer');
  });

  it('should create generator function', () => {
    const instance = new EuclideanPattern({ steps: 16, pulses: 4 });
    const generator = PatternFactory.createGenerator(instance);
    expect(typeof generator).toBe('function');
  });
});
```

### Integration Tests

```typescript
// NEW FILE: tests/integration/PatternTypeSwap.test.ts
describe('Pattern Type Swap', () => {
  it('should swap euclidean → probability at cycle boundary', async () => {
    // ... create pattern, start playback ...

    // Change type
    await fs.writeFile(patternFile, JSON.stringify({
      type: 'probability',
      probability: { probability: 0.75 }
    }));

    // Wait for cycle boundary
    await waitForCycleBoundary();

    // Verify new type is active
    const pattern = executor.getPattern('test');
    expect(pattern.entity.type).toBe('probability');
  });

  it('should rollback on invalid parameters', async () => {
    // ... start with valid euclidean ...

    // Try to swap to probability with invalid params
    await fs.writeFile(patternFile, JSON.stringify({
      type: 'probability',
      probability: { probability: 2.0 }  // Invalid: > 1.0
    }));

    await waitForCycleBoundary();

    // Verify rollback to euclidean
    const pattern = executor.getPattern('test');
    expect(pattern.entity.type).toBe('euclidean');
  });
});
```

---

## Risk Assessment

### High Risk

1. **State Corruption**: If type swap fails mid-swap, pattern may be left in inconsistent state
   - **Mitigation**: Atomic swap with rollback on failure

2. **Race Conditions**: Multiple file changes during single cycle
   - **Mitigation**: Queue type swaps, apply at next cycle boundary

3. **Memory Leaks**: Old pattern instances not properly destroyed
   - **Mitigation**: Explicit `destroy()` method in pattern lifecycle

### Medium Risk

1. **Testing Complexity**: n² test matrix for type combinations
   - **Mitigation**: Prioritize euclidean ↔ probability (most common)

2. **Parameter Validation**: Each pattern type has unique validation rules
   - **Mitigation**: Centralize validation in PatternFactory

### Low Risk

1. **Performance**: Pattern instance creation overhead at cycle boundary
   - **Mitigation**: Cycle boundaries are infrequent (~2s at 120 BPM)

---

## Implementation Estimate

### Time Breakdown

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | PatternFactory infrastructure | 2 hours |
| 2 | PatternExecutor state machine | 3 hours |
| 3 | PatternFileWatcher type detection | 1 hour |
| 4 | GenSeqEngine integration | 1 hour |
| 5 | Unit tests (PatternFactory) | 1 hour |
| 6 | Integration tests (type swaps) | 2 hours |
| 7 | Documentation updates | 1 hour |
| 8 | Manual testing & debugging | 1 hour |

**Total**: ~12 hours

### Phases

- **Phase 1-2**: Core infrastructure (5 hours)
- **Phase 3-4**: Integration (2 hours)
- **Phase 5-6**: Testing (3 hours)
- **Phase 7-8**: Polish (2 hours)

---

## Alternative Approaches Considered

### Alternative 1: Restart Pattern on Type Change

**Approach**: Stop pattern, destroy instance, create new one, restart

**Pros**:
- Simpler implementation (no cycle boundary coordination)
- No state machine complexity

**Cons**:
- **Transport interruption** (violates hot-reload principle)
- Pattern position resets to bar 1
- User hears audible glitch

**Verdict**: ❌ Rejected (defeats purpose of hot-reload)

---

### Alternative 2: Parameter Mapping Layer

**Approach**: Create automatic parameter translation between types

```typescript
// Example: euclidean → probability
{
  steps: 16,
  pulses: 4
}
→
{
  probability: pulses / steps,  // 4/16 = 0.25
  density: pulses / steps        // Same as probability
}
```

**Pros**:
- User doesn't lose pattern characteristics on type change

**Cons**:
- **Lossy translation**: Not all parameters map cleanly
- **Confusing UX**: User changes type, parameters mysteriously change
- **Maintenance burden**: n² mapping functions

**Verdict**: ❌ Rejected (too complex, unclear UX)

---

### Alternative 3: Hybrid Approach (Recommended)

**Approach**: Combine full replacement with optional parameter hints

```typescript
// User can optionally preserve some parameters
{
  "type": "probability",
  "_preserveFromPrevious": ["velocity", "note"],  // Optional hint
  "probability": {
    "probability": 0.75
  }
}
```

**Pros**:
- Clean type swap (no automatic translation)
- User has control over what to preserve
- Explicit, predictable behavior

**Cons**:
- Requires extra metadata field

**Verdict**: ✅ Consider for future enhancement

---

## Conclusion

Pattern type hot-reload is **feasible but complex**. The recommended approach uses:

1. **PatternFactory** for centralized creation/validation
2. **Type swap state machine** in PatternExecutor
3. **Cycle boundary synchronization** (existing pattern)
4. **Explicit parameter replacement** (no automatic mapping)

**Estimated effort**: 12 hours
**Risk level**: Medium-High
**Priority**: Low (nice-to-have, not critical for MVP)

**Recommendation**: Defer to future phase after core functionality is stable. Users can work around by restarting the engine for now.

---

## Future Enhancements

If pattern type hot-reload is implemented, consider these extensions:

1. **Parameter Preservation Hints**: `_preserveFromPrevious` metadata field
2. **Type Transition Animations**: Gradual crossfade between old/new generators
3. **Undo/Redo**: Track type change history for quick rollback
4. **Visual Feedback**: IDE extension shows type swap progress in real-time

---

**Document Version**: 1.0
**Last Updated**: 2025-01-23
**Author**: Claude (Anthropic) via GenSeq Spec-Driven Development
