# Implementation Plan: Pattern Type Hot-Reload

**Branch**: `002-pattern-type-hotreload` | **Date**: 2025-11-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-pattern-type-hotreload/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable seamless pattern generator type changes during live playback (euclidean ↔ probability ↔ phase ↔ script) without transport interruption. Pattern instances are atomically swapped at cycle boundaries within 50ms, with validation, rollback, and state preservation guarantees.

## Technical Context

**Language/Version**: Node.js 18+, TypeScript 5+
**Primary Dependencies**: @genseq/engine, @genseq/patterns, chokidar (file watching), ajv (JSON Schema validation)
**Storage**: JSON/YAML configuration files (file-driven architecture)
**Testing**: Vitest with real MIDI loopback and timing precision tests
**Target Platform**: Cross-platform Node.js (macOS, Windows, Linux)
**Project Type**: Multi-library monorepo (pnpm workspaces + Turborepo)
**Performance Goals**: <50ms hot-reload completion, <1ms clock jitter, <5ms MIDI latency
**Constraints**: No transport interruption, memory-safe instance lifecycle, atomic state transitions
**Scale/Scope**: Support 4 pattern types × 3 target types = 12 type transitions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Implementation Gates (Phase -1)

**Gate 1: Specification Completeness** ✅
- [x] All user scenarios have acceptance criteria (4 stories with detailed scenarios)
- [x] All functional requirements are testable (FR-001 through FR-015)
- [x] All edge cases are documented (8 edge cases identified)
- [x] No unresolved [NEEDS CLARIFICATION] markers

**Gate 2: Constitutional Compliance** ✅
- [x] **Library-First Architecture (I)**: Extensions to existing @genseq/engine and @genseq/patterns libraries
- [x] **Test-First Development (II)**: Tests will be written before implementation for PatternFactory, type swap state machine
- [x] **Performance as Contract (III)**: <50ms type swap time is measurable and testable
- [x] **Schema-Driven Validation (IV)**: Type-specific parameter validation via JSON Schema
- [x] **Declarative, File-Driven (V)**: Type changes detected from file edits, hot-reload without restart
- [x] **VS Code as Primary UI (VI)**: Error diagnostics shown in VS Code Problems panel
- [x] **Script Extensibility with Safety (VII)**: Script pattern type runs in isolated sandbox
- [x] **Bidirectional MIDI Control (VIII)**: N/A for this feature

**Gate 3: Test-First Readiness** 🔄
- [ ] Test files are created and failing (will be created in Phase 0)
- [ ] Test coverage approved by reviewer (pending test creation)
- [ ] Testing approach validated against Principle II (approach documented below)

## Project Structure

### Documentation (this feature)

```text
specs/002-pattern-type-hotreload/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/genseq-engine/
├── src/
│   ├── patterns/
│   │   ├── PatternFactory.ts           # NEW: Centralized pattern creation
│   │   ├── PatternExecutor.ts          # EXTEND: Add type swap state machine
│   │   └── ActivePattern.ts            # EXTEND: Add pendingTypeSwap fields
│   ├── config/
│   │   ├── PatternFileWatcher.ts       # EXTEND: Add type change detection
│   │   └── ConfigLoader.ts             # EXISTING: Reuse hot-reload infrastructure
│   └── events/
│       └── TypeSwapEvent.ts            # NEW: Type swap lifecycle events
└── tests/
    ├── patterns/
    │   ├── PatternFactory.test.ts      # NEW: Factory validation tests
    │   ├── PatternExecutor.typeSwap.test.ts  # NEW: Type swap state machine tests
    │   └── PatternFileWatcher.typeChange.test.ts  # NEW: Type detection tests
    └── integration/
        └── typeSwapIntegration.test.ts # NEW: End-to-end type swap tests

packages/genseq-patterns/
├── src/
│   ├── probability/                    # NEW: Probability pattern implementation
│   │   └── ProbabilityPattern.ts
│   ├── phase/                          # NEW: Phase pattern implementation
│   │   └── PhasePattern.ts
│   ├── script/                         # EXISTING: Script pattern (if not already implemented)
│   │   └── ScriptPattern.ts
│   └── registry/
│       └── PatternRegistry.ts          # EXTEND: Register new pattern types
└── tests/
    ├── probability/
    │   └── ProbabilityPattern.test.ts  # NEW: Probability pattern tests
    └── phase/
        └── PhasePattern.test.ts        # NEW: Phase pattern tests
```

**Structure Decision**: Extend existing monorepo structure by adding PatternFactory to centralize pattern creation, extending PatternExecutor with type swap state machine, and implementing missing pattern types (probability, phase) in the patterns package. No new packages needed - all changes are extensions to existing libraries per Constitutional Principle I.

## Complexity Tracking

> No constitution violations requiring justification. All changes are extensions to existing libraries within the 3-library architecture.

## Phase 0: Research & Investigation

### Research Tasks

1. **Pattern Type Implementation Status**
   - Verify which pattern types exist (euclidean confirmed, probability/phase/script need verification)
   - Document pattern interface requirements (tick(), destroy() methods)
   - Identify parameter schemas for each pattern type

2. **Hot-Reload Infrastructure Analysis**
   - Study existing PatternFileWatcher implementation from User Story 2
   - Understand cycle boundary detection mechanism in PatternExecutor
   - Review ConfigLoader dual-buffer pattern for atomic swaps

3. **State Machine Design Patterns**
   - Research finite state machine patterns for type swap lifecycle
   - Investigate atomic swap patterns for zero-downtime transitions
   - Study rollback mechanisms for failed swaps

4. **Performance Optimization Strategies**
   - Profile existing hot-reload performance baseline
   - Research object pooling for pattern instance reuse
   - Investigate memory management patterns for instance lifecycle

