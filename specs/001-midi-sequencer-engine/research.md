# Technical Research: GenSeq MIDI Sequencer Engine

## Phase 0: Research Findings

### 1. MIDI I/O Library Selection

**Decision**: @julusian/midi (formerly node-midi)

**Rationale**:
- Most actively maintained (2024 updates)
- Native bindings to RtMidi for lowest latency
- Cross-platform support (macOS, Linux, Windows)
- TypeScript definitions included
- Supports both input and output with minimal overhead
- Used in production by professional audio software

**Alternatives Considered**:
- **easymidi**: Higher-level abstraction but adds ~2ms latency due to event emitter overhead. Less control over timing precision.
- **node-midi**: Original package, but @julusian/midi is the maintained fork with better TypeScript support
- **webmidi**: Browser-only, not suitable for Node.js environment
- **jazz-midi**: Good performance but lacks TypeScript definitions and has smaller community

**Implementation Notes**:
- Use synchronous send() for output to minimize latency
- Implement own event handling for input to avoid EventEmitter overhead
- Direct port access rather than virtual ports for production use

### 2. Script Sandboxing Solution

**Decision**: isolated-vm

**Rationale**:
- True V8 isolate-based sandboxing (same as Chrome tabs)
- Enforces memory limits (10MB) and CPU time limits (5ms)
- No filesystem or network access by default
- Synchronous execution model fits our tick-based pattern generation
- Used by code execution platforms like CodeSandbox

**Alternatives Considered**:
- **vm2**: Deprecated as of 2023, known security vulnerabilities
- **Node.js vm module**: Not a true sandbox, can be escaped
- **quickjs-emscripten**: Good sandboxing but 10x slower execution
- **Web Workers**: Async only, adds complexity for synchronous pattern generation
- **Deno subprocesses**: Too heavy, ~50ms startup overhead per script

**Implementation Notes**:
- Pre-compile isolate context at module load, not per tick
- Use transferable objects for pattern data to avoid serialization overhead
- Implement timeout at 4.5ms to leave buffer for cleanup

### 3. High-Resolution Timer Strategy

**Decision**: Custom scheduler using process.hrtime.bigint() with setImmediate loop

**Rationale**:
- process.hrtime.bigint() provides nanosecond precision
- setImmediate allows yielding to I/O without drift
- More accurate than setTimeout/setInterval (which have ~10ms resolution)
- Used successfully in other Node.js audio applications

**Alternatives Considered**:
- **node-cron**: 1-second resolution, unsuitable for audio
- **node-schedule**: Also second-resolution
- **nanotimer**: Adds dependency, our custom solution is simpler
- **Worker threads with busy-wait**: Burns CPU, defeats performance goals

**Implementation Pattern**:
```typescript
class HighResolutionClock {
  private nextTick: bigint;
  private running = false;

  async run() {
    this.running = true;
    this.nextTick = process.hrtime.bigint();

    while (this.running) {
      const now = process.hrtime.bigint();
      if (now >= this.nextTick) {
        this.processTick();
        this.nextTick += this.tickInterval;
      }

      // Yield to allow I/O processing
      await new Promise(setImmediate);
    }
  }
}
```

### 4. Configuration Hot-Reload Architecture

**Decision**: Chokidar with debouncing + dual-buffer pattern

**Rationale**:
- Chokidar is the most reliable cross-platform file watcher
- Debouncing prevents multiple reloads from rapid saves
- Dual-buffer allows atomic configuration swaps at bar boundaries
- Zero-downtime updates without transport interruption

**Implementation Pattern**:
```typescript
class ConfigurationManager {
  private activeConfig: Config;
  private pendingConfig: Config | null;

  watchFiles() {
    chokidar.watch('**/*.{json,yaml,js}', {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 20,
        pollInterval: 10
      }
    }).on('change', this.scheduleReload);
  }

  scheduleReload = debounce(async (path) => {
    const newConfig = await this.validateAndLoad(path);
    this.pendingConfig = newConfig;
    // Apply at next bar boundary
  }, 30);
}
```

### 5. Monorepo Tool Selection

**Decision**: pnpm workspaces with Turborepo

**Rationale**:
- pnpm: Efficient dependency management, strict node_modules
- Turborepo: Incremental builds, parallel task execution
- Both have excellent TypeScript monorepo support
- Used by Next.js, Vercel, and other high-performance projects

**Alternatives Considered**:
- **Lerna**: Being deprecated, maintenance mode
- **Nx**: More complex, overkill for 4 packages
- **Rush**: Enterprise-focused, too heavy for this project
- **Yarn workspaces**: pnpm is faster with better disk usage

