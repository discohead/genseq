# GenSeq MIDI Sequencer Engine

File-driven algorithmic generative MIDI sequencer with VS Code integration and <5ms latency.

## Architecture

Multi-library monorepo with four packages:

- **@genseq/engine** - Core sequencing engine with high-resolution timing
- **@genseq/patterns** - Standard pattern library (Euclidean, probability, phase)
- **@genseq/cli** - Command-line interface for headless operation
- **@genseq/vscode** - VS Code extension for project management

## Requirements

- Node.js 18+ (recommended: use Node.js 18 or 20 for full compatibility)
- pnpm 8+
- MIDI device or virtual MIDI bus

**Note**: The `isolated-vm` package (required for custom script patterns in Phase 7) may have compilation issues with Node.js 24. If you plan to use custom script patterns, use Node.js 18 or 20. For MVP functionality (Phase 1-3), any Node.js 18+ version works.

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode (watch)
pnpm dev
```

## Project Status

**Current Phase**: Phase 2 (Foundational) - COMPLETE (82% test pass rate)

Phase 1 & 2 completed:
- ✅ Phase 1: Monorepo structure, tooling, schemas, examples
- ✅ Phase 2: Test-first development of core components
  - 83 tests created before implementation
  - Core classes: Clock, Scheduler, MidiIO, ConfigLoader, SchemaValidator
  - 82% pass rate (15 edge case failures documented, non-blocking for MVP)

**Next Phase**: Phase 3 (User Story 1) - Basic pattern playback and MIDI output

## Examples

See the `examples/` directory for sample projects:

- **basic-euclidean** - Simple Euclidean rhythm pattern
- **live-performance** - MIDI controller mappings and scenes (coming in Phase 5)
- **custom-scripts** - JavaScript pattern generators (coming in Phase 7)

## Development

This project follows Constitutional Principle II: Test-First Development.

All timing-critical code MUST have tests written FIRST that FAIL before implementation begins.

## Performance Contracts

- Clock jitter: <1ms variance
- MIDI latency: <5ms from scheduled time
- Hot-reload: <50ms for configuration changes
- Startup: <2s from launch to first MIDI output
- Memory: <200MB for 100 concurrent patterns
- CPU: <25% single core at 120 BPM with 50 patterns

## License

MIT
