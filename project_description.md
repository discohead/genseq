# **Project: File-Driven, Algorithmic, Generative MIDI Sequencer**

### **With VS Code as the UI and Declarative Gestural Control**

---

## **1. Overview**

This project is a **file-driven, algorithmic MIDI sequencer and control environment** whose UI is **Visual Studio Code**.

At its core is a **headless Node-based engine** that:

- Reads a structured project directory on disk (JSON/YAML/script modules)
- Builds a graph of clocks, patterns, routes, scenes, and mappings
- Emits and receives MIDI (and eventually OSC / lighting)
- Watches project files for changes and hot-reloads its behavior

VS Code is not just a convenient editor here; it is **the control surface and primary interface**. A custom VS Code extension provides:

- Project views (patterns, scenes, devices, mappings)
- Diagnostics and status (transport, BPM, active scene)
- Visualizations (via webviews) for patterns, phasing, gestural inputs
- Command palette entries and keybindings to interact with the running engine

The engine and VS Code are designed to work together: **VS Code acts as the "control plane"**, while the engine is the **real-time data plane**.

---

## **2. Core Principles**

### **2.1 Architectural Principles**

1. **VS Code as Instrument UI**

   The interface to this system is the editor itself. Files, panels, and commands in VS Code are the knobs, sliders, and patch cables. No separate custom GUI is assumed or required.

2. **Declarative, File-Driven Behavior**

   The project directory is the single source of truth. Musical structure, routing, scenes, and mappings live as JSON/YAML and simple script modules on disk. Git branches are different "systems" or "sets".

3. **Bidirectional MIDI: Output and Input**

   The engine doesn't just send MIDI – it **consumes** MIDI input as a primary control modality. The declarative model defines how incoming MIDI (notes, CCs, sysex, from specific devices/channels) is:

   - Filtered
   - Transformed
   - Mapped onto engine parameters, macros, pattern parameters, scene changes, etc.

   This enables rapid prototyping of complex gestural interfaces on arbitrary MIDI hardware.

4. **Headless, Always-On Engine**

   The engine runs as a long-lived Node process. It can be started from the CLI or via the VS Code extension, but once running, it has no UI of its own.

5. **Extensibility via Script Modules**

   Built-in declarative primitives are supplemented by user-defined JavaScript modules ("script nodes") that implement custom pattern logic or transforms. The declarative model references these modules but they stay self-contained.

6. **Deterministic When Desired**

   With versioned configuration, seedable randomness and explicit clock settings, the same project directory should be able to produce repeatable musical behavior.

7. **Composable, Not Monolithic**

   The system is a framework and runtime for generative and gestural control, not a DAW. It is designed to integrate with external synths, DAWs, lighting systems, and other tools.

### **2.2 Development Principles**

8. **Library-First Architecture**

   The system is built as independently testable, composable libraries:
   - **genseq-engine**: Core clock, scheduler, pattern engine, MIDI I/O
   - **genseq-vscode**: VS Code extension UI layer
   - **genseq-patterns**: Standard pattern library collection

   Each library has clear boundaries, can be tested in isolation, and serves a single well-defined purpose.

9. **Test-First Development**

   All timing-critical and core functionality is developed test-first:
   - Write comprehensive tests that must fail initially (Red phase)
   - Implement minimal solution to make tests pass (Green phase)
   - Refactor while maintaining passing tests

   This is **non-negotiable** for clock precision, pattern generation, MIDI I/O, and configuration validation.

10. **Performance as Contract**

    Real-time performance requirements are measurable, testable contracts:
    - Clock jitter: <1ms variance
    - MIDI output latency: <5ms from scheduled time
    - Hot-reload time: <50ms for configuration changes
    - Memory footprint: <200MB for 100 patterns
    - Startup time: <2 seconds from launch to first MIDI output

    All performance requirements must be verified through automated benchmarks.

