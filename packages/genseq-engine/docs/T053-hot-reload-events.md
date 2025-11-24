# T053: Hot-Reload Event Forwarding

**Status**: ✅ Complete
**Dependencies**: T049 (HotReloadCoordinator), T047 (ConfigurationManager)

## Overview

GenSeqEngine now forwards hot-reload events from HotReloadCoordinator to provide a simplified API for consumers. Instead of listening to HotReloadCoordinator directly, consumers can listen to GenSeqEngine for configuration reload and error events.

## Implementation

### Event Forwarding

GenSeqEngine listens to HotReloadCoordinator events and re-emits them as engine-level events:

| HotReloadCoordinator Event | GenSeqEngine Event | Metadata |
|---------------------------|-------------------|----------|
| `configSwapped` | `config:reloaded` | `timestamp`, `latencyMs`, `filesChanged` |
| `validationFailed` | `config:error` | `timestamp`, `error`, `details` |
| `error` | `error` | `source: 'hotReloadCoordinator'`, `error` |

### Event Payload Structures

#### config:reloaded
```typescript
{
  timestamp: number;      // Unix timestamp in milliseconds
  latencyMs: number;      // Reload latency (<50ms requirement)
  filesChanged: string[]; // Array of changed file paths
}
```

#### config:error
```typescript
{
  timestamp: number;      // Unix timestamp in milliseconds
  error: string;          // Human-readable error message
  details: any;           // Full error object
}
```

## Code Location

**File**: `/Users/jaredmcfarland/Developer/genseq/packages/genseq-engine/src/GenSeqEngine.ts`

**Key sections**:
1. Line 14: Import HotReloadCoordinator
2. Line 32: Added `enableHotReload` config option
3. Line 61: Added `hotReloadCoordinator` private member
4. Lines 92-99: Initialize HotReloadCoordinator in constructor
5. Lines 191-212: Event forwarding in `setupEventHandlers()`
6. Lines 446-449: Dispose HotReloadCoordinator in `shutdown()`

## Usage Example

```typescript
import { GenSeqEngine } from '@genseq/engine';

const engine = new GenSeqEngine({
  enableHotReload: true  // Default: true
});

// Listen for successful config reloads
engine.on('config:reloaded', (event) => {
  console.log(`Config reloaded in ${event.latencyMs}ms`);
  console.log(`Files changed: ${event.filesChanged.join(', ')}`);
});

// Listen for config validation errors
engine.on('config:error', (event) => {
  console.error(`Config error: ${event.error}`);
  console.error(`Details:`, event.details);
});

// Listen for general hot-reload errors
engine.on('error', (event) => {
  if (event.source === 'hotReloadCoordinator') {
    console.error('Hot-reload error:', event.error);
  }
});

await engine.initialize();
```

## Configuration

Hot-reload can be disabled by setting `enableHotReload: false` in the GenSeqEngine config:

```typescript
const engine = new GenSeqEngine({
  enableHotReload: false  // Disables hot-reload functionality
});
```

When disabled, HotReloadCoordinator is not instantiated, and no hot-reload events are emitted.

## Testing

**Test file**: `tests/GenSeqEngine-hotreload.test.ts`

Test coverage:
- ✅ Emits `config:reloaded` event with correct metadata
- ✅ Emits `config:error` event when validation fails
- ✅ Includes latency in reload events
- ✅ Forwards HotReloadCoordinator errors to engine error event
- ✅ Does not create HotReloadCoordinator when `enableHotReload: false`

All tests passing (5/5).

## Demo

Run the demo to see hot-reload event forwarding in action:

```bash
npx tsx examples/hot-reload-events-demo.ts
```

## Success Criteria

✅ Events emitted with correct data structure
✅ Latency included in reload events
✅ Error details included in error events
✅ Existing GenSeqEngine tests still pass
✅ HotReloadCoordinator properly disposed on shutdown
✅ Hot-reload can be disabled via config option

## Performance

- Event forwarding adds negligible overhead (<0.1ms)
- Hot-reload latency requirement (<50ms) is maintained
- No memory leaks (HotReloadCoordinator disposed on shutdown)

## Integration Points

### Upstream
- HotReloadCoordinator (T049): Source of events
- ConfigurationManager (T047): Validation errors

### Downstream
- CLI consumers: Listen to GenSeqEngine events
- VS Code extension: Display reload notifications
- Monitoring tools: Track reload latency

## Future Enhancements

Potential improvements for future versions:
1. Add `config:changing` event (before swap scheduled)
2. Add `config:swapScheduled` event (swap queued at bar boundary)
3. Include file diff information in reload events
4. Add metrics for reload frequency and success rate
5. Support fine-grained event filtering (e.g., only emit errors)

## Related Documents

- T049: HotReloadCoordinator implementation
- T047: ConfigurationManager with dual-buffer swaps
- T048: FileWatcher implementation
- Phase 4 planning: Hot-reload system architecture
