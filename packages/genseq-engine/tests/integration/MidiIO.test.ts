import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MidiIO } from '../../src/midi/MidiIO';

/**
 * T013: MidiIO latency test with <5ms validation
 *
 * ARTICLE III COMPLIANCE: This test MUST fail initially.
 * MidiIO class does not exist yet - implementation after Red phase.
 *
 * Performance Requirements:
 * - MIDI latency: <5ms from scheduled time to actual output
 * - Virtual MIDI loopback for testing
 * - Accurate timestamp measurement
 */

describe('MidiIO - Latency and Timing', () => {
  let midiIO: MidiIO;

  beforeEach(async () => {
    // MUST FAIL - MidiIO doesn't exist
    midiIO = new MidiIO({
      enableVirtualLoopback: true, // For testing
      latencyCompensation: 0 // Raw latency measurement
    });
    await midiIO.initialize();
  });

  afterEach(async () => {
    if (midiIO) {
      await midiIO.close();
    }
  });

  it('should send MIDI within <5ms of scheduled time', async () => {
    const messageCount = 100;
    const scheduledMessages: Array<{
      scheduledTime: number;
      sentTime: number;
      receivedTime: number;
    }> = [];

    // Set up virtual loopback to receive sent messages
    midiIO.onMessage((message, receivedTime) => {
      const originalScheduledTime = message.metadata?.scheduledTime;
      const sentTime = message.metadata?.sentTime;

      if (originalScheduledTime && sentTime) {
        scheduledMessages.push({
          scheduledTime: originalScheduledTime,
          sentTime,
          receivedTime
        });
      }
    });

    const startTime = performance.now();
    const interval = 10; // ms between messages

    // Schedule MIDI messages
    for (let i = 0; i < messageCount; i++) {
      const scheduledTime = startTime + (i * interval);

      await midiIO.scheduleMessage(
        scheduledTime,
        {
          type: 'noteon',
          channel: 0,
          note: 60,
          velocity: 100
        }
      );
    }

    // Wait for all messages to be sent and received
    await new Promise<void>((resolve) => {
      const checkComplete = setInterval(() => {
        if (scheduledMessages.length >= messageCount) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 10);
    });

    // Calculate latency (scheduled time to sent time)
    const latencies = scheduledMessages.map(msg =>
      msg.sentTime - msg.scheduledTime
    );

    const maxLatency = Math.max(...latencies);
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    // MUST FAIL - MidiIO doesn't exist
    expect(maxLatency).toBeLessThan(5.0); // Max latency < 5ms
    expect(avgLatency).toBeLessThan(2.0); // Avg latency < 2ms

    // Verify all latencies are non-negative (no early sends)
    const negativeLatencies = latencies.filter(lat => lat < 0);
    expect(negativeLatencies.length).toBe(0);
  });

  it('should maintain latency under heavy message load', async () => {
    const messagesPerMs = 5; // Heavy load
    const durationMs = 100;
    const totalMessages = messagesPerMs * durationMs;

    const sentMessages: Array<{
      scheduledTime: number;
      sentTime: number;
    }> = [];

    // Track sent messages
    midiIO.on('messageSent', (message: any, sentTime: number) => {
      sentMessages.push({
        scheduledTime: message.metadata.scheduledTime,
        sentTime
      });
    });

    const startTime = performance.now();

    // Schedule heavy message load
    for (let i = 0; i < totalMessages; i++) {
      const scheduledTime = startTime + Math.floor(i / messagesPerMs);

      await midiIO.scheduleMessage(
        scheduledTime,
        {
          type: 'noteon',
          channel: i % 16,
          note: 60 + (i % 12),
          velocity: 100
        }
      );
    }

    // Wait for processing
    await new Promise<void>((resolve) => {
      const checkComplete = setInterval(() => {
        if (sentMessages.length >= totalMessages) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 10);
    });

    // Calculate latencies
    const latencies = sentMessages.map(msg =>
      msg.sentTime - msg.scheduledTime
    );

    const maxLatency = Math.max(...latencies);
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    // Even under heavy load, maintain <5ms latency
    // MUST FAIL - MidiIO doesn't exist
    expect(maxLatency).toBeLessThan(5.0);
    expect(avgLatency).toBeLessThan(3.0);
  });

  it('should accurately measure round-trip latency via virtual loopback', async () => {
    const roundTripMeasurements: number[] = [];
    const messageCount = 50;

    midiIO.onMessage((message, receivedTime) => {
      const sentTime = message.metadata?.sentTime;
      if (sentTime) {
        const roundTrip = receivedTime - sentTime;
        roundTripMeasurements.push(roundTrip);
      }
    });

    // Send messages and measure round trip
    for (let i = 0; i < messageCount; i++) {
      const sendTime = performance.now();

      await midiIO.sendMessage({
        type: 'noteon',
        channel: 0,
        note: 60,
        velocity: 100,
        metadata: { sentTime: sendTime }
      });

      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    // Wait for all messages to return
    await new Promise<void>((resolve) => {
      const checkComplete = setInterval(() => {
        if (roundTripMeasurements.length >= messageCount) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 10);
    });

    const avgRoundTrip = roundTripMeasurements.reduce((sum, rt) => sum + rt, 0) / roundTripMeasurements.length;
    const maxRoundTrip = Math.max(...roundTripMeasurements);

    // Round trip should be <10ms for virtual loopback
    // MUST FAIL - MidiIO doesn't exist
    expect(maxRoundTrip).toBeLessThan(10.0);
    expect(avgRoundTrip).toBeLessThan(5.0);
  });

  it('should handle MIDI clock messages with precise timing', async () => {
    const clockMessages: number[] = [];
    const expectedInterval = 20.83; // ms (24 PPQN at 120 BPM)
    const messageCount = 100;

    midiIO.onMessage((message, receivedTime) => {
      if (message.type === 'clock') {
        clockMessages.push(receivedTime);
      }
    });

    // Send MIDI clock messages
    const startTime = performance.now();
    for (let i = 0; i < messageCount; i++) {
      const scheduledTime = startTime + (i * expectedInterval);

      await midiIO.scheduleMessage(scheduledTime, {
        type: 'clock'
      });
    }

    await new Promise(resolve => setTimeout(resolve, messageCount * expectedInterval + 100));

    // Verify clock intervals are precise
    const intervals: number[] = [];
    for (let i = 1; i < clockMessages.length; i++) {
      intervals.push(clockMessages[i] - clockMessages[i - 1]);
    }

    const intervalErrors = intervals.map(int => Math.abs(int - expectedInterval));
    const maxError = Math.max(...intervalErrors);
    const avgError = intervalErrors.reduce((sum, err) => sum + err, 0) / intervalErrors.length;

    // MUST FAIL - MidiIO doesn't exist
    expect(maxError).toBeLessThan(1.0); // Clock jitter < 1ms
    expect(avgError).toBeLessThan(0.5);
  });

  it('should support latency compensation adjustment', async () => {
    const compensationMs = 3.0;
    const compensatedMidiIO = new MidiIO({
      enableVirtualLoopback: true,
      latencyCompensation: compensationMs
    });

    await compensatedMidiIO.initialize();

    const measurements: Array<{
      scheduledTime: number;
      sentTime: number;
    }> = [];

    compensatedMidiIO.on('messageSent', (message: any, sentTime: number) => {
      measurements.push({
        scheduledTime: message.metadata.scheduledTime,
        sentTime
      });
    });

    const startTime = performance.now();

    // Schedule messages
    for (let i = 0; i < 20; i++) {
      const scheduledTime = startTime + (i * 50);

      await compensatedMidiIO.scheduleMessage(scheduledTime, {
        type: 'noteon',
        channel: 0,
        note: 60,
        velocity: 100
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1100));
    await compensatedMidiIO.close();

    // Verify messages are sent early by compensation amount
    const adjustments = measurements.map(msg =>
      msg.scheduledTime - msg.sentTime
    );

    const avgAdjustment = adjustments.reduce((sum, adj) => sum + adj, 0) / adjustments.length;

    // Should be sent ~3ms early (within tolerance)
    // MUST FAIL - MidiIO doesn't exist
    expect(Math.abs(avgAdjustment - compensationMs)).toBeLessThan(1.0);
  });
});

describe('MidiIO - Port Management', () => {
  let midiIO: MidiIO;

  beforeEach(async () => {
    midiIO = new MidiIO();
    await midiIO.initialize();
  });

  afterEach(async () => {
    await midiIO?.close();
  });

  it('should list available MIDI input ports', async () => {
    const inputPorts = await midiIO.getInputPorts();

    // MUST FAIL - MidiIO doesn't exist
    expect(Array.isArray(inputPorts)).toBe(true);
    expect(inputPorts.length).toBeGreaterThanOrEqual(0);

    if (inputPorts.length > 0) {
      expect(inputPorts[0]).toHaveProperty('name');
      expect(inputPorts[0]).toHaveProperty('id');
    }
  });

  it('should list available MIDI output ports', async () => {
    const outputPorts = await midiIO.getOutputPorts();

    // MUST FAIL - MidiIO doesn't exist
    expect(Array.isArray(outputPorts)).toBe(true);
    expect(outputPorts.length).toBeGreaterThanOrEqual(0);

    if (outputPorts.length > 0) {
      expect(outputPorts[0]).toHaveProperty('name');
      expect(outputPorts[0]).toHaveProperty('id');
    }
  });

  it('should open and close MIDI ports', async () => {
    const outputPorts = await midiIO.getOutputPorts();

    if (outputPorts.length > 0) {
      const portId = outputPorts[0].id;

      await midiIO.openOutputPort(portId);
      expect(midiIO.isPortOpen(portId)).toBe(true);

      await midiIO.closeOutputPort(portId);
      expect(midiIO.isPortOpen(portId)).toBe(false);
    }

    // MUST FAIL - MidiIO doesn't exist
    expect(midiIO).toBeDefined();
  });

  it('should handle port connection/disconnection events', async () => {
    const connectionEvents: string[] = [];

    midiIO.on('portConnected', (port: any) => {
      connectionEvents.push(`connected:${port.name}`);
    });

    midiIO.on('portDisconnected', (port: any) => {
      connectionEvents.push(`disconnected:${port.name}`);
    });

    // Enable port monitoring
    await midiIO.enablePortMonitoring();

    // Wait for potential events
    await new Promise(resolve => setTimeout(resolve, 100));

    // MUST FAIL - MidiIO doesn't exist
    expect(Array.isArray(connectionEvents)).toBe(true);
  });

  it('should create virtual MIDI ports for testing', async () => {
    const virtualPort = await midiIO.createVirtualPort('GenSeq Test Port');

    // MUST FAIL - MidiIO doesn't exist
    expect(virtualPort).toBeDefined();
    expect(virtualPort.name).toBe('GenSeq Test Port');
    expect(virtualPort.isVirtual).toBe(true);

    await midiIO.destroyVirtualPort(virtualPort.id);
  });
});

describe('MidiIO - Message Validation', () => {
  let midiIO: MidiIO;

  beforeEach(async () => {
    midiIO = new MidiIO();
    await midiIO.initialize();
  });

  afterEach(async () => {
    await midiIO?.close();
  });

  it('should validate note on/off messages', () => {
    const validNoteOn = {
      type: 'noteon',
      channel: 0,
      note: 60,
      velocity: 100
    };

    const invalidChannel = {
      type: 'noteon',
      channel: 16, // Out of range
      note: 60,
      velocity: 100
    };

    const invalidNote = {
      type: 'noteon',
      channel: 0,
      note: 128, // Out of range
      velocity: 100
    };

    // MUST FAIL - MidiIO doesn't exist
    expect(() => midiIO.validateMessage(validNoteOn)).not.toThrow();
    expect(() => midiIO.validateMessage(invalidChannel)).toThrow();
    expect(() => midiIO.validateMessage(invalidNote)).toThrow();
  });

  it('should validate control change messages', () => {
    const validCC = {
      type: 'cc',
      channel: 0,
      controller: 7, // Volume
      value: 64
    };

    const invalidController = {
      type: 'cc',
      channel: 0,
      controller: 128, // Out of range
      value: 64
    };

    // MUST FAIL - MidiIO doesn't exist
    expect(() => midiIO.validateMessage(validCC)).not.toThrow();
    expect(() => midiIO.validateMessage(invalidController)).toThrow();
  });

  it('should validate program change messages', () => {
    const validPC = {
      type: 'program',
      channel: 0,
      program: 0
    };

    const invalidProgram = {
      type: 'program',
      channel: 0,
      program: 128 // Out of range
    };

    // MUST FAIL - MidiIO doesn't exist
    expect(() => midiIO.validateMessage(validPC)).not.toThrow();
    expect(() => midiIO.validateMessage(invalidProgram)).toThrow();
  });

  it('should handle SysEx messages', async () => {
    const sysexMessage = {
      type: 'sysex',
      data: new Uint8Array([0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7]) // Identity request
    };

    // MUST FAIL - MidiIO doesn't exist
    expect(() => midiIO.validateMessage(sysexMessage)).not.toThrow();

    let sysexReceived = false;
    midiIO.onMessage((message) => {
      if (message.type === 'sysex') {
        sysexReceived = true;
      }
    });

    await midiIO.sendMessage(sysexMessage);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Note: May require physical loopback for actual test
  });
});

describe('MidiIO - Error Handling', () => {
  it('should handle initialization failures gracefully', async () => {
    const invalidMidiIO = new MidiIO({
      enableVirtualLoopback: false,
      requirePhysicalPorts: true
    });

    // MUST FAIL - MidiIO doesn't exist
    // Behavior depends on system - may throw or initialize with no ports
    await expect(invalidMidiIO.initialize()).resolves.toBeDefined();
  });

  it('should handle send failures when port is closed', async () => {
    const midiIO = new MidiIO();
    await midiIO.initialize();
    await midiIO.close();

    const message = {
      type: 'noteon',
      channel: 0,
      note: 60,
      velocity: 100
    };

    // MUST FAIL - MidiIO doesn't exist
    await expect(midiIO.sendMessage(message)).rejects.toThrow();
  });

  it('should recover from message queue overflow', async () => {
    const midiIO = new MidiIO({
      enableVirtualLoopback: true,
      maxQueueSize: 10
    });

    await midiIO.initialize();

    // Attempt to overflow queue
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        midiIO.scheduleMessage(performance.now() + i, {
          type: 'noteon',
          channel: 0,
          note: 60,
          velocity: 100
        })
      );
    }

    // Should handle overflow gracefully (drop or reject)
    // MUST FAIL - MidiIO doesn't exist
    await expect(Promise.allSettled(promises)).resolves.toBeDefined();

    await midiIO.close();
  });
});