11. **Schema-Driven Validation**

    All configuration files (patterns, scenes, mappings, routing) are validated against JSON schemas before loading. Invalid configurations are rejected with clear error messages indicating file, line, and issue. This enables:
    - AI agents to safely edit configurations
    - Real-time validation feedback in VS Code
    - Automated migration between schema versions

---

## **3. Intended Use Cases**

- Designing **generative techno / experimental sets** that are defined as code and data

- Rapidly mapping and remapping **MIDI controllers into gestural control surfaces**:

  - Faders as macro controls
  - Pads as scene triggers
  - Encoders as pattern morphers or phase offsets

- Research and exploration of:

  - Rhythmic systems, phasing, moiré / interference patterns
  - Multi-timescale modulation and algorithmic structures

- Human + AI collaboration:

  - AI agents editing pattern and mapping files
  - You refining and curating via VS Code and Git
  - Spec-driven development enabling clear contracts between human intent and AI implementation

---

## **4. High-Level Architecture**

Conceptual architecture:

```
┌──────────────────────────────────────────┐
│          VS CODE (Control Plane)        │
│  - Project files (JSON/YAML/JS)         │
│  - Custom extension:                    │
│    • Tree views (patterns/scenes/maps)  │
│    • Webviews (visualizations)          │
│    • Commands & keybindings             │
│    • Engine status (BPM, scene, errors) │
└──────────────────────────────────────────┘
                 ▲           │
     edits files │           │ commands / info (optional)
                 │           ▼
┌──────────────────────────────────────────┐
│  PROJECT DIR (Source of Truth)           │
│  - project.json                          │
│  - clock.yaml                            │
│  - patterns/*.json                       │
│  - mappings/*.json    ← MIDI input maps  │
│  - routes/*.json                         │
│  - scenes/*.json                         │
│  - scripts/*.js      ← custom logic      │
└──────────────────────────────────────────┘
                 │ watched
                 ▼
┌──────────────────────────────────────────┐
│           ENGINE (Data Plane)           │
│  - Clock / scheduler                    │
│  - Pattern graph                        │
│  - MIDI output routing                  │
│  - MIDI input handling & mapping        │
│  - Script node loader                   │
│  - Live reload & validation             │
└──────────────────────────────────────────┘
         ▲                       ▼
         │ MIDI IN           MIDI OUT / OSC / etc
         │
┌──────────────────────────────────────────┐
│         External Devices & Apps          │
│  - MIDI controllers (faders, pads)       │
│  - Synths, drum machines, DAWs           │
│  - Lighting / visual systems (future)    │
└──────────────────────────────────────────┘
```

---

## **5. Project Structure (Example)**

```
my-set/
  project.json           # metadata & top-level config
  clock.yaml             # BPM, swing, PPQ, transport policy

  patterns/
    drums.json
    hats.json
    bass.json

  mappings/
    controllers.json     # MIDI-IN → macros/params
    gestures.json        # higher-level gestural abstractions

  routes/
    routing.json         # logical buses → MIDI ports/channels

  scenes/
    intro.json
    main.json
    breakdown.json
    outro.json

  scripts/
    weirdOsc.js          # custom pattern module
    phaseMoiré.js        # custom timing/phase logic
```

---

## **6. Data Model (Conceptual)**

### **6.1 Patterns**

**Responsibility:** Describe how events are generated over time.

- **Built-in pattern kinds** (e.g. euclidean, phase, probability).
- **Scripted pattern kinds** via JS modules (kind: "script").
- Patterns target **logical destinations**, not raw MIDI ports.

Example (simplified):

```json
{
  "patterns": [
    {
      "id": "kick-euclid",
      "kind": "euclidean",
      "params": {
        "steps": 16,
        "pulses": 5,
        "rotation": 0,
        "velocity": 115
      },
      "target": {
        "bus": "drum-bus",
        "note": 36,
        "channel": 1
      },
      "lengthBars": 1
    }
  ]
}
```

### **6.2 Routing**

**Responsibility:** Map logical buses to real devices/ports/channels.

