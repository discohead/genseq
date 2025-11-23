# Custom Scripts Example

Example project demonstrating custom JavaScript pattern generators.

## Features

- Custom algorithmic pattern generation
- Safe script execution with resource limits
- Access to helper functions (euclidean, probability, scale)

## Example Scripts

Scripts will be added after Phase 7 (User Story 5) is complete.

## Writing Custom Patterns

Custom patterns must export a `generate()` function that returns MIDI events:

```javascript
export function generate(context) {
  const events = [];
  // Generate MIDI events based on context
  return events;
}
```
