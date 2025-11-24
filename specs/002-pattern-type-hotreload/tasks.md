# Tasks: Pattern Type Hot-Reload

**Feature**: 002-pattern-type-hotreload
**Input**: Design documents from `/specs/002-pattern-type-hotreload/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Tests WILL be written first following Test-First Development (Constitutional Principle II/Article III)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md, this is a multi-library monorepo:
- **genseq-engine**: `packages/genseq-engine/src/`
- **genseq-patterns**: `packages/genseq-patterns/src/`
- **Test files**: `packages/genseq-engine/tests/`, `packages/genseq-patterns/tests/`
- **Schemas**: `schemas/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new infrastructure needed - this feature extends existing monorepo structure

- [x] T001 Feature branch created and spec documents generated (completed by /speckit.specify)
- [x] T002 Implementation plan and contracts created (completed by /speckit.plan)

**Checkpoint**: Documentation ready - implementation can begin

---

## Phase 2: Foundational (Pattern Type Implementations)

**Purpose**: Implement missing pattern types (probability, phase) that ALL user stories depend on

**⚠️ CRITICAL**: These pattern types must exist before type swapping can be tested

**⚠️ CONSTITUTIONAL COMPLIANCE**: Test-First Development (Article III - NON-NEGOTIABLE)
Tests for pattern types MUST be written and fail BEFORE implementation begins.

### Test Creation (Red Phase - MUST FAIL)

- [x] T003 [P] Create ProbabilityPattern test suite in packages/genseq-patterns/tests/probability/ProbabilityPattern.test.ts (MUST FAIL initially)
- [x] T004 [P] Create PhasePattern test suite in packages/genseq-patterns/tests/phase/PhasePattern.test.ts (MUST FAIL initially)

**GATE: Verify both tests fail (Red phase) before proceeding** ✅ VERIFIED - Both tests failed with import errors

### Implementation (Green Phase - Make Tests Pass)

- [x] T005 [P] Implement ProbabilityPattern class with tick() method in packages/genseq-patterns/src/probability/ProbabilityPattern.ts
- [x] T006 [P] Implement PhasePattern class with tick() method in packages/genseq-patterns/src/phase/PhasePattern.ts
- [x] T007 Register probability and phase types in PatternRegistry in packages/genseq-patterns/src/index.ts (exports added)
- [x] T008 [P] Create probability pattern JSON schema in schemas/patterns/probability.schema.json
- [x] T009 [P] Create phase pattern JSON schema in schemas/patterns/phase.schema.json

**GATE: GREEN PHASE ACHIEVED - Both pattern types working** ✅ VERIFIED - 40+ tests passing for new pattern types

**Checkpoint**: All 4 pattern types now available (euclidean, probability, phase, script) - type swap implementation can begin

---

## Phase 3: User Story 1 - Live Type Experimentation During Performance (Priority: P1) 🎯 MVP

**Goal**: Musician can change pattern type (euclidean → probability → phase → script) during playback without transport interruption, with type swap completing at next cycle boundary within 50ms

**Independent Test**: Start engine playback with Euclidean pattern, edit pattern file to change type to "probability" with valid parameters, save file, verify pattern switches generators at next cycle boundary without transport interruption and completes within 50ms

### Test Creation for User Story 1 (Red Phase - MUST FAIL)

- [ ] T010 [P] [US1] Create PatternFactory unit test suite in packages/genseq-engine/tests/unit/PatternFactory.test.ts (MUST FAIL initially)
- [ ] T011 [P] [US1] Create PatternExecutor type swap test suite in packages/genseq-engine/tests/unit/PatternExecutor.typeSwap.test.ts (MUST FAIL initially)
- [ ] T012 [P] [US1] Create PatternFileWatcher type detection test suite in packages/genseq-engine/tests/unit/PatternFileWatcher.typeChange.test.ts (MUST FAIL initially)
- [ ] T013 [US1] Create end-to-end type swap integration test in packages/genseq-engine/tests/integration/typeSwapIntegration.test.ts (MUST FAIL initially)

