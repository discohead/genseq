# GitHub Copilot Instructions for GenSeq

This document provides guidance to GitHub Copilot when working with code in this repository.

## Project Overview

GenSeq is a file-driven algorithmic generative MIDI sequencer with VS Code integration and <5ms latency. The system uses a headless Node.js engine that reads JSON/YAML project directories to generate real-time MIDI output.

## Architecture

**Multi-Library Monorepo** (4 packages using pnpm workspaces + Turborepo):

- **@genseq/engine** (`packages/genseq-engine`) - Core sequencing engine with high-resolution timing (<1ms clock jitter)
- **@genseq/patterns** (`packages/genseq-patterns`) - Pattern generation library (Euclidean, Probability, Phase)
- **@genseq/cli** (`packages/genseq-cli`) - Command-line interface for headless operation
- **@genseq/vscode** (`packages/genseq-vscode`) - VS Code extension for project management

## Tech Stack

- **Runtime**: Node.js 20 (recommended) or 18+ (for `isolated-vm` compatibility; Node 24+ not supported)
- **Package Manager**: pnpm 8+ (required - npm/yarn will not work)
- **Build System**: Turborepo for monorepo orchestration
- **Language**: TypeScript 5.2+ with strict mode
- **Testing**: Vitest
- **Linting**: ESLint + Prettier

## Commands

### Monorepo Commands (from root)
```bash
pnpm install            # Install all dependencies
pnpm build              # Build all packages with Turborepo
pnpm test               # Run all tests across packages
pnpm lint               # Lint all packages
pnpm dev                # Watch mode for all packages (parallel)
pnpm clean              # Clean all build artifacts
```

### Per-Package Commands (from `packages/<package-name>/`)
```bash
pnpm build              # Build this package only
pnpm test               # Run Vitest in watch mode
pnpm test:ci            # Run Vitest once (CI mode)
pnpm lint               # ESLint for this package
pnpm dev                # TypeScript watch mode
```

## Development Guidelines

### Test-First Development (TDD)

**All timing-critical code follows strict TDD:**

1. **Red Phase**: Write failing tests FIRST
2. **Green Phase**: Write minimal code to pass tests
3. **Refactor**: Optimize while keeping tests green

### Performance Contracts (Non-Negotiable)

Tests will fail if these are not met:
- Clock jitter: <1ms variance over 10 minutes
- MIDI latency: <5ms from scheduled to sent time
- Hot-reload: <50ms for configuration changes
- Startup: <2s from launch to first MIDI output
- Memory: <200MB for 100 concurrent patterns
- CPU: <25% single core at 120 BPM with 50 patterns

### Code Style

- Use TypeScript strict mode
- Follow ESLint + Prettier configuration
- Explicit return types on functions
- No `any` types (use generics or specific types)
- Prefix unused parameters with `_`

### Key Technical Patterns

#### Timing System
- Use `process.hrtime.bigint()` for nanosecond precision
- Clock emits tick events at PPQ resolution (96-960 pulses per quarter)
- Scheduler maintains sorted event queue with lookahead window

#### MIDI System
- Cross-platform via `@julusian/midi` (RtMidi bindings)
- Virtual loopback support for testing
- Message validation for note-on/off, CC, program change, sysex

#### Configuration System
- Dual-buffer hot-reload (atomic config swaps at bar boundaries)
- Chokidar watches with 30ms debouncing
- AJV JSON Schema validation

## File Organization

```
packages/genseq-engine/src/
├── clock/Clock.ts              # High-res timing
├── scheduler/Scheduler.ts      # Event queue with lookahead
├── midi/MidiIO.ts              # MIDI I/O wrapper
├── config/
│   ├── ConfigLoader.ts         # Hot-reload with chokidar
│   ├── SchemaValidator.ts      # AJV validation
│   └── entities/               # Entity models

packages/genseq-patterns/src/
├── types.ts                    # PatternContext, MidiEvent interfaces
├── registry/PatternRegistry.ts # Pattern lifecycle
├── helpers/PatternHelpers.ts   # Scale quantization, rhythm utilities
└── euclidean/EuclideanPattern.ts

schemas/                        # JSON Schema files for validation
examples/                       # Example projects
specs/001-midi-sequencer-engine/ # Implementation specs
```

## Common Gotchas

1. **Node.js Version**: Use Node 20 (recommended) or 18. Node 24 breaks `isolated-vm`.
2. **pnpm Required**: npm/yarn will not work with this workspace setup.
3. **Turborepo Cache**: If builds seem stale, run `pnpm clean && pnpm build`.
4. **MIDI Testing**: Tests use virtual MIDI loopback, no hardware required.
5. **Timing Tests**: Some <1ms precision edge cases may fail, documented in tasks.md.
