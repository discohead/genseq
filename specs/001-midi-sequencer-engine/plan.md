# Implementation Plan: GenSeq MIDI Sequencer Engine

**Branch**: `001-midi-sequencer-engine` | **Date**: 2025-11-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-midi-sequencer-engine/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

GenSeq is a file-driven algorithmic generative MIDI sequencer that uses VS Code as its primary UI, built around a headless Node.js process that reads JSON/YAML project directories to generate real-time MIDI output with <5ms latency. The architecture follows a library-first approach with three core libraries (genseq-engine, genseq-vscode, genseq-patterns), leveraging Node.js 18+ with TypeScript, RtMidi bindings for MIDI I/O, and a custom high-resolution scheduler achieving <1ms clock jitter for professional-grade timing precision.

## Technical Context

**Language/Version**: TypeScript 5+ / Node.js 18+ (ES2022 target)
**Primary Dependencies**:
- MIDI I/O: NEEDS CLARIFICATION - evaluate easymidi vs node-midi vs @julusian/midi
- File watching: chokidar 3.5+
- YAML parsing: yaml 2.3+
- JSON Schema validation: ajv 8.12+
- Script sandboxing: NEEDS CLARIFICATION - evaluate isolated-vm vs vm2 alternatives
- VS Code Extension API: latest stable

**Storage**: File-based (JSON/YAML project directories) - no database
**Testing**: Vitest with custom timing precision framework, MIDI loopback tests
**Target Platform**: macOS, Linux, Windows (Node.js 18+ environments)
**Project Type**: Multi-library monorepo (3 core libraries + VS Code extension)
**Performance Goals**:
- Clock jitter: <1ms variance over 10 minutes
- MIDI latency: <5ms from scheduled time
- Hot-reload: <50ms for configuration changes
- Startup: <2s from launch to first MIDI output
- CPU: <25% single core at 120 BPM with 50 patterns

**Constraints**:
- Memory: <200MB for 100 concurrent patterns
- Script execution: 5ms timeout, 10MB memory limit
- No runtime TypeScript compilation for user scripts
- No audio synthesis (MIDI only)

**Scale/Scope**:
- Support 50-200 concurrent patterns
- Handle 10-50 MIDI input mappings
- Manage 5-20 scenes per project
- Process 960 PPQ at 300 BPM maximum

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate 1: Specification Completeness ✅
- [x] All 6 user scenarios have detailed acceptance criteria
- [x] All 31 functional requirements (FR-001 to FR-031) are testable
- [x] 10 edge cases documented (empty project, MIDI disconnection, simultaneous edits, etc.)
- [x] No unresolved [NEEDS CLARIFICATION] markers in spec

### Gate 2: Constitutional Compliance ✅
- [x] **Library boundaries defined**: genseq-engine (core), genseq-vscode (UI), genseq-patterns (patterns)
- [x] **Performance contracts specified**: <1ms jitter, <5ms MIDI latency, <50ms hot-reload
- [x] **Schema validation required**: All config files validated against JSON schemas (FR-004)
- [x] **Test coverage documented**: Test-first for timing-critical code (Principle II)

### Gate 3: Test-First Readiness 🔄
- [ ] Test files created and failing (will be created in Phase 2)
- [ ] Test coverage approach defined: Vitest + timing precision framework + MIDI loopback
- [x] Testing approach validated against Principle II (NON-NEGOTIABLE for timing code)

### Constitutional Principles Applied:

**I. Library-First Architecture** ✅
- Three independently testable libraries with clear boundaries
- Each serves single well-defined purpose
- Documented APIs and contracts

**II. Test-First Development** ✅
- Timing-critical code (clock, scheduler, MIDI I/O) marked for TDD
- Performance benchmarks will fail initially then pass

**III. Performance as Contract** ✅
- All 6 performance metrics defined with measurable targets
- Automated benchmarks specified (FR-031)

**IV. Schema-Driven Validation** ✅
- JSON schemas for all config types (FR-004)
- VS Code diagnostics with file/line precision (FR-027)

**V. Declarative, File-Driven** ✅
- Project directory as single source of truth
- Git branches for different systems
- Hot-reload without transport loss (FR-005)

**VI. VS Code as Primary UI** ✅
- Extension provides complete control surface (FR-025 to FR-029)
- No separate GUI required

**VII. Script Extensibility with Safety** ✅
- Sandboxed execution with resource limits (FR-022)
- Plain JavaScript only, no runtime TS compilation