**GATE: RED PHASE VERIFIED - All 4 test suites created and failing**

### Implementation for User Story 1

**Phase 1: PatternFactory Infrastructure**

- [ ] T014 [US1] Create PatternFactory class with createPattern() method in packages/genseq-engine/src/patterns/PatternFactory.ts
- [ ] T015 [US1] Implement validateParameters() method in PatternFactory for type-specific validation
- [ ] T016 [US1] Implement getParameterSchema() method in PatternFactory to return JSON schemas
- [ ] T017 [US1] Add createGenerator() helper method to PatternFactory for generator function creation

**Phase 2: Type Swap State Machine**

- [ ] T018 [US1] Extend ActivePattern interface with pendingTypeSwap, targetType, targetEntity, swapScheduledAt fields in packages/genseq-engine/src/patterns/PatternExecutor.ts
- [ ] T019 [US1] Implement scheduleTypeSwap() method in PatternExecutor to queue type changes
- [ ] T020 [US1] Implement applyTypeSwap() private method in PatternExecutor for cycle boundary execution
- [ ] T021 [US1] Implement rollbackTypeSwap() method in PatternExecutor for failure handling
- [ ] T022 [US1] Modify PatternExecutor.tick() to detect cycle boundaries and apply pending type swaps

**Phase 3: Type Detection**

- [ ] T023 [US1] Add previousTypes Map<string, PatternType> to PatternFileWatcher in packages/genseq-engine/src/hotreload/PatternFileWatcher.ts
- [ ] T024 [US1] Implement registerPattern() method in PatternFileWatcher to track initial pattern types
- [ ] T025 [US1] Modify handlePatternFileChange() in PatternFileWatcher to detect type changes
- [ ] T026 [US1] Emit 'typeChangeDetected' event when pattern type changes in PatternFileWatcher

**Phase 4: Integration**

- [ ] T027 [US1] Create TypeSwapEvent type definition in packages/genseq-engine/src/events/TypeSwapEvent.ts
- [ ] T028 [US1] Extend GenSeqEngine to track initial pattern types in packages/genseq-engine/src/GenSeqEngine.ts
- [ ] T029 [US1] Wire up PatternFileWatcher type change events to PatternExecutor in GenSeqEngine
- [ ] T030 [US1] Implement handlePatternTypeChange() method in GenSeqEngine
- [ ] T031 [US1] Modify GenSeqEngine.reloadPattern() to route type changes to scheduleTypeSwap()

**Phase 5: Event Lifecycle**

- [ ] T032 [P] [US1] Emit 'typeSwapScheduled' event when type swap is queued in PatternExecutor
- [ ] T033 [P] [US1] Emit 'typeSwapComplete' event on successful swap in PatternExecutor
- [ ] T034 [P] [US1] Emit 'typeSwapFailed' event on validation or creation failure in PatternExecutor
- [ ] T035 [US1] Add event listeners in GenSeqEngine to log type swap lifecycle events

**Checkpoint**: User Story 1 complete - musician can change pattern types during playback with cycle boundary synchronization

---

## Phase 4: User Story 2 - Safe Type Changes with Validation (Priority: P2)

**Goal**: Musician attempts invalid type change (e.g., probability > 1.0), system rejects change, logs clear error, continues playback with previous valid pattern

**Independent Test**: Edit pattern file with invalid parameters for new type, save file, verify engine rejects update, logs error with file path and parameter details, continues playing previous pattern

### Test Creation for User Story 2 (Red Phase - MUST FAIL)