```json
{
  "outputs": [
    {
      "id": "drum-bus",
      "type": "midi",
      "device": "Elektron Digitone",
      "channelOverride": null
    }
  ]
}
```

### **6.3 Scenes**

**Responsibility:** Define which patterns are active and with what parameter overrides, as well as macro values.

```json
{
  "id": "main",
  "activePatterns": [
    {
      "patternId": "kick-euclid",
      "muted": false,
      "paramsOverride": { "rotation": 0 }
    }
  ],
  "macros": {
    "density": 0.8,
    "tension": 0.3
  }
}
```

### **6.4 MIDI Input Mappings (Gestural Layer)**

**Responsibility:** Define how raw MIDI input events get turned into meaningful engine controls.

This layer provides:

- **Device-specific mappings**:

  - "On controller LPD8, CC 1 on channel 1 → macro density"

- **Filtering & transformation**:

  - Scaling, curves, ranges, dead zones, smoothing
  - Velocity/CC quantization, toggles, latches, momentary behavior

- **Routing to engine parameters**:

  - Pattern parameters (e.g. Euclidean rotation, probability)
  - Scene transitions (e.g. "Pad 1 → switch to intro on next bar")
  - Macros that fan out to multiple underlying parameters

Example sketch:

```json
{
  "devices": [
    {
      "id": "akai-lpd8",
      "match": { "nameContains": "LPD8" },
      "mappings": [
        {
          "type": "cc",
          "channel": 1,
          "cc": 1,
          "transform": {
            "scale": [0, 127, 0.0, 1.0],
            "curve": "exp",
            "smoothingMs": 30
          },
          "target": {
            "kind": "macro",
            "name": "density"
          }
        },
        {
          "type": "note",
          "channel": 1,
          "note": 36,
          "behavior": "momentary",
          "target": {
            "kind": "scene",
            "sceneId": "main",
            "quantizeToBars": 4
          }
        }
      ]
    }
  ]
}
```

The goal: **rapidly map arbitrary hardware into meaningful musical gestures without touching engine code.**

---

## **7. Script Modules (Custom Logic)**

When built-in pattern or mapping primitives aren't enough, the declarative model can reference JS script modules.

The engine expects a minimal contract:

```javascript
// scripts/weirdOsc.js

export function create(context, params) {
  let phase = params.phase ?? 0;

  return {
    tick(time) {
      // time in beats/seconds, depending on context
      // compute gates or parameter changes
      return {
        gates: [
          // events with offsets, velocities, etc.
        ]
      };
    }
  };
}
```

These modules:

- Are plain JavaScript (no runtime TypeScript required).
- Are referenced by patterns or higher-level "script nodes".
- Can be hot-reloaded when their files change.
- Run in isolated sandboxes with resource limits (5ms execution timeout, 10MB memory).
- Are validated against the script module contract before execution.

---

## **8. Interaction Model**

### **Editing & Control**

- You work in **VS Code**, opening the project folder.

- The **VS Code extension** provides:

  - Tree views: patterns, scenes, routes, mappings, devices.

  - Webviews: pattern visualizers, phasing diagrams, live MIDI activity.

  - Commands:

    - Start/stop engine
    - Switch scenes
    - Rebuild/validate project
    - Focus specific pattern or mapping

  - Real-time validation diagnostics with file/line error locations

### **Runtime Behavior**

- The engine is started via CLI or an extension command:

  - `genseq run ./my-set`

- It loads the current project files into an internal EngineState.

- It begins:

  - Driving the clock & scheduling events
  - Emitting MIDI to configured outputs
  - Listening to MIDI input and applying mappings

- When you or an AI agent edit files:

  - The engine sees file changes
  - Validates the changed configuration against schemas
  - Rebuilds the relevant parts of the graph
  - Applies new behavior **without losing transport**, where feasible

---

## **9. Tech Stack (High-Level)**