### Output: research.md

Will contain:
- Pattern type implementation gaps and requirements
- Hot-reload infrastructure integration points
- State machine design decisions
- Performance optimization approach

## Phase 1: Design & Contracts

### Data Model Extensions

**PatternFactory**
```typescript
interface PatternFactory {
  createPattern(entity: PatternEntity): PatternInstance;
  validateParameters(type: PatternType, params: Record<string, any>): ValidationResult;
  getParameterSchema(type: PatternType): JSONSchema;
}
```

**ActivePattern Extensions**
```typescript
interface ActivePattern {
  // Existing fields...

  // Type swap tracking
  pendingTypeSwap: boolean;
  targetType: PatternType | null;
  targetEntity: PatternEntity | null;
  swapScheduledAt: bigint | null;
}
```

**TypeSwapEvent**
```typescript
interface TypeSwapEvent {
  patternId: string;
  oldType: PatternType;
  newType: PatternType;
  timestamp: bigint;
  status: 'detected' | 'scheduled' | 'complete' | 'failed';
  error?: string;
}
```

### API Contracts

**PatternExecutor Extensions**
```typescript
interface PatternExecutor {
  // Existing methods...

  // Type swap API
  scheduleTypeSwap(patternId: string, newEntity: PatternEntity): void;
  executeTypeSwap(patternId: string): void;
  rollbackTypeSwap(patternId: string, error: Error): void;
}
```

**PatternFileWatcher Extensions**
```typescript
interface PatternFileWatcher {
  // Existing methods...

  // Type change detection
  private previousTypes: Map<string, PatternType>;
  detectTypeChange(patternId: string, entity: PatternEntity): boolean;
}
```

### Performance Contracts

- Type swap completion: <50ms from detection to activation
- Memory overhead: <1MB per pattern instance swap
- CPU spike: <10% during type swap operation
- Zero transport interruption: 0ms pause in clock/scheduler

### Output Files

- `data-model.md`: Entity relationships and state transitions
- `contracts/pattern-factory.yaml`: PatternFactory API specification
- `contracts/type-swap-events.yaml`: Event schemas
- `quickstart.md`: Developer guide for type swap implementation

## Phase 2: Task Generation

**Note**: Tasks will be generated by `/speckit.tasks` command after this plan is complete.

### Expected Task Categories

1. **Test Infrastructure** [P]
   - Create failing tests for PatternFactory
   - Create failing tests for type swap state machine
   - Create failing tests for type change detection

2. **Pattern Type Implementation** [P]
   - Implement ProbabilityPattern with tests
   - Implement PhasePattern with tests
   - Verify ScriptPattern implementation

3. **Core Infrastructure**
   - Implement PatternFactory with validation [D: 2]
   - Extend PatternExecutor with type swap state machine [D: 1,3]
   - Extend PatternFileWatcher with type detection [D: 3]

4. **Integration & Validation**
   - End-to-end type swap tests [D: 3]
   - Performance benchmarks [D: 3]
   - Memory leak tests [D: 3]

## Implementation Strategy

### Phase Approach

**Phase 1: PatternFactory Infrastructure**
- Centralize all pattern creation logic
- Implement type-specific parameter validation
- Add schema retrieval for each type
- Create factory tests first (TDD)

**Phase 2: Type Swap State Machine**
- Extend ActivePattern with swap tracking fields
- Implement swap scheduling at cycle boundaries
- Add atomic swap execution with rollback
- Create comprehensive state transition tests

**Phase 3: Type Change Detection**
- Extend PatternFileWatcher to track previous types
- Detect type field changes on file reload
- Trigger swap scheduling on type change
- Validate with integration tests

**Phase 4: Pattern Type Implementations**
- Implement missing pattern types (probability, phase)
- Ensure common interface compliance
- Add destroy() lifecycle method
- Create pattern-specific tests

### Testing Strategy

**Unit Tests**
- PatternFactory: Creation, validation, schema retrieval
- State machine: All state transitions, rollback scenarios
- Type detection: Change detection, false positive prevention

**Integration Tests**
- Full type swap flow: File edit → detection → swap → verification
- All 12 type transitions: Each combination tested
- Concurrent swaps: Multiple patterns changing simultaneously
- Failure scenarios: Invalid params, creation failures, rollback

**Performance Tests**
- Swap timing: Verify <50ms completion
- Memory stability: No leaks after 100 swaps
- CPU impact: Measure spike during swap
- Transport continuity: Zero interruption verification

### Risk Mitigation

**Risk 1: Pattern Interface Incompatibility**
- Mitigation: Validate interface compliance in PatternFactory
- Fallback: Add adapter layer if needed

**Risk 2: Cycle Boundary Race Conditions**
- Mitigation: Use atomic swap flags and mutex patterns
- Fallback: Queue swaps if multiple pending

**Risk 3: Memory Leaks from Old Instances**
- Mitigation: Explicit destroy() calls with verification
- Fallback: WeakMap for instance tracking

**Risk 4: Performance Regression**
- Mitigation: Continuous benchmarking during development
- Fallback: Optimize hot paths, consider caching

## Success Metrics

- [ ] All 12 type transitions pass automated tests
- [ ] <50ms swap time in 95% of operations
- [ ] Zero memory leaks after 100 consecutive swaps
- [ ] 100% transport continuity during swaps
- [ ] Clear error messages for all failure scenarios
- [ ] VS Code diagnostics for validation failures

## Next Steps

1. Execute Phase 0 research to resolve unknowns
2. Generate research.md with findings
3. Create data-model.md and contracts/
4. Update agent context with new patterns
5. Run `/speckit.tasks` to generate implementation tasks
6. Begin test-first implementation following tasks.md