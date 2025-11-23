<!--
Sync Impact Report:
- Version change: 0.0.0 (new) → 1.0.0
- Modified principles: N/A (initial creation)
- Added sections: All (initial constitution)
- Removed sections: None
- Templates requiring updates:
  ✅ plan-template.md - Constitution Check section will reference these principles
  ✅ spec-template.md - User scenarios align with performance contracts
  ✅ tasks-template.md - Test-first discipline enforced in task ordering
- Follow-up TODOs: None
-->

# GenSeq Constitution

## Core Principles

### I. Library-First Architecture

The system MUST be built as independently testable, composable libraries with clear boundaries:

- **genseq-engine**: Core clock, scheduler, pattern engine, MIDI I/O
- **genseq-vscode**: VS Code extension UI layer
- **genseq-patterns**: Standard pattern library collection

Each library MUST be self-contained, independently testable, and serve a single well-defined purpose. Libraries MUST have documented APIs and integration contracts. No organizational-only libraries allowed—every library must provide concrete functionality.

**Rationale**: Enables parallel development, isolated testing, clear ownership, and reuse across different contexts. Prevents monolithic coupling.

### II. Test-First Development (NON-NEGOTIABLE)

All timing-critical and core functionality MUST be developed test-first:

- Write comprehensive tests that MUST fail initially (Red phase)
- Get user/team approval on test coverage before implementation
- Implement minimal solution to make tests pass (Green phase)
- Refactor while maintaining passing tests

This is **NON-NEGOTIABLE** for clock precision, pattern generation, MIDI I/O, and configuration validation.

**Rationale**: Real-time audio/MIDI systems cannot tolerate timing bugs discovered post-implementation. Tests document expected behavior and catch regressions immediately.

### III. Performance as Contract

Real-time performance requirements are measurable, testable contracts that MUST be verified through automated benchmarks:

- Clock jitter: <1ms variance
- MIDI output latency: <5ms from scheduled time
- Hot-reload time: <50ms for configuration changes
- Memory footprint: <200MB for 100 patterns
- Startup time: <2 seconds from launch to first MIDI output
- CPU usage: <25% single core at 120 BPM with 50 active patterns

All performance requirements MUST be verified through automated benchmarks that fail when violated.

**Rationale**: Real-time systems have hard performance requirements. Making them contracts prevents performance regression and ensures the system remains usable.

### IV. Schema-Driven Validation

All configuration files (patterns, scenes, mappings, routing) MUST be validated against JSON schemas before loading:

- Invalid configurations MUST be rejected with clear error messages indicating file, line, and issue
- Schemas MUST be versioned to enable automated migration
- VS Code extension MUST provide real-time validation feedback with diagnostics

This enables AI agents to safely edit configurations and provides immediate feedback during development.

**Rationale**: File-driven systems need robust validation to prevent runtime errors. Schema validation catches errors at edit-time, not performance-time.

### V. Declarative, File-Driven Behavior

The project directory is the single source of truth. Musical structure, routing, scenes, and mappings live as JSON/YAML and script modules on disk:

- All system behavior MUST be representable in declarative configuration files
- Git branches represent different "systems" or "sets"
- Configuration changes MUST hot-reload without losing transport state (where feasible)
- File changes MUST be detected within 50ms and validated before application

**Rationale**: Files are versionable, diffable, and editable by humans and AI. Declarative configuration separates what from how.

### VI. VS Code as Primary UI

VS Code is not just an editor—it is the control surface and primary interface:

- The extension MUST provide project views (patterns, scenes, devices, mappings)
- The extension MUST show real-time diagnostics and engine status (transport, BPM, active scene)
- The extension MUST provide visualizations (via webviews) for patterns, phasing, gestural inputs
- Command palette MUST expose all engine control operations

No separate custom GUI is assumed or required.

**Rationale**: Developers already use VS Code. Leveraging it as the UI eliminates the need to build and maintain a separate application.

### VII. Script Extensibility with Safety

Built-in declarative primitives MUST be supplemented by user-defined JavaScript modules:

- Script modules MUST run in isolated sandboxes with resource limits (5ms execution timeout, 10MB memory)
- Script modules MUST be validated against the script module contract before execution
- Script modules MUST be hot-reloadable when their files change
- Script modules MUST be plain JavaScript (ES2022)—no runtime TypeScript compilation required

**Rationale**: Extensibility is essential but must not compromise system stability. Sandboxing prevents runaway scripts from crashing the engine.

### VIII. Bidirectional MIDI Control

The engine MUST both send and consume MIDI as a primary control modality:

- MIDI input MUST be declaratively mapped to engine parameters, macros, pattern parameters, and scene changes
- Input mappings MUST support filtering, transformation (scaling, curves, smoothing), and device-specific routing
- Mapping changes MUST hot-reload without restarting the engine
- Invalid mappings MUST be validated and rejected with clear error messages

**Rationale**: Gestural control via MIDI hardware is a core use case. Bidirectional MIDI enables rapid prototyping of complex performance interfaces.

## Technology Stack Requirements

**Engine Stack**:

- Runtime: Node.js 18+
- Language: TypeScript 5+ (compiled to ES2022)
- Config Format: JSON and YAML with JSON Schema validation
- MIDI Library: RtMidi bindings (easymidi or node-midi)
- Scheduling: Custom high-resolution scheduler using `process.hrtime.bigint()`
- File Watching: chokidar with debouncing
- Script Sandboxing: isolated-vm or vm2 for secure execution

**VS Code Extension Stack**:

- Language: TypeScript
- Extension API: VS Code Extension API
- Webview Framework: Modern framework (React/Vue) or vanilla JS (decision deferred to implementation planning)

**Testing Stack**:

- Test Framework: Vitest or Jest
- Timing Precision: Custom timing test framework for sub-millisecond validation
- Integration Tests: MIDI loopback tests with virtual MIDI devices

**Constraints**:

- NO runtime TypeScript compilation for script modules (plain JS only)
- NO audio synthesis (sound generation is external)
- NO unnecessary abstractions over proven libraries
- Git assumed for versioning

## Development Workflow

### Constitution Supersedes All

This constitution supersedes all other practices. When in doubt, consult this document.

### Complexity Justification

All violations of these principles (e.g., adding a 4th library, introducing caching layer, using non-standard config format) MUST be:

1. Documented in the relevant plan.md "Complexity Tracking" section
2. Justified with specific technical need
3. Approved before implementation

### Amendment Process

Amendments to this constitution require:

1. Documentation of the change rationale in git commit message
2. Version bump according to semantic versioning:
   - MAJOR: Backward incompatible governance/principle removals or redefinitions
   - MINOR: New principle/section added or materially expanded guidance
   - PATCH: Clarifications, wording, typo fixes, non-semantic refinements
3. Update to dependent templates (plan, spec, tasks) to align with new principles
4. Approval from project lead or team consensus (for team projects)

### Compliance Review

All PRs and code reviews MUST verify compliance with:

- Library-first architecture (Principle I)
- Test-first development for timing-critical code (Principle II)
- Performance contract benchmarks (Principle III)
- Schema validation for all config files (Principle IV)
- Declarative configuration over imperative code (Principle V)
- VS Code integration completeness (Principle VI)
- Script sandboxing and resource limits (Principle VII)
- Bidirectional MIDI support (Principle VIII)

### Pre-Implementation Gates (Phase -1)

Before implementation begins, ALL of the following gates MUST pass:

**Gate 1: Specification Completeness**
- All user scenarios have acceptance criteria
- All functional requirements are testable
- All edge cases are documented
- No unresolved [NEEDS CLARIFICATION] markers

**Gate 2: Constitutional Compliance**
- Library boundaries are clear and justified
- Performance contracts are defined with measurable targets
- Schema validation is specified for all config changes
- Test coverage requirements are documented

**Gate 3: Test-First Readiness**
- Test files are created and failing
- Test coverage approved by reviewer
- Testing approach validated against Principle II

Proceed to implementation ONLY when all gates pass.

## Governance

**Version**: 1.0.0 | **Ratified**: 2025-11-22 | **Last Amended**: 2025-11-22
