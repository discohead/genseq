# Feature Specification: GenSeq MIDI Sequencer Engine

**Feature Branch**: `001-midi-sequencer-engine`
**Created**: 2025-11-22
**Status**: Draft
**Input**: User description: "File-driven algorithmic generative MIDI sequencer with VS Code as UI. Engine: headless Node process reading JSON/YAML project dirs (clocks, patterns, routes, scenes, mappings). Features: bidirectional MIDI (output + gestural input control), hot-reload configs, script extensibility (sandboxed JS modules), declarative pattern definitions, scene management, and real-time performance requirements (clock jitter <1ms, MIDI latency <5ms, hot-reload <50ms)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Pattern Playback (Priority: P1)

A musician wants to create a simple generative MIDI pattern and hear it play through their hardware synthesizer, establishing the core engine-to-device communication loop.

**Why this priority**: This is the fundamental value proposition—the engine must reliably generate and send MIDI events to external devices. Without this, no other features matter.

**Independent Test**: Can be fully tested by creating a project directory with a single pattern file, starting the engine, and verifying MIDI notes are sent to a connected device at the correct timing with sub-5ms latency.

**Acceptance Scenarios**:

1. **Given** a project directory with a valid clock.yaml (120 BPM) and one pattern file (Euclidean rhythm, 4 kicks per 16 steps), **When** the engine starts, **Then** MIDI note-on/note-off messages are sent to the configured output device with <5ms latency from scheduled time
2. **Given** the engine is playing a pattern, **When** the user stops the engine, **Then** all MIDI output ceases immediately and all note-offs are sent
3. **Given** a pattern with velocity values 80-120, **When** the pattern plays, **Then** each MIDI event includes the correct velocity value

---

### User Story 2 - Live Configuration Hot-Reload (Priority: P2)

A musician wants to edit pattern parameters in VS Code (rotation, density, velocity) and hear the changes immediately without stopping playback, enabling rapid iteration during creative sessions.

**Why this priority**: Hot-reload is critical for the creative workflow—stopping/restarting breaks flow and loses performance context. This differentiates the system from traditional sequencers.

**Independent Test**: Can be fully tested by starting engine playback, editing a pattern JSON file to change parameters, saving the file, and verifying changes take effect within 50ms without transport interruption.

**Acceptance Scenarios**:

1. **Given** the engine is playing a pattern with rotation=0, **When** user edits the pattern file to rotation=4 and saves, **Then** the pattern updates within 50ms without stopping the clock or losing the current bar position
2. **Given** the engine has loaded a scene with 3 active patterns, **When** user edits one pattern's velocity parameter, **Then** only that pattern's sound changes while the other two continue unchanged
3. **Given** the user saves an invalid pattern file (malformed JSON), **When** the engine detects the change, **Then** the engine rejects the update, logs a clear error with file/line number, displays diagnostic in VS Code, and continues playing the last valid configuration

**Related Feature**: [Pattern Type Hot-Reload](../002-pattern-type-hotreload/spec.md) - Supports live pattern type changes (euclidean ↔ probability ↔ phase) during playback with <5ms swap latency at bar boundaries.

---

### User Story 3 - Gestural MIDI Input Control (Priority: P3)

A performer wants to use MIDI controller hardware (faders, knobs, pads) to control pattern parameters and trigger scene changes in real-time during a live performance.

**Why this priority**: Bidirectional MIDI transforms the system from a static sequencer into a performable instrument. This enables live manipulation but builds on the foundation of pattern playback and hot-reload.

**Independent Test**: Can be fully tested by defining a MIDI input mapping (CC1 → pattern density macro), moving the hardware fader, and verifying the pattern responds in real-time with the transformation applied (scaling, smoothing).

**Acceptance Scenarios**:

1. **Given** a mapping file that maps CC1 (channel 1) to a macro called "density" with linear scaling 0-127 → 0.0-1.0, **When** user moves the hardware fader, **Then** the mapped pattern parameter updates within one clock tick and audio output reflects the change
2. **Given** a mapping that assigns pad 36 to trigger scene "main" on next bar, **When** user hits the pad, **Then** the scene switches at the next bar boundary (quantized) with all patterns in the new scene activating simultaneously
3. **Given** a MIDI input mapping with 30ms smoothing, **When** user rapidly moves a fader, **Then** parameter changes are smoothed over the 30ms window preventing abrupt value jumps

