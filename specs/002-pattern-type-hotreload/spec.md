# Feature Specification: Pattern Type Hot-Reload

**Feature Branch**: `002-pattern-type-hotreload`
**Created**: 2025-11-23
**Status**: Draft
**Input**: User description: "Pattern Type Hot-Reload Feature: A musician wants to change pattern generator types (euclidean → probability → phase → script) during live playback without restarting the engine, enabling creative experimentation with different algorithmic approaches while maintaining musical context."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live Type Experimentation During Performance (Priority: P1)

A musician is performing live with a Euclidean kick pattern and wants to instantly switch it to a probability-based pattern to explore a different rhythmic feel, without stopping the music or losing the current bar position.

**Why this priority**: This is the core value proposition of the feature—enabling seamless creative exploration during performance. Without transport interruption, musicians can experiment with different algorithmic approaches while maintaining musical flow and context.

**Independent Test**: Can be fully tested by starting engine playback with a Euclidean pattern, editing the pattern file to change type from "euclidean" to "probability" with valid parameters, saving the file, and verifying the pattern switches generators at the next cycle boundary without transport interruption and completes within 50ms.

**Acceptance Scenarios**:

1. **Given** the engine is playing a pattern with type "euclidean" (16 steps, 4 pulses), **When** user edits the pattern file to type "probability" with probability=0.75 and saves, **Then** the pattern switches to probability-based generation at the next cycle boundary, transport continues uninterrupted, and the change completes within 50ms
2. **Given** a pattern is mid-cycle when the file is saved, **When** the type change is detected, **Then** the current cycle completes with the old generator, and the new generator activates at the cycle boundary
3. **Given** multiple patterns are playing, **When** user changes the type of one pattern, **Then** only that pattern switches generators while all other patterns continue unchanged

---

### User Story 2 - Safe Type Changes with Validation (Priority: P2)

A musician attempts to change a pattern type but provides invalid parameters for the new type (e.g., probability value > 1.0), and the system should reject the change while continuing playback with the previous valid configuration.

**Why this priority**: Validation is critical for system stability—invalid type changes must never crash the engine or corrupt playback state. This builds on the basic type swap functionality with safety guarantees.

**Independent Test**: Can be fully tested by editing a pattern file to change type with intentionally invalid parameters, saving the file, and verifying the engine rejects the change, logs a clear error with file/line information, continues playing the previous valid pattern, and displays diagnostics in VS Code.

**Acceptance Scenarios**:

1. **Given** a valid Euclidean pattern is playing, **When** user changes type to "probability" with invalid parameter probability=2.0 (out of range 0-1) and saves, **Then** the engine rejects the update, logs error with file path and parameter details, and continues playing the Euclidean pattern
2. **Given** a pattern type change with missing required parameters, **When** the file is saved, **Then** validation fails before instance creation, error indicates missing parameters, and engine maintains previous state
3. **Given** a pattern type change with valid structure but runtime errors, **When** instance creation fails, **Then** the system rolls back to previous generator, emits typeSwapFailed event, and logs detailed error information

---

### User Story 3 - Multiple Type Transitions (Priority: P3)

A musician rapidly experiments with different pattern types during a creative session, switching from euclidean → probability → phase → script and back, verifying each transition works correctly and state doesn't corrupt across multiple swaps.

**Why this priority**: Comprehensive type coverage ensures the feature works for all pattern type combinations. This validates the n² type matrix and ensures the system handles state transitions correctly across multiple swaps.

**Independent Test**: Can be fully tested by sequentially changing a pattern through all type combinations (euclidean → probability → phase → script → euclidean), verifying each transition succeeds, and confirming no state corruption or memory leaks occur after multiple transitions.

**Acceptance Scenarios**:

1. **Given** a pattern starts as type "euclidean", **When** user changes to "probability", then "phase", then "script", then back to "euclidean", **Then** each transition completes successfully at cycle boundaries and the final Euclidean pattern plays correctly
2. **Given** rapid type changes occur (multiple file saves within one cycle), **When** changes are queued, **Then** only the most recent valid change is applied at the next cycle boundary, avoiding race conditions
3. **Given** a pattern has been swapped 10 times during a session, **When** monitoring memory usage, **Then** old pattern instances are properly destroyed and memory usage remains stable (no leaks)

---

### User Story 4 - Type-Specific Parameter Preservation (Priority: P4)

A musician wants to preserve common parameters (velocity, note, channel) when changing pattern types, while type-specific parameters (steps/pulses vs probability/density) are intentionally replaced with new values.

**Why this priority**: This enhances user experience by intelligently handling parameter transitions, but it's not essential for MVP. The basic type swap works with full parameter replacement; this adds convenience.

**Independent Test**: Can be fully tested by changing a pattern type while specifying common parameters in the new configuration, verifying common parameters are used from the new config, and confirming type-specific parameters are cleanly replaced without attempting invalid mappings.

**Acceptance Scenarios**:

1. **Given** an Euclidean pattern with velocity=80, note=60, steps=16, pulses=4, **When** user changes to "probability" with velocity=80, note=60, probability=0.75, **Then** the new pattern uses velocity=80 and note=60 from the new config, and probability parameters replace Euclidean parameters
2. **Given** a pattern type change specifies only type-specific parameters, **When** common parameters are omitted from new config, **Then** system uses schema defaults for missing common parameters (as per current behavior for new patterns)
3. **Given** a type change with invalid parameter preservation attempt, **When** user tries to specify both old and new type parameters, **Then** validation fails and clearly indicates parameter conflict

---

### Edge Cases

- What happens when a pattern type change occurs during a cycle regeneration triggered by parameter update?
- How does the system handle simultaneous type changes to multiple patterns?
- What happens when a script pattern type change references a non-existent or invalid script file?
- How does the system handle type changes when the pattern is disabled (enabled: false)?
- What happens when type changes occur faster than cycle boundaries (queue multiple swaps)?
- How does the system handle type changes with valid structure but parameters that cause runtime errors in pattern constructors?
- What happens when old pattern instances have in-flight state (e.g., probability seed, phase accumulator) during swap?
- How does the system handle rollback if new instance creation succeeds but generator function assignment fails?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect pattern type field changes in pattern configuration files during hot-reload
- **FR-002**: System MUST validate type-specific parameters before creating new pattern instances
- **FR-003**: System MUST reject invalid type changes and maintain playback with previous valid configuration
- **FR-004**: System MUST destroy old pattern instances and create new instances atomically at cycle boundaries
- **FR-005**: System MUST update generator functions when pattern types change
- **FR-006**: System MUST complete type swaps within 50ms (aligned with existing hot-reload performance requirement)
- **FR-007**: System MUST queue pending type swaps and apply them at the next cycle boundary to avoid transport interruption
- **FR-008**: System MUST support all type transitions: euclidean ↔ probability ↔ phase ↔ script (n² combinations where n=4)
- **FR-009**: System MUST emit events for type swap lifecycle: typeChangeDetected, typeSwapScheduled, typeSwapComplete, typeSwapFailed
- **FR-010**: System MUST log clear error messages with file path and parameter details when type swaps fail
- **FR-011**: System MUST prevent memory leaks by properly destroying old pattern instances before creating new ones
- **FR-012**: System MUST rollback to previous generator if new instance creation or assignment fails
- **FR-013**: System MUST handle simultaneous parameter updates and type changes by applying type swap first, then parameter updates
- **FR-014**: System MUST track previous pattern types to detect type changes during hot-reload
- **FR-015**: System MUST centralize pattern instance creation and validation in a PatternFactory

### Key Entities