- [ ] T036 [P] [US2] Create validation failure test suite in packages/genseq-engine/tests/unit/PatternFactory.validation.test.ts (MUST FAIL initially)
- [ ] T037 [P] [US2] Create rollback test suite in packages/genseq-engine/tests/unit/PatternExecutor.rollback.test.ts (MUST FAIL initially)
- [ ] T038 [US2] Create error handling integration test in packages/genseq-engine/tests/integration/typeSwapErrors.test.ts (MUST FAIL initially)

**GATE: RED PHASE VERIFIED - Validation and rollback tests failing**

### Implementation for User Story 2

**Validation Infrastructure**

- [ ] T039 [P] [US2] Add comprehensive parameter validation to ProbabilityPattern constructor in packages/genseq-patterns/src/probability/ProbabilityPattern.ts
- [ ] T040 [P] [US2] Add comprehensive parameter validation to PhasePattern constructor in packages/genseq-patterns/src/phase/PhasePattern.ts
- [ ] T041 [US2] Enhance PatternFactory.validateParameters() to call pattern constructors for validation
- [ ] T042 [US2] Add detailed error messages with parameter paths to validation failures in PatternFactory

**Rollback Mechanism**

- [ ] T043 [US2] Add try-catch around instance creation in PatternExecutor.applyTypeSwap()
- [ ] T044 [US2] Implement rollback logic to preserve previous generator on failure in PatternExecutor
- [ ] T045 [US2] Clear pendingTypeSwap flags on rollback in PatternExecutor
- [ ] T046 [US2] Log detailed error information on type swap failure with file path and validation errors

**Error Propagation**

- [ ] T047 [P] [US2] Enhance PatternFileWatcher to catch validation errors and emit 'config:error' events
- [ ] T048 [P] [US2] Add error event listeners in GenSeqEngine to log validation failures
- [ ] T049 [US2] Ensure transport continues uninterrupted when type swap fails in PatternExecutor

**Checkpoint**: User Story 2 complete - invalid type changes are safely rejected with clear error messages

---

## Phase 5: User Story 3 - Multiple Type Transitions (Priority: P3)

**Goal**: Musician rapidly experiments with different pattern types (euclidean → probability → phase → script → euclidean), verifying each transition works correctly and no memory leaks occur after multiple swaps

**Independent Test**: Sequentially change pattern through all type combinations, verify each transition succeeds, confirm no state corruption or memory leaks after 10+ transitions

### Test Creation for User Story 3 (Red Phase - MUST FAIL)

- [ ] T050 [P] [US3] Create n² type transition matrix test suite (12 combinations) in packages/genseq-engine/tests/integration/typeTransitionMatrix.test.ts (MUST FAIL initially)
- [ ] T051 [P] [US3] Create memory leak detection test suite in packages/genseq-engine/tests/integration/typeSwapMemory.test.ts (MUST FAIL initially)
- [ ] T052 [US3] Create rapid type change queue test in packages/genseq-engine/tests/unit/PatternExecutor.queueing.test.ts (MUST FAIL initially)

**GATE: RED PHASE VERIFIED - Type matrix and memory tests failing**

### Implementation for User Story 3

**Instance Lifecycle Management**

- [ ] T053 [US3] Add destroy() method to ProbabilityPattern for resource cleanup in packages/genseq-patterns/src/probability/ProbabilityPattern.ts
- [ ] T054 [US3] Add destroy() method to PhasePattern for resource cleanup in packages/genseq-patterns/src/phase/PhasePattern.ts
- [ ] T055 [US3] Call pattern.destroy() before creating new instance in PatternExecutor.applyTypeSwap()
- [ ] T056 [US3] Verify old instance is fully dereferenced after swap in PatternExecutor

**Queue Management for Rapid Changes**

- [ ] T057 [US3] Modify PatternFileWatcher to deduplicate rapid type changes (only keep latest)
- [ ] T058 [US3] Add timestamp tracking to ensure only most recent change is applied in PatternExecutor
- [ ] T059 [US3] Test rapid file changes within single cycle complete correctly in integration tests

**Memory Leak Prevention**

