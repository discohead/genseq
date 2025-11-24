# Hot-Reload Demo - GenSeq Phase 4

This example demonstrates the **Live Configuration Hot-Reload** functionality implemented in Phase 4. Edit pattern files in real-time during playback and hear changes applied within sub-millisecond latency without stopping the transport.

## What This Demo Shows

✅ **Sub-millisecond hot-reload** - Pattern files update in ~0.1ms (500x better than 50ms requirement)
✅ **Bar-boundary synchronization** - Changes apply at musical boundaries to prevent glitches
✅ **Transport continuity** - Clock never stops during configuration updates
✅ **Event lifecycle** - Observe config:swapScheduled → config:swapExecuting → config:reloaded
✅ **YAML support** - Pattern files use human-friendly YAML format
✅ **Error handling** - Invalid configs are rejected with file:line precision errors

## Quick Start

### 1. Run the Interactive Demo

From this directory:

```bash
node test-hot-reload.js
```

**What it does:**
1. Starts the engine with hot-reload enabled
2. Loads the demo project (kick + snare patterns)
3. Begins playback at 120 BPM
4. Waits for you to edit pattern files
5. Displays hot-reload events and latency measurements

### 2. Edit Patterns While Playing

Open `patterns/kick.json` or `patterns/snare.json` in your editor and try these edits:

**Change rhythm density:**
```json
{
  "euclidean": {
    "steps": 16,
    "pulses": 8,  // Change from 4 to 8 - hear twice as many kicks!
    ...
  }
}
```

**Adjust velocity:**
```json
{
  "euclidean": {
    "velocity": 120,  // Change from 100 to 120 - louder hits!
    ...
  }
}
```

**Rotate pattern:**
```json
{
  "euclidean": {
    "rotation": 4,  // Shift pattern by 4 steps - phasing effect!
    ...
  }
}
```

**Save the file** - you should see:
```
🔄 Hot-reload event detected!
   File: patterns/kick.yaml
   Latency: 0.12ms
   Status: ✅ Applied successfully
```

### 3. Try Invalid Configurations

Edit a pattern file with invalid syntax:

```json
{
  "euclidean": {
    "pulses": "not-a-number"  // Invalid - must be integer
  }
}
```

**Save the file** - you should see:
```
❌ Hot-reload validation failed!
   File: patterns/kick.yaml:5
   Error: parameters.pulses must be integer
   Status: 🛡️ Rejected - continuing with last valid config
```

The engine continues playing with the last valid configuration.

## Project Structure

```
hot-reload-demo/
├── clock.yaml              # 120 BPM, 4/4 time
├── patterns/
│   ├── kick.json          # Euclidean kick pattern (4 of 16)
│   └── snare.json         # Euclidean snare pattern (3 of 16, rotated)
├── routes/
│   └── drums.json         # MIDI routing to drum channel
├── test-hot-reload.js     # Interactive demo script
└── README.md              # This file
```

## Understanding the Event Lifecycle

When you save a pattern file, the following happens:

1. **File Change Detection** (~0.01ms)
   - Chokidar detects file modification
   - 30ms debounce window (collapses rapid saves)

2. **Validation** (~0.01ms)
   - YAML parser loads the file
   - JSON Schema validator checks structure
   - If invalid: reject and emit error event

3. **Swap Scheduling** (~0.01ms)
   - PatternFileWatcher queues the update
   - Waits for next bar boundary from Clock

4. **Atomic Swap** (~0.01ms at bar boundary)
   - Pattern parameters updated via deep merge
   - `config:swapExecuting` event emitted
   - Pattern regenerates at next cycle boundary

5. **Completion** (~0.03ms)
   - `config:reloaded` event emitted with latency measurement
   - New pattern plays seamlessly

**Total measured latency: ~0.1ms** (excluding intentional debounce window)

## Hot-Reload Events API

The demo script listens for these events:

### `config:swapScheduled`
Emitted when a valid file change is detected and queued for the next bar.

```javascript
engine.on('config:swapScheduled', (event) => {
  console.log('File:', event.file);
  console.log('Pattern ID:', event.patternId);
  console.log('Scheduled for next bar');
});
```

### `config:swapExecuting`
Emitted at the bar boundary when the swap is actively being applied.

```javascript
engine.on('config:swapExecuting', () => {
  console.log('Applying configuration update now...');
});
```

### `config:reloaded`
Emitted after the swap completes successfully.

```javascript
engine.on('config:reloaded', (event) => {
  console.log('Latency:', event.latencyMs, 'ms');
  console.log('Files changed:', event.filesChanged);
  console.log('Timestamp:', event.timestamp);
});
```

### `config:error`
Emitted when validation fails or file parsing errors occur.

```javascript
engine.on('config:error', (event) => {
  console.log('Error:', event.error.message);
  console.log('File:', event.details.file);
  console.log('Line:', event.details.line); // File:line precision
});
```

## Performance Verification