- **PatternFactory**: Centralized factory for creating pattern instances from entity configurations, validating type-specific parameters, and generating pattern generator functions
- **ActivePattern (Extended)**: Existing pattern execution state extended with type swap tracking fields: pendingTypeSwap (boolean), targetType (PatternType), targetEntity (PatternEntity)
- **PatternFileWatcher (Extended)**: Existing file watcher extended with type change detection: previousTypes (Map<string, PatternType>) to track initial and current types
- **TypeSwapEvent**: Event emitted during type swap lifecycle containing pattern ID, old type, new type, timestamp, and success/failure status

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Musicians can change pattern types during live playback and hear the new generator within one cycle (typically 2-4 seconds at 120 BPM with 16-step patterns)
- **SC-002**: Type swap operations complete within 50ms from file save to new generator activation, maintaining consistency with existing hot-reload performance
- **SC-003**: System maintains 100% transport continuity during type swaps—no dropped beats, timing glitches, or position resets
- **SC-004**: Invalid type changes are rejected within 50ms with clear error messages, and playback continues uninterrupted with previous configuration
- **SC-005**: All 12 type combination transitions (4 types × 3 other types) succeed in automated tests with 100% pass rate
- **SC-006**: System handles 10+ consecutive type swaps on a single pattern without memory leaks (memory usage remains stable ±5%)
- **SC-007**: 95% of type swap operations succeed on first attempt when provided valid configurations
- **SC-008**: Zero engine crashes or state corruption events occur during type swap operations in comprehensive test suite (20-25 test cases)

## Assumptions

- Pattern instances implement a common interface with tick() method that accepts PatternContext and returns MidiEvent[]
- All pattern types support a destroy() lifecycle method for cleanup (or this will be added during implementation)
- Cycle boundaries are already detected by existing PatternExecutor logic (from Phase 2 hot-reload implementation)
- ConfigLoader and file watching infrastructure from Phase 2 can be extended for type change detection
- Pattern entity loaders (PatternEntityLoader.loadFromFile) already validate entity structure and will be extended for type-specific parameter validation
- The existing SchemaValidator can validate type-specific parameters or will be integrated with PatternFactory validation
- Performance requirement of <50ms for hot-reload applies to type swaps (same as parameter hot-reload from User Story 2)
- Pattern types are limited to: euclidean, probability, phase, script (n=4 types)

## Dependencies

- **Existing Feature**: User Story 2 (Live Configuration Hot-Reload) must be complete—requires PatternFileWatcher, ConfigLoader, cycle boundary detection, and hot-reload coordinator infrastructure
- **Existing Feature**: Pattern execution system from User Story 1—requires PatternExecutor, Clock, Scheduler, and pattern instance architecture
- **Pattern Implementations**: Probability, phase, and script pattern types must exist (or will be implemented as part of this feature if not yet complete)
- **Test Infrastructure**: Vitest testing framework and integration test patterns from Phase 2
- **Type Definitions**: PatternContext, MidiEvent, PatternGeneratorFn interfaces from genseq-patterns package

## Out of Scope

- Automatic parameter mapping between pattern types (e.g., translating steps/pulses to probability/density)—users must provide complete new configurations
- Gradual crossfade or transition animations between old and new generators—swaps are instantaneous at cycle boundaries
- Undo/redo functionality for type changes—users must manually revert file changes
- Visual feedback in VS Code extension showing type swap progress—basic diagnostics only via error messages
- Parameter preservation hints (e.g., `_preserveFromPrevious` metadata field)—deferred to future enhancement
- Custom validation rules beyond standard parameter ranges—pattern constructors handle validation as currently implemented

## Non-Functional Requirements

- **Performance**: Type swap operations complete within 50ms from file detection to generator activation
- **Reliability**: Zero data corruption or state inconsistencies during type swaps—rollback guarantees maintain valid state
- **Memory Management**: Old pattern instances fully destroyed before new instances created—no memory leaks after multiple swaps
- **Error Handling**: All type swap failures log actionable errors with file path, line number (if applicable), parameter details, and validation messages
- **Backward Compatibility**: Existing pattern files without type changes continue to work unchanged—no breaking changes to configuration format