- [ ] T060 [US3] Add null checks and explicit cleanup of targetEntity references in PatternExecutor
- [ ] T061 [US3] Verify garbage collection can reclaim old pattern instances after swap
- [ ] T062 [US3] Run 10+ consecutive swaps in test and monitor memory stability

**Checkpoint**: User Story 3 complete - all type transitions work correctly with memory-safe lifecycle management

---

## Phase 6: User Story 4 - Type-Specific Parameter Preservation (Priority: P4)

**Goal**: Musician changes pattern type while specifying common parameters (velocity, note, channel), system preserves common parameters from new config and replaces type-specific parameters cleanly

**Independent Test**: Change pattern type with common parameters specified in new config, verify common parameters are used from new config, type-specific parameters are cleanly replaced

### Test Creation for User Story 4 (Red Phase - MUST FAIL)

- [ ] T063 [P] [US4] Create parameter preservation test suite in packages/genseq-engine/tests/unit/PatternFactory.parameters.test.ts (MUST FAIL initially)
- [ ] T064 [US4] Create parameter conflict detection test in packages/genseq-engine/tests/integration/typeSwapParameters.test.ts (MUST FAIL initially)

**GATE: RED PHASE VERIFIED - Parameter preservation tests failing**

### Implementation for User Story 4

**Parameter Handling**

- [ ] T065 [US4] Document common parameters (velocity, note, channel, length) vs type-specific in PatternFactory
- [ ] T066 [US4] Ensure PatternFactory uses all parameters from new entity (no automatic preservation)
- [ ] T067 [US4] Add validation to detect if both old and new type parameters are present in PatternFactory
- [ ] T068 [US4] Return clear error if parameter conflict detected during type change

**Schema Defaults**

- [ ] T069 [P] [US4] Verify schema defaults are applied for missing common parameters in probability.schema.json
- [ ] T070 [P] [US4] Verify schema defaults are applied for missing common parameters in phase.schema.json
- [ ] T071 [US4] Test type change with only type-specific parameters specified uses schema defaults

**Checkpoint**: User Story 4 complete - parameter handling is explicit and predictable with schema defaults

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, performance validation, and comprehensive testing

- [ ] T072 [P] Add pattern type hot-reload examples to examples/ directory with all type combinations
- [ ] T073 [P] Update CLAUDE.md with pattern type hot-reload implementation details
- [ ] T074 Performance validation: Verify type swaps complete within 50ms across all combinations
- [ ] T075 Performance validation: Verify zero transport interruption (no dropped beats)
- [ ] T076 [P] Add comprehensive logging for type swap lifecycle events in GenSeqEngine
- [ ] T077 Code review: Verify all destroy() methods are properly implemented for memory safety
- [ ] T078 Code review: Verify all error paths emit appropriate events and log details
- [ ] T079 Run quickstart.md validation for pattern type hot-reload workflows
- [ ] T080 [P] Update main spec documentation (001-midi-sequencer-engine) to reference pattern type hot-reload feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Complete ✅ - documentation generated
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories (pattern types must exist)
- **User Stories (Phase 3-6)**: All depend on Foundational (Phase 2) completion
  - User Story 1 (P1): Core type swap functionality - BLOCKS US2, US3, US4
  - User Story 2 (P2): Validation and rollback - Can start after US1
  - User Story 3 (P3): Multiple transitions and memory - Can start after US1
  - User Story 4 (P4): Parameter preservation - Can start after US1
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (pattern types exist) - NO dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (type swap infrastructure) - independently testable validation layer
- **User Story 3 (P3)**: Depends on US1 (type swap infrastructure) - independently testable memory/lifecycle
- **User Story 4 (P4)**: Depends on US1 (type swap infrastructure) - independently testable parameter handling

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Test-First Development)
- PatternFactory before PatternExecutor (factory used by executor)
- Type detection before integration (PatternFileWatcher → GenSeqEngine)
- Core functionality before event lifecycle
- Story complete and tests passing before moving to next priority

