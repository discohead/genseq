import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MidiInputHandler,
  type MidiInputEvent
} from '../../src/midi/MidiInputHandler';
import type { MappingEntity } from '../../src/config/entities/MappingEntity';

/**
 * T059: MidiInputHandler Tests (RED PHASE - MUST FAIL)
 *
 * Tests for MIDI input handling with device/channel filtering.
 * Receives raw MIDI messages and converts them to structured input events.
 */

describe('MidiInputHandler', () => {
  let handler: MidiInputHandler;

  beforeEach(() => {
    handler = new MidiInputHandler();
  });

  afterEach(() => {
    handler.destroy();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should create handler with no active mappings', () => {
      expect(handler).toBeDefined();
      expect(handler.getMappingCount()).toBe(0);
    });

    it('should initialize with empty device filter list', () => {
      expect(handler.getActiveDevices()).toEqual([]);
    });

    it('should start with all channels enabled (1-16)', () => {
      for (let channel = 1; channel <= 16; channel++) {
        expect(handler.isChannelEnabled(channel)).toBe(true);
      }
    });
  });

  // ============================================================================
  // Device Discovery and Management
  // ============================================================================

  describe('Device Discovery', () => {
    it('should list available MIDI input devices', async () => {
      const devices = await handler.listDevices();

      expect(Array.isArray(devices)).toBe(true);
      // Should at least find virtual MIDI ports in test environment
      expect(devices.length).toBeGreaterThanOrEqual(0);
    });

    it('should return device info with name and port number', async () => {
      const devices = await handler.listDevices();

      if (devices.length > 0) {
        const device = devices[0];
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('port');
        expect(typeof device.name).toBe('string');
        expect(typeof device.port).toBe('number');
      }
    });

    it('should open specific device by name', async () => {
      const devices = await handler.listDevices();

      if (devices.length > 0) {
        const deviceName = devices[0].name;
        await expect(handler.openDevice(deviceName)).resolves.not.toThrow();
        expect(handler.isDeviceOpen(deviceName)).toBe(true);
      }
    });

    it('should open specific device by port number', async () => {
      const devices = await handler.listDevices();

      if (devices.length > 0) {
        const port = devices[0].port;
        await expect(handler.openDeviceByPort(port)).resolves.not.toThrow();
      }
    });

    it('should throw error when opening non-existent device', async () => {
      await expect(handler.openDevice('NonExistentDevice'))
        .rejects.toThrow(/device.*not found/i);
    });

    it('should close opened device', async () => {
      const devices = await handler.listDevices();

      if (devices.length > 0) {
        const deviceName = devices[0].name;
        await handler.openDevice(deviceName);
        expect(handler.isDeviceOpen(deviceName)).toBe(true);

        handler.closeDevice(deviceName);
        expect(handler.isDeviceOpen(deviceName)).toBe(false);
      }
    });

    it('should close all opened devices', async () => {
      const devices = await handler.listDevices();

      if (devices.length >= 2) {
        await handler.openDevice(devices[0].name);
        await handler.openDevice(devices[1].name);

        handler.closeAllDevices();

        expect(handler.isDeviceOpen(devices[0].name)).toBe(false);
        expect(handler.isDeviceOpen(devices[1].name)).toBe(false);
      }
    });
  });

  // ============================================================================
  // CC Message Processing
  // ============================================================================

  describe('CC Message Processing', () => {
    it('should parse CC message correctly', () => {
      const ccMessage = [0xB0, 1, 64]; // CC1 on channel 1, value 64

      const event = handler.parseMessage(ccMessage);

      expect(event).toBeDefined();
      expect(event?.type).toBe('cc');
      expect(event?.channel).toBe(1);
      expect(event?.controller).toBe(1);
      expect(event?.value).toBe(64);
    });

    it('should parse CC on different channel', () => {
      const ccMessage = [0xB9, 7, 100]; // CC7 on channel 10, value 100

      const event = handler.parseMessage(ccMessage);

      expect(event?.type).toBe('cc');
      expect(event?.channel).toBe(10);
      expect(event?.controller).toBe(7);
      expect(event?.value).toBe(100);
    });

    it('should emit event when CC message received', async () => {
      const promise = new Promise<void>((resolve) => {
        handler.on('cc', (event: MidiInputEvent) => {
          expect(event.type).toBe('cc');
          expect(event.channel).toBe(1);
          expect(event.controller).toBe(1);
          expect(event.value).toBe(64);
          resolve();
        });
      });

      handler.parseMessage([0xB0, 1, 64]);
      await promise;
    });

    it('should filter CC by channel', () => {
      handler.setChannelFilter([1, 2]); // Only channels 1 and 2

      const ccChannel1 = handler.parseMessage([0xB0, 1, 64]); // Channel 1
      const ccChannel3 = handler.parseMessage([0xB2, 1, 64]); // Channel 3

      expect(ccChannel1).toBeDefined();
      expect(ccChannel3).toBeNull(); // Filtered out
    });

    it('should filter CC by device', async () => {
      const devices = await handler.listDevices();

      if (devices.length >= 2) {
        await handler.openDevice(devices[0].name);
        await handler.openDevice(devices[1].name);

        handler.setDeviceFilter([devices[0].name]); // Only first device

        // Simulate messages from both devices
        const event1 = handler.parseMessage([0xB0, 1, 64], devices[0].name);
        const event2 = handler.parseMessage([0xB0, 1, 64], devices[1].name);

        expect(event1).toBeDefined();
        expect(event2).toBeNull(); // Filtered out
      }
    });

    it('should handle CC value range 0-127', () => {
      const ccMin = handler.parseMessage([0xB0, 1, 0]);
      const ccMax = handler.parseMessage([0xB0, 1, 127]);

      expect(ccMin?.value).toBe(0);
      expect(ccMax?.value).toBe(127);
    });
  });

  // ============================================================================
  // Note Message Processing
  // ============================================================================

  describe('Note Message Processing', () => {
    it('should parse note-on message', () => {
      const noteOn = [0x90, 60, 100]; // Note 60 (C4), velocity 100, channel 1

      const event = handler.parseMessage(noteOn);

      expect(event?.type).toBe('note');
      expect(event?.channel).toBe(1);
      expect(event?.note).toBe(60);
      expect(event?.velocity).toBe(100);
      expect(event?.noteOn).toBe(true);
    });

    it('should parse note-off message', () => {
      const noteOff = [0x80, 60, 0]; // Note 60 off, channel 1

      const event = handler.parseMessage(noteOff);

      expect(event?.type).toBe('note');
      expect(event?.channel).toBe(1);
      expect(event?.note).toBe(60);
      expect(event?.velocity).toBe(0);
      expect(event?.noteOn).toBe(false);
    });

    it('should treat note-on with velocity 0 as note-off', () => {
      const noteOnZero = [0x90, 60, 0]; // Note-on with velocity 0

      const event = handler.parseMessage(noteOnZero);

      expect(event?.type).toBe('note');
      expect(event?.noteOn).toBe(false);
    });

    it('should emit event when note message received', async () => {
      const promise = new Promise<void>((resolve) => {
        handler.on('note', (event: MidiInputEvent) => {
          expect(event.type).toBe('note');
          expect(event.note).toBe(36); // Kick drum pad
          expect(event.velocity).toBe(100);
          resolve();
        });
      });

      handler.parseMessage([0x99, 36, 100]); // Channel 10 (drums)
      await promise;
    });

    it('should filter notes by channel', () => {
      handler.setChannelFilter([10]); // Only drum channel

      const drumNote = handler.parseMessage([0x99, 36, 100]); // Channel 10
      const melodyNote = handler.parseMessage([0x90, 60, 100]); // Channel 1

      expect(drumNote).toBeDefined();
      expect(melodyNote).toBeNull(); // Filtered out
    });

    it('should handle all MIDI note range 0-127', () => {
      const lowNote = handler.parseMessage([0x90, 0, 100]);
      const highNote = handler.parseMessage([0x90, 127, 100]);

      expect(lowNote?.note).toBe(0);
      expect(highNote?.note).toBe(127);
    });
  });

  // ============================================================================
  // Pitch Bend Processing
  // ============================================================================

  describe('Pitch Bend Processing', () => {
    it('should parse pitch bend message', () => {
      // Pitch bend center: LSB=0, MSB=64 (0x40)
      const pitchBend = [0xE0, 0, 64];

      const event = handler.parseMessage(pitchBend);

      expect(event?.type).toBe('pitchbend');
      expect(event?.channel).toBe(1);
      expect(event?.value).toBe(0); // Center = 0
    });

    it('should parse pitch bend with positive bend', () => {
      // Pitch bend up: LSB=127, MSB=127
      const pitchBendUp = [0xE0, 127, 127];

      const event = handler.parseMessage(pitchBendUp);

      expect(event?.value).toBeGreaterThan(0);
      expect(event?.value).toBeLessThanOrEqual(8191);
    });

    it('should parse pitch bend with negative bend', () => {
      // Pitch bend down: LSB=0, MSB=0
      const pitchBendDown = [0xE0, 0, 0];

      const event = handler.parseMessage(pitchBendDown);

      expect(event?.value).toBeLessThan(0);
      expect(event?.value).toBeGreaterThanOrEqual(-8192);
    });

    it('should emit event when pitch bend received', async () => {
      const promise = new Promise<void>((resolve) => {
        handler.on('pitchbend', (event: MidiInputEvent) => {
          expect(event.type).toBe('pitchbend');
          expect(event.channel).toBe(1);
          resolve();
        });
      });

      handler.parseMessage([0xE0, 0, 64]);
      await promise;
    });

    it('should handle pitch bend range -8192 to +8191', () => {
      const minBend = handler.parseMessage([0xE0, 0, 0]);
      const maxBend = handler.parseMessage([0xE0, 127, 127]);

      expect(minBend?.value).toBe(-8192);
      expect(maxBend?.value).toBe(8191);
    });
  });

  // ============================================================================
  // Channel Filtering
  // ============================================================================

  describe('Channel Filtering', () => {
    it('should enable specific channels', () => {
      handler.setChannelFilter([1, 10, 16]);

      expect(handler.isChannelEnabled(1)).toBe(true);
      expect(handler.isChannelEnabled(10)).toBe(true);
      expect(handler.isChannelEnabled(16)).toBe(true);
      expect(handler.isChannelEnabled(2)).toBe(false);
    });

    it('should disable all channels when filter is empty', () => {
      handler.setChannelFilter([]);

      for (let ch = 1; ch <= 16; ch++) {
        expect(handler.isChannelEnabled(ch)).toBe(false);
      }
    });

    it('should clear channel filter to enable all channels', () => {
      handler.setChannelFilter([1]);
      expect(handler.isChannelEnabled(2)).toBe(false);

      handler.clearChannelFilter();

      for (let ch = 1; ch <= 16; ch++) {
        expect(handler.isChannelEnabled(ch)).toBe(true);
      }
    });

    it('should reject invalid channel numbers', () => {
      expect(() => handler.setChannelFilter([0])).toThrow(/channel.*1.*16/i);
      expect(() => handler.setChannelFilter([17])).toThrow(/channel.*1.*16/i);
    });
  });

  // ============================================================================
  // Device Filtering
  // ============================================================================

  describe('Device Filtering', () => {
    it('should enable specific devices', async () => {
      const devices = await handler.listDevices();

      if (devices.length >= 1) {
        handler.setDeviceFilter([devices[0].name]);

        expect(handler.isDeviceEnabled(devices[0].name)).toBe(true);
      }
    });

    it('should disable devices not in filter', async () => {
      const devices = await handler.listDevices();

      if (devices.length >= 2) {
        handler.setDeviceFilter([devices[0].name]);

        expect(handler.isDeviceEnabled(devices[1].name)).toBe(false);
      }
    });

    it('should clear device filter to enable all devices', async () => {
      const devices = await handler.listDevices();

      if (devices.length >= 1) {
        handler.setDeviceFilter([devices[0].name]);
        handler.clearDeviceFilter();

        expect(handler.isDeviceEnabled(devices[0].name)).toBe(true);
      }
    });

    it('should allow filtering by partial device name match', async () => {
      const devices = await handler.listDevices();

      if (devices.length >= 1) {
        // Filter by first word of device name
        const firstWord = devices[0].name.split(' ')[0];
        handler.setDeviceFilter([`*${firstWord}*`]);

        expect(handler.isDeviceEnabled(devices[0].name)).toBe(true);
      }
    });
  });

  // ============================================================================
  // Mapping Registration
  // ============================================================================

  describe('Mapping Registration', () => {
    it('should register CC to parameter mapping', () => {
      const mapping: MappingEntity = {
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      };

      handler.registerMapping(mapping);

      expect(handler.getMappingCount()).toBe(1);
      expect(handler.hasMapping('cc1-density')).toBe(true);
    });

    it('should unregister mapping by id', () => {
      const mapping: MappingEntity = {
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      };

      handler.registerMapping(mapping);
      expect(handler.hasMapping('cc1-density')).toBe(true);

      handler.unregisterMapping('cc1-density');
      expect(handler.hasMapping('cc1-density')).toBe(false);
    });

    it('should clear all mappings', () => {
      const mapping1: MappingEntity = {
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      };

      const mapping2: MappingEntity = {
        id: 'cc7-velocity',
        source: { type: 'cc', channel: 1, controller: 7 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'velocity' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [60, 127] }
      };

      handler.registerMapping(mapping1);
      handler.registerMapping(mapping2);
      expect(handler.getMappingCount()).toBe(2);

      handler.clearMappings();
      expect(handler.getMappingCount()).toBe(0);
    });

    it('should update existing mapping when re-registered', () => {
      const mapping1: MappingEntity = {
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      };

      handler.registerMapping(mapping1);

      const mapping2: MappingEntity = {
        ...mapping1,
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.5, 1.0] }
      };

      handler.registerMapping(mapping2);

      expect(handler.getMappingCount()).toBe(1); // Still only 1 mapping
      // Mapping should be updated with new transform
    });
  });

  // ============================================================================
  // Event Routing
  // ============================================================================

  describe('Event Routing', () => {
    it('should route CC event to registered mapping', async () => {
      const mapping: MappingEntity = {
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      };

      handler.registerMapping(mapping);

      const promise = new Promise<void>((resolve) => {
        handler.on('parameter-change', (event) => {
          expect(event.mappingId).toBe('cc1-density');
          expect(event.patternId).toBe('kick');
          expect(event.parameter).toBe('density');
          resolve();
        });
      });

      handler.parseMessage([0xB0, 1, 64]);
      await promise;
    });

    it('should not route events without matching mapping', () => {
      const spy = vi.fn();
      handler.on('parameter-change', spy);

      // No mappings registered
      handler.parseMessage([0xB0, 1, 64]);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should route note event to scene trigger', async () => {
      const mapping: MappingEntity = {
        id: 'pad36-main',
        source: { type: 'note', channel: 10, note: 36 },
        target: { type: 'scene', sceneId: 'main' },
        quantize: 'bar'
      };

      handler.registerMapping(mapping);

      const promise = new Promise<void>((resolve) => {
        handler.on('scene-trigger', (event) => {
          expect(event.mappingId).toBe('pad36-main');
          expect(event.sceneId).toBe('main');
          expect(event.quantize).toBe('bar');
          resolve();
        });
      });

      handler.parseMessage([0x99, 36, 100]); // Note-on
      await promise;
    });

    it('should ignore note-off for scene triggers', () => {
      const mapping: MappingEntity = {
        id: 'pad36-main',
        source: { type: 'note', channel: 10, note: 36 },
        target: { type: 'scene', sceneId: 'main' },
        quantize: 'bar'
      };

      handler.registerMapping(mapping);

      const spy = vi.fn();
      handler.on('scene-trigger', spy);

      handler.parseMessage([0x89, 36, 0]); // Note-off

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should process CC messages with <1ms latency', () => {
      const mapping: MappingEntity = {
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      };

      handler.registerMapping(mapping);

      const start = performance.now();
      handler.parseMessage([0xB0, 1, 64]);
      const end = performance.now();

      expect(end - start).toBeLessThan(1.0); // <1ms latency
    });

    it('should handle rapid CC changes without dropping messages', () => {
      const mapping: MappingEntity = {
        id: 'cc1-density',
        source: { type: 'cc', channel: 1, controller: 1 },
        target: { type: 'parameter', patternId: 'kick', parameter: 'density' },
        transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
      };

      handler.registerMapping(mapping);

      const events: any[] = [];
      handler.on('parameter-change', (event) => events.push(event));

      // Simulate rapid fader movement
      for (let i = 0; i <= 120; i += 10) {
        handler.parseMessage([0xB0, 1, i]);
      }

      expect(events.length).toBe(13); // 0, 10, 20, ..., 120
    });

    it('should handle 100 mappings efficiently', () => {
      // Register 100 mappings
      for (let i = 0; i < 100; i++) {
        const mapping: MappingEntity = {
          id: `cc${i}-density`,
          source: { type: 'cc', channel: 1, controller: i % 128 },
          target: { type: 'parameter', patternId: `pattern${i}`, parameter: 'density' },
          transform: { type: 'linear', inputRange: [0, 127], outputRange: [0.0, 1.0] }
        };
        handler.registerMapping(mapping);
      }

      expect(handler.getMappingCount()).toBe(100);

      const start = performance.now();
      handler.parseMessage([0xB0, 1, 64]);
      const end = performance.now();

      expect(end - start).toBeLessThan(5.0); // <5ms even with 100 mappings
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should ignore malformed MIDI messages', () => {
      const invalidMessage = [0xFF]; // Invalid status byte

      expect(() => handler.parseMessage(invalidMessage)).not.toThrow();
      const event = handler.parseMessage(invalidMessage);
      expect(event).toBeNull();
    });

    it('should handle messages shorter than expected', () => {
      const shortMessage = [0xB0, 1]; // CC without value

      expect(() => handler.parseMessage(shortMessage)).not.toThrow();
      const event = handler.parseMessage(shortMessage);
      expect(event).toBeNull();
    });

    it('should return null for invalid messages without throwing', () => {
      const invalidMessage = [0xFF]; // Invalid status byte
      const result = handler.parseMessage(invalidMessage);

      expect(result).toBeNull();
      // Should not throw or emit error - just return null
    });

    it('should continue processing after error', () => {
      const spy = vi.fn();
      handler.on('cc', spy);

      // Send invalid message
      handler.parseMessage([0xFF]);

      // Send valid message
      handler.parseMessage([0xB0, 1, 64]);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