**Configuration**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

### 6. VS Code Extension Architecture

**Decision**: Extension + Language Server Protocol (LSP) for diagnostics

**Rationale**:
- LSP provides standardized way to show validation errors
- Separates validation logic from UI concerns
- Can reuse validation in other editors if needed
- Built-in VS Code support for diagnostics, hover, completion

**Implementation Notes**:
- Use vscode-languageserver-node for LSP implementation
- Validate on file save and during typing (debounced)
- Cache parsed schemas for performance

### 7. Performance Monitoring Strategy

**Decision**: Built-in metrics collector with periodic reporting

**Rationale**:
- Custom metrics for audio-specific concerns (jitter, drift)
- No external dependencies or network calls
- Negligible performance impact (<0.1% CPU)
- Can export to various formats (console, file, OpenMetrics)

**Implementation Pattern**:
```typescript
class PerformanceMonitor {
  private metrics = {
    clockJitter: new Histogram(),
    midiLatency: new Histogram(),
    cpuUsage: new Gauge(),
    memoryUsage: new Gauge(),
    patternCount: new Counter()
  };

  reportPeriodically() {
    setInterval(() => {
      console.log({
        jitter_p99: this.metrics.clockJitter.percentile(99),
        midi_p95: this.metrics.midiLatency.percentile(95),
        cpu: process.cpuUsage(),
        memory: process.memoryUsage()
      });
    }, 10000);
  }
}
```

## Technology Stack Finalized

Based on research findings:

- **Runtime**: Node.js 18+ with TypeScript 5+
- **MIDI I/O**: @julusian/midi (RtMidi bindings)
- **File Watching**: chokidar 3.5+
- **Config Parsing**: yaml 2.3+, native JSON
- **Schema Validation**: ajv 8.12+
- **Script Sandbox**: isolated-vm 4.6+
- **Monorepo**: pnpm workspaces + Turborepo
- **Testing**: Vitest 1.0+
- **VS Code**: Extension API + LSP
- **Scheduling**: Custom process.hrtime.bigint() scheduler

## Key Architectural Decisions

### 1. Tick-Based Architecture
- Fixed tick rate independent of tempo (e.g., 960 PPQ)
- All events scheduled in tick-time, converted to real-time
- Simplifies pattern logic and timing calculations

### 2. Pull-Based Pattern Generation
- Patterns are asked for their next events each tick
- No internal state in patterns (purely functional)
- Enables hot-reload without losing pattern position

### 3. Bus-Based Routing
- Patterns target logical buses, not physical ports
- Routing maps buses to MIDI devices/channels
- Allows live re-routing without pattern changes

### 4. Immutable Configuration
- Configuration is immutable once loaded
- Changes create new configuration object
- Swap happens atomically at safe points

### 5. Event Sourcing for Debugging
- Optional event log of all MIDI I/O
- Replay capability for debugging timing issues
- Can export session as test case

## Performance Optimization Strategies

### 1. Pre-allocation
- Pre-allocate event buffers to avoid GC during playback
- Object pools for frequently created/destroyed objects

### 2. Lazy Evaluation
- Pattern events calculated only when needed
- Scenes load patterns on-demand

### 3. Batch Processing
- Group MIDI sends in same tick
- Batch configuration validations

### 4. Caching
- Cache compiled JSON schemas
- Cache parsed pattern definitions
- Cache isolate contexts for scripts

## Risk Mitigations

### 1. Clock Drift
- **Risk**: Cumulative timing errors over long sessions
- **Mitigation**: Periodic recalibration against system clock
- **Implementation**: Adjust tick interval every 1000 ticks

### 2. MIDI Device Disconnection
- **Risk**: Hardware disconnection causes crash
- **Mitigation**: Graceful degradation with reconnection attempts
- **Implementation**: Try/catch on send, periodic port scanning

### 3. Runaway Scripts
- **Risk**: User script consumes excessive resources
- **Mitigation**: Hard limits enforced by isolated-vm
- **Implementation**: 5ms timeout, 10MB memory, no I/O access

### 4. Configuration Corruption
- **Risk**: Malformed files crash engine
- **Mitigation**: Schema validation before apply
- **Implementation**: Keep last-known-good configuration

### 5. Memory Leaks
- **Risk**: Long-running sessions accumulate memory
- **Mitigation**: Careful lifecycle management
- **Implementation**: WeakMaps for caches, explicit cleanup

## Next Steps

With all technical clarifications resolved, we can proceed to Phase 1 (Design) to create:
1. Data models for all entities
2. API contracts for library interfaces
3. JSON schemas for configuration
4. Quickstart guide for users