# 003: Techno Pattern Generators - Tasks

## Legend
- `[P]` = Parallelizable (no dependencies)
- `[D: X]` = Depends on task X
- `[R]` = Red phase (tests first)
- `[G]` = Green phase (implementation)
- `[ ]` = Not started
- `[x]` = Completed

---

## Phase 1: Infrastructure Setup

### T001 [P] [x] Create directory structure
Create `packages/genseq-patterns/src/techno/` directory and initial files.

**Files:**
- `packages/genseq-patterns/src/techno/types.ts`
- `packages/genseq-patterns/src/techno/index.ts`

**Acceptance:** Directory exists, files export empty placeholders.

---

### T002 [P] [x] Create shared techno types
Define TypeScript interfaces for all four pattern configs.

**File:** `packages/genseq-patterns/src/techno/types.ts`

**Acceptance:** All interfaces from data-model.md defined with JSDoc comments.

---

### T003 [P] [x] Create JSON schemas
Create JSON Schema files for validation.

**Files:**
- `schemas/techno-kick-bass.schema.json`
- `schemas/techno-hihat.schema.json`
- `schemas/techno-chord.schema.json`
- `schemas/techno-lead.schema.json`

**Acceptance:** Schemas validate example configs, reject invalid configs.

---

### T004 [P] [x] Create test file skeletons
Set up test files with describe blocks for all patterns.

**Files:**
- `packages/genseq-patterns/tests/techno/TechnoKickBassPattern.test.ts`
- `packages/genseq-patterns/tests/techno/TechnoHiHatPattern.test.ts`
- `packages/genseq-patterns/tests/techno/TechnoChordPattern.test.ts`
- `packages/genseq-patterns/tests/techno/TechnoLeadPattern.test.ts`

**Acceptance:** Tests run (0 passing, 0 failing - skeletons only).

---

## Phase 2: Kick/Bass Pattern (US1)

### T005 [R] [D: T001, T002] [x] Write TechnoKickBassPattern tests
Test-first: Write failing tests for kick/bass pattern.

**Test cases:**
- Kick triggers on quarter notes (beats 1,2,3,4)
- Bass triggers at syncopation offset
- Velocity accent on beat 1
- Multi-bar patterns loop correctly
- Invalid config throws error
- Hot-reload maintains phase
- Empty bass notes array handled

**Acceptance:** Tests written, all fail (Red phase).

---

### T006 [G] [D: T005] [x] Implement TechnoKickBassPattern
Green phase: Implement to pass tests.

**File:** `packages/genseq-patterns/src/techno/TechnoKickBassPattern.ts`

**Implementation:**
- Constructor validates config
- `tick()` generates kick on quarter notes
- `tick()` generates bass at syncopated positions
- `updateConfig()` supports hot-reload
- `reset()` clears state
- `destroy()` cleanup

**Acceptance:** All T005 tests pass.

---

### T007 [D: T006] [x] Add factory function
Create `createTechnoKickBassPattern()` factory.

**Acceptance:** Factory creates working pattern instance.

---

## Phase 3: Hi-Hat Pattern (US2)

### T008 [R] [D: T001, T002] [x] Write TechnoHiHatPattern tests
Test-first: Write failing tests for hi-hat pattern.

**Test cases:**
- Closed hi-hat on offbeat positions
- Open hi-hat on specified beats
- Ride layer at density percentage
- Swing offsets even steps
- Ghost notes with probability
- Density at 0% produces silence
- Density at 100% fills all steps
- Open hi-hat overrides closed

**Acceptance:** Tests written, all fail (Red phase).

---

### T009 [G] [D: T008] [x] Implement TechnoHiHatPattern
Green phase: Implement to pass tests.

**File:** `packages/genseq-patterns/src/techno/TechnoHiHatPattern.ts`

**Implementation:**
- Position calculation for offbeat/onbeat/all
- Swing offset calculation
- Ghost note probability
- Layer priority (open > closed)
- Density filtering

**Acceptance:** All T008 tests pass.

---

### T010 [D: T009] [x] Add factory function
Create `createTechnoHiHatPattern()` factory.

**Acceptance:** Factory creates working pattern instance.

---

## Phase 4: Chord Pattern (US3)

### T011 [R] [D: T001, T002] [x] Write TechnoChordPattern tests
Test-first: Write failing tests for chord stab pattern.

**Test cases:**
- Generates 3-note chords by default
- Chord notes quantized to scale
- Inversions rotate note order
- Spread affects voicing width
- Sparse positions trigger correctly
- Density probability filters hits
- Velocity curves applied
- Single note graceful degradation

**Acceptance:** Tests written, all fail (Red phase).

---

### T012 [G] [D: T011] [x] Implement TechnoChordPattern
Green phase: Implement to pass tests.

**File:** `packages/genseq-patterns/src/techno/TechnoChordPattern.ts`

**Implementation:**
- Chord voicing generation from scale
- Inversion rotation logic
- Spread calculation
- Position-based triggering
- Velocity curve application

**Acceptance:** All T011 tests pass.

---

### T013 [D: T012] [x] Add factory function
Create `createTechnoChordPattern()` factory.

**Acceptance:** Factory creates working pattern instance.

---

## Phase 5: Lead Pattern (US4)

### T014 [R] [D: T001, T002] [x] Write TechnoLeadPattern tests
Test-first: Write failing tests for lead pattern.