**VIII. Bidirectional MIDI Control** ✅
- Input mapping system specified (FR-013 to FR-017)
- Transformation and routing capabilities defined

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── genseq-engine/              # Core sequencer library
│   ├── src/
│   │   ├── clock/              # High-resolution timing system
│   │   ├── scheduler/          # Event scheduling and quantization
│   │   ├── patterns/           # Pattern generation engine
│   │   ├── midi/               # MIDI I/O abstraction
│   │   ├── config/             # Configuration loading and validation
│   │   ├── sandbox/            # Script execution sandbox
│   │   ├── transport/          # Transport control (play/stop/scene)
│   │   └── index.ts            # Public API exports
│   ├── tests/
│   │   ├── timing/             # Sub-millisecond precision tests
│   │   ├── integration/        # MIDI loopback tests
│   │   └── unit/               # Component tests
│   └── package.json
│
├── genseq-patterns/            # Standard pattern library
│   ├── src/
│   │   ├── euclidean/          # Euclidean rhythm generator
│   │   ├── probability/        # Probability-based patterns
│   │   ├── phase/              # Phase-offset patterns
│   │   ├── registry/           # Pattern type registry
│   │   └── index.ts            # Public exports
│   ├── tests/
│   └── package.json
│
├── genseq-vscode/              # VS Code extension
│   ├── src/
│   │   ├── extension.ts        # Extension entry point
│   │   ├── engine/             # Engine process management
│   │   ├── diagnostics/        # Validation and error display
│   │   ├── views/              # Tree views and panels
│   │   ├── webviews/           # Pattern visualizations
│   │   └── commands/           # Command palette handlers
│   ├── tests/
│   └── package.json
│
└── genseq-cli/                 # CLI wrapper for engine
    ├── src/
    │   ├── cli.ts              # Command-line interface
    │   ├── commands/           # CLI commands
    │   └── utils/              # CLI utilities
    ├── tests/
    └── package.json

examples/                       # Example projects
├── basic-euclidean/
├── live-performance/
└── custom-scripts/

schemas/                        # JSON Schema definitions
├── clock.schema.json
├── pattern.schema.json
├── scene.schema.json
├── mapping.schema.json
└── route.schema.json
```

**Structure Decision**: Multi-library monorepo architecture with four packages following Constitutional Principle I (Library-First Architecture). Each package is independently testable with clear boundaries:
- `genseq-engine`: Core timing, scheduling, and MIDI I/O
- `genseq-patterns`: Reusable pattern generators
- `genseq-vscode`: VS Code extension UI layer
- `genseq-cli`: Command-line interface wrapper

This structure enables parallel development, isolated testing, and potential future distribution of libraries separately. The fourth library (genseq-cli) is justified as it provides a distinct interface mode beyond VS Code, enabling headless operation and CI/CD integration.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 4th library (genseq-cli) | CLI operation needed for headless mode, CI/CD integration, and non-VS Code users | 3 libraries insufficient because engine library shouldn't contain CLI concerns (violates single responsibility), and VS Code extension can't run headless |

## Phase Completion Status

### Phase 0: Research ✅
- **Completed**: 2025-11-22
- **Output**: `research.md` - All technical clarifications resolved
- **Key Decisions**:
  - MIDI I/O: @julusian/midi
  - Script sandboxing: isolated-vm
  - High-res timing: process.hrtime.bigint()
  - File watching: chokidar with debouncing

### Phase 1: Design ✅
- **Completed**: 2025-11-22
- **Outputs**:
  - `data-model.md` - Complete entity definitions and relationships
  - `contracts/` - API contracts for all 4 libraries
  - `quickstart.md` - User onboarding guide
  - Agent context updated (CLAUDE.md)
- **Constitutional Re-check**: All gates still passing

### Phase 2: Task Generation 🔄
- **Status**: Ready for `/speckit.tasks` command
- **Next Step**: Execute task generation to create atomic implementation tasks

## Implementation Strategy

### Library Development Order

1. **genseq-engine** (Core - Weeks 1-3)
   - Clock and scheduler foundation
   - MIDI I/O abstraction
   - Configuration loading and validation
   - Transport control

2. **genseq-patterns** (Patterns - Week 2-3)
   - Can develop in parallel with engine
   - Euclidean, probability, phase patterns
   - Pattern registry
   - Script sandbox integration

3. **genseq-cli** (CLI - Week 3)
   - Depends on engine completion
   - Command structure
   - Daemon management
   - Performance testing utilities

4. **genseq-vscode** (Extension - Weeks 3-4)
   - Depends on engine API
   - Tree providers and views
   - Diagnostics integration
   - Webview visualizations

### Testing Strategy

Per Constitutional Principle II (Test-First Development), the following components MUST be developed test-first:

1. **Timing-Critical Components** (RED-GREEN-REFACTOR)
   - Clock precision tests → Clock implementation
   - Scheduler accuracy tests → Scheduler implementation
   - MIDI latency tests → MIDI I/O implementation

2. **Performance Benchmarks**
   - Write failing benchmarks for all 6 performance metrics
   - Implement optimizations until benchmarks pass

3. **Integration Tests**
   - MIDI loopback tests with virtual devices
   - Hot-reload timing tests
   - Memory leak detection tests

### Risk Mitigations

1. **Cross-platform MIDI compatibility**
   - Early testing on all three platforms
   - Fallback to virtual MIDI if hardware unavailable

2. **VS Code Extension API changes**
   - Pin to specific VS Code engine version
   - Abstract VS Code API behind adapter layer

3. **Script sandbox security**
   - Regular security audits of isolated-vm
   - Strict resource limits from day one

## Success Metrics

Implementation will be considered successful when:

1. All 12 Success Criteria (SC-001 to SC-012) are met
2. All performance contracts verified by automated benchmarks
3. Quickstart guide tested with 5+ users achieving first playback < 5 minutes
4. No Constitutional violations without documented justification

## Conclusion

The implementation plan is complete and validated against the constitution. All pre-implementation gates have passed (Gate 3 will fully pass when test files are created in Phase 2). The technology stack has been finalized through research, data models are defined, API contracts are specified, and the project is ready for task breakdown and implementation.

**Next Action**: Run `/speckit.tasks` to generate the implementation task list.
