# Hot-Reload Bug Report: Feature Completely Broken

## Summary

Phase 4 hot-reload functionality **does NOT work**. The system correctly detects file changes and fires all events, but **NO parameter changes affect MIDI output**. All euclidean parameters (`pulses`, `steps`, `rotation`, `velocity`, `gateLength`) remain unchanged until engine restart.

## Test Evidence

### Test 1: Drastic Change Test (DEFINITIVE)
```bash
Phase 1 (baseline): Kick hits: 5, Snare hits: 4
File modified: kick pulses 4 → 0 (should SILENCE kick completely)
Phase 2 (after hot-reload): Kick hits: 10 ❌ (still playing!)

RESULT: ❌ FAILED - Hot-reload completely broken
```

### Test 2: Velocity Test
```bash
Phase 1 (baseline): All snare hits at velocity 127
File modified: velocity 127 → 60
Phase 2 (after hot-reload): All snare hits STILL at velocity 127 ❌
```

### Test 3: User Manual Testing
User confirmed:
- Changing `pulses`: Events fire but MIDI doesn't change ❌
- Changing `steps`: Events fire but MIDI doesn't change ❌
- Changing `rotation`: Events fire but MIDI doesn't change ❌
- Changing `velocity`: Events fire but MIDI doesn't change ❌

## What Works ✅

- **File watcher**: Detects changes within 30ms debounce window
- **Event system**: All `config:*` events fire correctly
- **Bar-boundary sync**: Timing infrastructure works
- **Error handling**: Invalid configs rejected (but see crash bug below)

## What Doesn't Work ❌

- **ALL euclidean parameters**: `steps`, `pulses`, `rotation`, `velocity`, `gateLength` - NONE update MIDI output
- **Entity-level fields**: `note`, `channel`, `enabled`, `bus` (documented limitation, not tested)
- **Routes**: Not watched by file watcher (documented limitation)

## Critical Crash Bug 🔥

When an invalid pattern is saved (e.g., `pulses > steps`), then corrected:

1. First save: Validation correctly rejects invalid config ✅
2. Second save (valid): Engine crashes with unhandled error ❌

```
Error: Pattern snare not found
  at PatternExecutor.updatePatternParameters
  at GenSeqEngine.reloadPattern
```

**Root cause**: After validation failure, pattern appears to be removed from PatternExecutor's pattern map, so subsequent valid updates crash trying to update non-existent pattern.

## Root Cause Analysis Needed

**Primary Hypothesis**: Pattern parameters are being updated in memory, but the pattern generator is not being regenerated with the new parameters. The `pendingUpdate` flag may be set, but pattern execution continues using the old cached pattern data.

**Investigation needed**:
1. Verify `updatePatternParameters()` is called (add logging)
2. Verify `pendingUpdate` flag is set (add logging)
3. Verify `onTick()` detects `pendingUpdate` and emits `patternRegenerated` (add logging)
4. **Critical**: Verify pattern actually regenerates - not just event emission

## Reproduction Steps

1. Run `node test-midi-verification.js` in hot-reload-demo
2. Observe that pulses change is detected (9 → 10 snare hits)
3. Observe that velocity change is NOT detected (stays at 90)

OR manually:

1. `cd examples/hot-reload-demo`
2. `node test-hot-reload.js`
3. Edit `patterns/snare.json`: change `euclidean.velocity` from 90 to 120
4. Save file
5. Observe hot-reload events fire ✅
6. Listen to MIDI output: velocity unchanged ❌

## Files to Investigate

- `packages/genseq-engine/src/patterns/PatternExecutor.ts:91-105` - Pattern context creation
- `packages/genseq-engine/src/patterns/PatternExecutor.ts:184-204` - updatePatternParameters
- Euclidean pattern generator - how does it use `velocity`?
- MIDI event creation - where is velocity captured?

## Automated Feedback Loop

The `test-midi-verification.js` script now provides automated verification:
- ✅ Captures MIDI events via `midi:noteOn`/`midi:noteOff` listeners
- ✅ Compares before/after hot-reload
- ✅ Detects both rhythm and velocity changes
- ✅ Exit code 0 (pass) or 1 (fail)

## Impact

**User Experience**: Users will see hot-reload events fire and believe the feature works, but changes to velocity, gate length, and note numbers will NOT be heard until engine restart. This is confusing and makes the feature appear broken.

**Recommendation**: Either fix the bug or update documentation to clearly state only rhythm parameters (`steps`, `pulses`, `rotation`) are hot-reloadable in v0.1.0.

---

**Discovered**: 2025-11-23
**Test Script**: [test-midi-verification.js](test-midi-verification.js)
**Affected Phase**: Phase 4 - Live Configuration Hot-Reload