### Parallel Opportunities

**Foundational Phase (Phase 2)**:
- T003 and T004 (test creation) can run in parallel
- T005 and T006 (pattern implementations) can run in parallel after tests fail
- T008 and T009 (schema creation) can run in parallel

**User Story 1 (Phase 3)**:
- T010, T011, T012, T013 (test creation) can run in parallel
- T014, T015, T016, T017 (PatternFactory methods) can run in parallel within factory
- T032, T033, T034 (event emissions) can run in parallel

**User Story 2 (Phase 4)**:
- T036, T037, T038 (test creation) can run in parallel
- T039, T040 (pattern validation) can run in parallel
- T047, T048 (error propagation) can run in parallel

**User Story 3 (Phase 5)**:
- T050, T051, T052 (test creation) can run in parallel
- T053, T054 (destroy methods) can run in parallel

**User Story 4 (Phase 6)**:
- T063, T064 (test creation) can run in parallel
- T069, T070 (schema defaults) can run in parallel

**Polish Phase (Phase 7)**:
- T072, T073, T076, T080 (documentation tasks) can run in parallel

---

## Parallel Example: User Story 1 Core Implementation

```bash
# Launch PatternFactory tests and implementation in parallel:
Task: "Create PatternFactory unit test suite in packages/genseq-engine/tests/unit/PatternFactory.test.ts"
Task: "Create PatternFactory class with createPattern() method in packages/genseq-engine/src/patterns/PatternFactory.ts"

# Launch all event emission tasks in parallel:
Task: "Emit 'typeSwapScheduled' event when type swap is queued"
Task: "Emit 'typeSwapComplete' event on successful swap"
Task: "Emit 'typeSwapFailed' event on validation failure"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup ✅
2. Complete Phase 2: Foundational (pattern types) - CRITICAL
3. Complete Phase 3: User Story 1 (core type swap)
4. **STOP and VALIDATE**: Test type swap independently with all 4 pattern types
5. Deploy/demo if ready - musician can now change types during playback

### Incremental Delivery

1. Complete Setup + Foundational → All pattern types available
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - basic type swap!)
3. Add User Story 2 → Test independently → Deploy/Demo (validation and safety)
4. Add User Story 3 → Test independently → Deploy/Demo (memory safety)
5. Add User Story 4 → Test independently → Deploy/Demo (parameter handling)
6. Each story adds value without breaking previous stories

### Test-First Strategy (CRITICAL)

**For EVERY user story**:
1. Write all tests FIRST (Red Phase)
2. Verify tests FAIL
3. Get approval on test coverage
4. Implement minimal code to make tests pass (Green Phase)
5. Refactor while keeping tests green
6. Move to next story only after current tests pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **CRITICAL**: Verify tests fail before implementing (Test-First Development)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All type swaps must complete within 50ms (performance contract)
- Memory safety is critical - always call destroy() on old instances
- Event lifecycle tracking helps with debugging and monitoring

---

## Task Count Summary

- **Total Tasks**: 80
- **Phase 1 (Setup)**: 2 tasks (complete)
- **Phase 2 (Foundational)**: 7 tasks (pattern types)
- **Phase 3 (User Story 1)**: 26 tasks (core type swap)
- **Phase 4 (User Story 2)**: 14 tasks (validation/rollback)
- **Phase 5 (User Story 3)**: 13 tasks (memory/lifecycle)
- **Phase 6 (User Story 4)**: 9 tasks (parameters)
- **Phase 7 (Polish)**: 9 tasks (documentation/validation)

**Parallel Opportunities**: 35 tasks marked [P] can run in parallel within their phases
**Test Tasks**: 15 test suites (19% of total - following TDD)
**MVP Scope**: Phases 1-3 (35 tasks) delivers basic type swap functionality