- **Engine:** Node.js 18+, authored in TypeScript 5+, compiled to ES2022
- **Config / Model:** JSON and YAML files with JSON Schema validation
- **Script Nodes:** Plain JavaScript modules (ES2022)
- **MIDI I/O:** Node MIDI library (easymidi or node-midi - RtMidi bindings)
- **Editor & UI:** Visual Studio Code with a custom extension (TypeScript)
- **Scheduling:** Custom high-resolution scheduler using `process.hrtime.bigint()`
- **File Watching:** chokidar with debouncing
- **Script Sandboxing:** isolated-vm or vm2 for secure execution
- **Versioning:** Git assumed; branches as alternate systems/sets
- **Testing:** Vitest or Jest with timing precision test framework

Key commitments:

- Node-based headless engine
- VS Code as the primary UI and workflow hub
- File-driven configuration and behavior
- Direct use of proven libraries (no unnecessary abstractions)
- Measurable performance requirements with automated verification

---

## **10. Success Criteria**

The project is "working" when:

### **Functional Success**

- You can:

  - Initialize a project directory with valid schemas
  - Run the engine and see real-time status in VS Code
  - Generate MIDI patterns to external gear with precise timing

- You can:

  - Map an arbitrary MIDI controller to macros and pattern parameters declaratively
  - Change those mappings in JSON files and feel the result immediately (<50ms hot-reload)
  - Validate mappings against schemas with clear error messages

- VS Code feels like a **live, programmable performance console**, where:

  - Editing data structures changes the music in real-time
  - Panels and views provide meaningful feedback on engine state
  - Diagnostics show configuration errors with file/line precision

- AI coding agents can:

  - Safely modify patterns, scenes, and mappings
  - Use schema validation to ensure structural correctness
  - Help explore alternative versions via Git branches
  - Contribute to implementation following test-first discipline

### **Performance Success**

All measurable requirements met:
- Clock jitter: <1ms variance (verified through automated benchmarks)
- MIDI output latency: <5ms from scheduled time
- Hot-reload time: <50ms for configuration changes
- Memory footprint: <200MB for 100 patterns
- Startup time: <2 seconds from launch to first MIDI output
- CPU usage: <25% single core at 120 BPM with 50 active patterns

### **Quality Success**

- Test coverage: 85-95% for timing-critical components
- All configuration schemas documented with examples
- Integration tests verify MIDI loopback and hardware compatibility
- Performance benchmarks run on every timing-related change

---

## **11. Non-Goals**

- No built-in audio synthesis engine (sound is external)
- No classic DAW UI (piano roll, waveform editing, etc.)
- Not aimed at non-technical users; it's for coders/musicians
- Not meant to replace Ableton/Bitwig; it's meant to *drive* them or hardware
- No MIDI learn mode in MVP (manual configuration acceptable for target audience)
- No scene chaining/automation in MVP (declarative definition only)
- No sysex support in MVP (standard MIDI messages only)

---

## **12. Development Approach**

This project follows **spec-driven development** principles:

### **Specification-First**

All functionality begins with a clear specification defining WHAT the system must do (not HOW). Specifications include:
- User stories with acceptance criteria
- Functional requirements organized by component
- Non-functional requirements with measurable targets
- Edge cases and error scenarios
- Data models and API contracts

### **Test-First Development**

Before implementing any functionality:
1. Write comprehensive test suite based on specification
2. Verify tests fail (Red phase)
3. Get approval on test coverage
4. Implement minimal solution to pass tests (Green phase)
5. Refactor while maintaining passing tests

### **Constitutional Governance**

Immutable architectural principles ("constitution") establish:
- Library boundaries and responsibilities
- Performance requirements as contracts
- Technology constraints and justifications
- Quality gates that must be passed before implementation
- Complexity budgets that limit system growth

### **Atomic, Testable Tasks**

Implementation proceeds through atomic tasks that:
- Are completable in one focused session
- Have explicit dependencies
- Include acceptance criteria
- Specify test-first requirements
- Map to constitutional principles

This approach enables:
- Human + AI collaboration with clear contracts
- Parallel development across independent modules
- Continuous validation of requirements compliance
- Measurable progress tracking
- Version control of specifications alongside implementation