---

### User Story 4 - Scene Management (Priority: P4)

A musician wants to organize patterns into named scenes (intro, main, breakdown, outro) and switch between them to structure a performance or composition.

**Why this priority**: Scenes provide higher-level organization and performance structure, but they depend on pattern playback and parameter control being solid first.

**Independent Test**: Can be fully tested by defining two scenes with different active pattern sets, switching between them via VS Code command, and verifying the correct patterns activate/deactivate.

**Acceptance Scenarios**:

1. **Given** two scenes "intro" (kick + hats) and "main" (kick + hats + bass), **When** user switches from intro to main, **Then** the bass pattern starts playing while kick and hats continue uninterrupted
2. **Given** a scene with parameter overrides (kick velocity=100 in intro, velocity=120 in main), **When** switching from intro to main, **Then** the kick velocity changes to 120 on the next bar
3. **Given** a scene is currently playing, **When** user edits the scene file to add a new pattern to the active list, **Then** the new pattern starts playing within 50ms (hot-reload)

---

### User Story 5 - Custom Script Pattern Extensions (Priority: P5)

A developer-musician wants to create custom pattern generation logic using JavaScript modules when built-in pattern types (Euclidean, probability) don't fit their creative vision.

**Why this priority**: Extensibility is powerful but non-essential for MVP. Most users will use built-in patterns initially. This feature serves advanced users and edge cases.

**Independent Test**: Can be fully tested by writing a JavaScript module that generates a custom rhythm algorithm, referencing it in a pattern file, and verifying it executes safely within the 5ms timeout and produces MIDI events.

**Acceptance Scenarios**:

1. **Given** a script module that generates a moiré phasing pattern, **When** the pattern is activated, **Then** the script executes and produces MIDI events according to its logic
2. **Given** a script module that exceeds the 5ms execution timeout, **When** the engine runs the script, **Then** execution is terminated, an error is logged with file/line reference, and the pattern is disabled to prevent engine disruption
3. **Given** a script module file is edited and saved, **When** the engine detects the change, **Then** the script is reloaded and re-validated within 50ms, and if valid, the new version executes on the next tick

---

### User Story 6 - VS Code Integration and Diagnostics (Priority: P6)

A user wants to view engine status (BPM, current scene, active patterns), see validation errors inline in their editor, and control the engine (start/stop/switch scenes) without leaving VS Code.

**Why this priority**: VS Code integration is what makes the workflow seamless, but it requires the engine features to exist first. This is the UI layer over functional engine capabilities.

**Independent Test**: Can be fully tested by opening a project in VS Code with the extension installed, starting the engine, introducing a validation error in a pattern file, and verifying the error appears as a diagnostic with file/line precision.

**Acceptance Scenarios**:

1. **Given** VS Code is open with the GenSeq extension and a project loaded, **When** user runs "Start Engine" command, **Then** the status bar shows "Playing | 120 BPM | Scene: main" and updates in real-time
2. **Given** the engine is running, **When** user saves an invalid pattern file (missing required field), **Then** VS Code displays a diagnostic error on the exact line with the issue and suggests the fix
3. **Given** VS Code is showing the pattern tree view, **When** a pattern file is edited, **Then** the tree view updates within 100ms to reflect the change (pattern name, parameters)

---

### Edge Cases