**Test cases:**
- Generates phrase of configured length
- Notes quantized to scale
- Phrase loops independently of bar
- Rest probability creates gaps
- Duration variation applied
- Velocity contours work
- Fixed mode uses provided notes
- Generative mode creates phrase
- Regenerate on cycle works

**Acceptance:** Tests written, all fail (Red phase).

---

### T015 [G] [D: T014] [x] Implement TechnoLeadPattern
Green phase: Implement to pass tests.

**File:** `packages/genseq-patterns/src/techno/TechnoLeadPattern.ts`

**Implementation:**
- Phrase generation algorithm
- Scale quantization
- Rest probability check
- Duration variation
- Velocity contour application
- Regeneration logic

**Acceptance:** All T014 tests pass.

---

### T016 [D: T015] [x] Add factory function
Create `createTechnoLeadPattern()` factory.

**Acceptance:** Factory creates working pattern instance.

---

## Phase 6: Integration

### T017 [D: T007, T010, T013, T016] [x] Export from index
Add all patterns to barrel exports.

**Files:**
- `packages/genseq-patterns/src/techno/index.ts`
- `packages/genseq-patterns/src/index.ts`

**Acceptance:** All patterns importable from `@genseq/patterns`.

---

### T018 [D: T017] [x] Register patterns in factory
Add techno patterns to PatternFactory type map.

**File:** `packages/genseq-engine/src/patterns/PatternFactory.ts`

**Acceptance:** `PatternFactory.create()` handles all 4 techno types.

---

### T019 [D: T003] [x] Integrate schemas with validator
Register techno schemas with SchemaValidator.

**File:** `packages/genseq-engine/src/config/SchemaValidator.ts`

**Acceptance:** Invalid techno configs rejected with clear errors.

---

### T020 [D: T018, T019] [x] Update types.ts Pattern union
Add techno types to Pattern type union.

**File:** `packages/genseq-patterns/src/types.ts`

**Acceptance:** TypeScript recognizes all pattern types.

---

### T021 [P] [D: T018] [x] Integration tests
Write integration tests with all 4 patterns running.

**Test cases:**
- 4 patterns running simultaneously
- No timing drift over 100 bars
- Hot-reload mid-playback
- Memory stable after 10 reloads
- Pattern type switching works

**Acceptance:** All integration tests pass.

---

### T022 [D: T021] [x] Performance benchmarks
Verify performance contracts.

**Benchmarks:**
- tick() < 0.1ms per pattern
- Memory < 1KB per pattern instance
- 50 pattern stress test

**Acceptance:** All benchmarks pass.

---

### T023 [D: T018] [x] Create techno-patterns example
Create dedicated example project for techno pattern generators.

**Files:**
- `examples/techno-patterns/patterns/kick-bass.json`
- `examples/techno-patterns/patterns/hihat.json`
- `examples/techno-patterns/patterns/chord.json`
- `examples/techno-patterns/patterns/lead.json`
- `examples/techno-patterns/mappings/*.json` (12 PBF4 controller mappings)
- `examples/techno-patterns/macros/*.json` (master-density, master-velocity)
- `examples/techno-patterns/scenes/*.json` (intro, main, breakdown, regenerate-lead)
- `examples/techno-patterns/start.mjs`
- `examples/techno-patterns/README.md`

**Acceptance:** Example plays techno patterns with full PBF4 controller integration.

---

### T024 [D: T023] Manual MIDI verification
Test with actual MIDI output.

**Steps:**
1. Run techno-patterns example
2. Route to DAW or hardware
3. Verify kick on quarter notes
4. Verify bass syncopation
5. Verify hi-hat offbeat
6. Verify chord stabs sparse
7. Verify lead loops

**Acceptance:** Musical output matches expectations.

---

### T025 [D: T018] Global key override integration
Implement FR5.4: Global key override from project config.

**Implementation:**
- Add `key` field to project config schema (root + scale)
- GenSeqEngine reads project key on load
- Patterns without explicit root/scale inherit from project config
- Hot-reload project key propagates to all patterns

**Files:**
- `schemas/project.schema.json` (add key field)
- `packages/genseq-engine/src/GenSeqEngine.ts` (key propagation)
- `packages/genseq-patterns/tests/techno/GlobalKey.test.ts`

**Acceptance:** Changing project key updates all pattern outputs to new key.

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| 1. Infrastructure | T001-T004 | All 4 [P] |
| 2. Kick/Bass | T005-T007 | Sequential (TDD) |
| 3. Hi-Hat | T008-T010 | Sequential (TDD) |
| 4. Chord | T011-T013 | Sequential (TDD) |
| 5. Lead | T014-T016 | Sequential (TDD) |
| 6. Integration | T017-T025 | Mostly sequential |

**Total Tasks:** 25
**Critical Path:** T001 → T005 → T006 → T007 → T017 → T018 → T021 → T024
**Estimated Effort:** 4 days

---

## Dependencies Graph

```
T001 ──┬──> T005 ──> T006 ──> T007 ──┐
T002 ──┤                             │
       ├──> T008 ──> T009 ──> T010 ──┤
       ├──> T011 ──> T012 ──> T013 ──┼──> T017 ──> T018 ──> T021 ──> T022
       └──> T014 ──> T015 ──> T016 ──┘         │
                                               v
T003 ────────────────────────────────────> T019 ──> T020
T004 (parallel, no deps)
T023 ──> T024
T018 ──> T025 (global key)
```