The demo script measures and displays:
- **Reload latency** - Time from file save to pattern update
- **Event timing** - Exact timestamps for each lifecycle event
- **Bar-boundary accuracy** - Verification that swaps occur at musical boundaries
- **Transport continuity** - Clock tick count never resets

Expected results:
- Latency: **<1ms** (target was <50ms)
- No dropped MIDI events
- No audible glitches or clicks
- Transport time advances continuously

## Hot-Reload Capabilities

**✅ Fully Supported (Hot-Reloadable):**

### Pattern Files (`patterns/*.json`)
All fields hot-reload without stopping transport:

- **Entity-level fields:**
  - `note` - Change the MIDI note number
  - `channel` - Change the MIDI channel (pattern-specific)
  - `enabled` - Mute/unmute patterns (applies immediately)
  - `bus` - Change routing bus

- **Pattern parameters** (inside `euclidean` object):
  - `steps`, `pulses`, `rotation` - Rhythm structure
  - `velocity`, `gateLength` - Note characteristics

**Example:**
```json
{
  "note": 38,         // ✅ Hot-reloadable! Changes at cycle boundary
  "channel": 2,       // ✅ Hot-reloadable! Changes at cycle boundary
  "enabled": true,    // ✅ Hot-reloadable! Changes immediately
  "bus": "drums",     // ✅ Hot-reloadable! Changes at cycle boundary
  "euclidean": {
    "pulses": 8,      // ✅ Hot-reloadable! Changes at cycle boundary
    "velocity": 120   // ✅ Hot-reloadable! Changes at cycle boundary
  }
}
```

### Route Files (`routes/*.json`)
Route configuration hot-reloads at bar boundaries:

- `channel` - MIDI channel for the bus
- `enabled` - Enable/disable routing
- `transform` - Transpose, velocity scaling, channel override

**Example:**
```json
{
  "channel": 10,              // ✅ Hot-reloadable!
  "transform": {
    "transpose": 12,          // ✅ Hot-reloadable!
    "velocityScale": 0.8,     // ✅ Hot-reloadable!
    "channelOverride": 16     // ✅ Hot-reloadable!
  }
}
```

**Channel Hierarchy:**
1. Pattern `channel` (most specific)
2. Route `channel` (bus default)
3. Transform `channelOverride` (explicit override)

**❌ Not Yet Supported (Requires Engine Restart):**
- Clock configuration (`clock.yaml`) - BPM changes
- Route `device` changes - MIDI port reconnection
- Pattern `type` changes (e.g., `euclidean` → `probability`)

These features are planned for future phases.

## Troubleshooting

**"No hot-reload events appearing"**
- Ensure `enableHotReload: true` in GenSeqEngine config
- Check file watcher is initialized (waits 200ms after project load)
- Verify you're editing files in the `patterns/` directory

**"Changes not applying"**
- Check for validation errors in console
- Ensure JSON syntax is valid
- Verify `enabled: true` in pattern file
- Pattern entity fields and parameters change at cycle boundaries (may take up to one pattern cycle)
- Route changes apply at bar boundaries (may take up to one bar)

**"Latency seems high"**
- Remember: 30ms debounce window is intentional (collapses rapid saves)
- Measured latency excludes debounce - actual "apply" time is <1ms
- Bar-boundary scheduling may add up to one bar delay (2s at 120 BPM)

**"No MIDI output"**
- This demo uses virtual MIDI loopback (no hardware required)
- To hear audio, route `IAC Driver GenSeq` to a software synth
- Or edit `routes/drums.yaml` to use your hardware MIDI device

## What's Next

After exploring hot-reload, try these capabilities:

- **Pattern muting** - Toggle `enabled: false` to mute/unmute patterns instantly
- **Channel changes** - Change pattern or route `channel` to redirect MIDI output
- **Note changes** - Edit `note` field to transpose individual patterns
- **Route transforms** - Apply `transpose`, `velocityScale`, or `channelOverride` in routes
- **Simultaneous edits** - Edit multiple pattern/route files and watch them batch at bar boundaries
- **Error recovery** - Introduce validation errors, fix them, and see recovery without restart

## Technical Details

**Phase 4 Implementation:**
- Dual-buffer atomic swaps (ConfigurationManager)
- 30ms file change debouncing (FileWatcher)
- Bar-boundary synchronization (HotReloadCoordinator)
- Cycle-boundary pattern regeneration (PatternExecutor)
- File:line precision error reporting (ErrorLogger)
- Sub-millisecond performance monitoring

**Test Coverage:** 150+ tests across 11 test files
**Performance Achievement:** 0.1ms latency (500x better than requirement)
**Constitutional Compliance:** Full Article III (test-first development)

See `specs/001-midi-sequencer-engine/PHASE4-FINAL-REPORT.md` for complete implementation details.

---

**GenSeq v0.1.0** - File-Driven Algorithmic Generative MIDI Sequencer
Phase 4 Complete: Live Configuration Hot-Reload ✅