- **Empty Project Directory**: What happens when the engine starts with no pattern files? System should start in an idle state with clock running but no MIDI output, allowing hot-reload of patterns to be added later.
- **MIDI Device Disconnection**: How does the system handle a hardware MIDI device being unplugged during playback? Engine should detect disconnection, log an error, continue running the clock, and attempt to reconnect if the device reappears.
- **Simultaneous File Edits**: What happens when multiple pattern files are saved within the same 50ms window? Engine should queue all changes and apply them atomically at the next safe reload point (e.g., bar boundary) to prevent partial state.
- **Clock Drift Over Time**: How does the system prevent cumulative timing errors during long sessions? Engine must recalibrate the high-resolution clock periodically to prevent drift beyond 1ms variance.
- **Circular Dependencies in Mappings**: What happens if a MIDI input mapping creates a feedback loop (e.g., output triggers input)? Validation should detect and reject circular mappings at load time.
- **Malformed YAML/JSON**: How does the system handle syntax errors in configuration files? Parser should provide file/line/column precision in error messages displayed in VS Code diagnostics.
- **Resource Exhaustion with Many Patterns**: What happens when 200 patterns are active simultaneously and exceed the 200MB memory budget? Engine should reject new pattern activations when approaching the limit and display a warning.
- **Script Module Sandbox Escape Attempts**: How does the system prevent malicious or buggy scripts from accessing filesystem or network? Sandbox must enforce strict isolation and reject any attempted access outside the permitted API surface.
- **Rapid Scene Switching**: What happens when scenes are switched faster than the quantization period (e.g., every 100ms when quantized to bars)? Engine should queue scene changes and apply them at the next valid quantization point, preventing overlapping transitions.
- **Invalid MIDI Input Device Names**: What happens when a mapping references a MIDI device that doesn't exist? Engine should log a warning, skip that mapping, and continue loading valid mappings.

## Requirements *(mandatory)*

### Functional Requirements

**Engine Core**:

- **FR-001**: Engine MUST run as a headless Node.js process that can be started from CLI or VS Code extension
- **FR-002**: Engine MUST maintain a high-resolution clock using sub-millisecond precision timing with <1ms jitter variance
- **FR-003**: Engine MUST load project configuration from a directory structure containing clock.yaml, patterns/*.json, routes/*.json, scenes/*.json, mappings/*.json, and scripts/*.js
- **FR-004**: Engine MUST validate all configuration files against JSON schemas before loading and reject invalid files with errors indicating file/line/issue
- **FR-005**: Engine MUST watch configuration files for changes using a file watcher and hot-reload within 50ms without stopping transport (where feasible)

**Pattern Generation**:

- **FR-006**: Engine MUST support built-in pattern types including Euclidean rhythms, probability-based patterns, and phase-offset patterns
- **FR-007**: Patterns MUST target logical buses (not raw MIDI ports) to enable flexible routing
- **FR-008**: Patterns MUST support parameter definitions (steps, pulses, rotation, velocity, etc.) that can be overridden at the scene level
- **FR-009**: Engine MUST schedule MIDI events with <5ms latency from the intended clock time

**MIDI Output**:

- **FR-010**: Engine MUST send MIDI note-on, note-off, and CC messages to configured output devices
- **FR-011**: Routing configuration MUST map logical buses to physical MIDI devices and channels
- **FR-012**: Engine MUST support multiple simultaneous MIDI output devices

**MIDI Input & Gestural Control**:

- **FR-013**: Engine MUST listen for MIDI input (notes, CC, from specific devices/channels) and route events to mapped targets
- **FR-014**: Input mappings MUST support transformation functions including scaling (value ranges), curves (linear/exponential), smoothing (time-based averaging), dead zones, and quantization
- **FR-015**: Input mappings MUST route to pattern parameters, scene triggers, or macro controls that fan out to multiple parameters
- **FR-016**: Scene triggers from MIDI input MUST support quantization to bar/beat boundaries
- **FR-017**: Mapping changes MUST hot-reload without restarting the engine

**Scene Management**:

- **FR-018**: Scenes MUST define which patterns are active, with optional parameter overrides and macro values
- **FR-019**: Engine MUST support switching scenes on-demand or via MIDI input
- **FR-020**: Scene switches MUST be quantizable to bar or beat boundaries to prevent timing glitches

**Script Extensibility**:

- **FR-021**: Engine MUST support user-defined JavaScript modules for custom pattern logic
- **FR-022**: Script modules MUST run in isolated sandboxes with resource limits (5ms execution timeout, 10MB memory)
- **FR-023**: Script modules MUST be validated against a defined contract before execution
- **FR-024**: Script modules MUST be hot-reloadable when files change

**VS Code Extension**:

- **FR-025**: Extension MUST provide tree views for patterns, scenes, routes, mappings, and devices
- **FR-026**: Extension MUST display real-time engine status including transport state (playing/stopped), BPM, current scene, and active patterns
- **FR-027**: Extension MUST show validation diagnostics (errors/warnings) with file/line precision when configuration files are invalid
- **FR-028**: Extension MUST provide command palette entries for Start Engine, Stop Engine, Switch Scene, and Reload Configuration
- **FR-029**: Extension MUST provide webview visualizations for pattern timelines, phasing diagrams, and live MIDI activity

**Performance & Reliability**:

- **FR-030**: System MUST achieve all performance contracts: clock jitter <1ms, MIDI latency <5ms, hot-reload <50ms, startup <2s, memory <200MB for 100 patterns, CPU <25% single core at 120 BPM with 50 patterns
- **FR-031**: All performance metrics MUST be verified through automated benchmarks that fail when thresholds are exceeded

### Key Entities

- **Clock**: Represents timing configuration (BPM, swing, PPQ, transport policy). Controls the master timeline that all patterns follow.

- **Pattern**: Describes how MIDI events are generated over time. Has a type (Euclidean, probability, script, etc.), parameters, target bus/note/channel, and length in bars. Patterns are declarative definitions, not runtime state.

- **Route/Bus**: Maps logical bus names to physical MIDI device names and channels. Enables patterns to target abstract buses rather than hardcoded devices.

- **Scene**: Defines a performance state by specifying which patterns are active, parameter overrides for those patterns, and macro values. Scenes are switchable presets.

- **Mapping**: Defines how incoming MIDI events (device, channel, CC/note number) are transformed and routed to engine targets (pattern parameters, macros, scene triggers). Includes transformation rules like scaling and smoothing.

- **Script Module**: User-defined JavaScript file implementing a custom pattern generation algorithm. Must export a `create(context, params)` function returning a `tick(time)` method.

- **Macro**: A named control that maps one-to-many to pattern parameters, enabling a single input (e.g., fader) to affect multiple patterns simultaneously.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Musicians can create a basic generative MIDI pattern and hear it play through hardware within 5 minutes of project setup
- **SC-002**: Users can edit pattern parameters in VS Code and hear changes reflected within 50 milliseconds without playback interruption
- **SC-003**: The system maintains clock timing precision with less than 1 millisecond variance over 10-minute continuous sessions
- **SC-004**: MIDI events are delivered to hardware with less than 5 milliseconds latency from scheduled time, verified by loopback testing
- **SC-005**: The engine handles 50 active patterns simultaneously at 120 BPM while consuming less than 25% of a single CPU core
- **SC-006**: The engine consumes less than 200 MB of memory when running 100 patterns concurrently
- **SC-007**: Configuration file changes are detected and applied within 50 milliseconds from save
- **SC-008**: The engine starts from launch to first MIDI output in less than 2 seconds
- **SC-009**: Musicians can map a hardware MIDI controller (fader/knob) to a pattern parameter and hear real-time response within one clock tick
- **SC-010**: Users receive clear, actionable error messages with file and line numbers when configuration files are invalid, visible in VS Code diagnostics
- **SC-011**: Custom script modules execute safely within a 5ms timeout and 10MB memory limit without crashing the engine
- **SC-012**: 90% of users successfully complete their first pattern-to-hardware playback test on the first attempt without consulting documentation (measured via onboarding telemetry)

### Assumptions

- Users have basic familiarity with JSON/YAML file formats
- Users have access to MIDI hardware devices (synthesizers, drum machines) or virtual MIDI routing
- Users have VS Code installed and can install extensions
- Git is available for version control (branches as different sets/systems)
- Node.js 18+ is installed on the user's system
- Users creating custom scripts have basic JavaScript knowledge
- MIDI devices are connected via USB-MIDI or virtual MIDI ports before engine start
- Users have write permissions to the project directory for file editing
- The system runs on macOS, Linux, or Windows with Node.js support
- Users understand basic music concepts (BPM, bars, beats, notes, velocity)
