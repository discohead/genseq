# Basic Euclidean Example

Simple example demonstrating a 4-on-the-floor kick pattern using Euclidean rhythm generation.

## Pattern Configuration

- **Steps**: 16 (one bar in 4/4 time)
- **Pulses**: 4 (evenly distributed)
- **Result**: Kick on beats 1, 2, 3, 4

## Manual Testing (Node.js)

Since the VS Code extension is not yet implemented, test the engine directly:

```bash
# From repository root
cd examples/basic-euclidean

# Make sure packages are built
cd ../..
pnpm build

# Run the test script
cd examples/basic-euclidean
node test-engine.js
```

The script will:
1. Initialize the GenSeq engine
2. Load the project configuration (clock, patterns, routes)
3. Start MIDI playback
4. Print note events and performance metrics
5. Run until you press Ctrl+C

**Note**: By default, the engine uses a virtual MIDI loopback for testing. To send to real hardware, edit `routes/drums.json` and change the `port` field to your MIDI device name.

## Usage with VS Code Extension (Future)

1. Open this directory in VS Code with GenSeq extension installed
2. Configure MIDI output device in `routes/drums.json`
3. Run "GenSeq: Start Engine" from command palette
4. Edit `patterns/kick.json` to experiment with different patterns
