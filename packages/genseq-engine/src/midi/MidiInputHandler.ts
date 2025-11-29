import { EventEmitter } from 'events';
import * as midi from '@julusian/midi';
import type { MappingEntity } from '../config/entities/MappingEntity';

/**
 * T059: MIDI Input Handler with device/channel filtering
 *
 * Parses MIDI input messages (CC, notes, pitch bend) and routes them
 * to registered mappings based on device, channel, and controller filters.
 *
 * Performance contract: <1ms message processing latency
 */

export interface MidiInputDevice {
  port: number;
  name: string;
}

export interface CCEvent {
  type: 'cc';
  device: string;
  channel: number; // 1-16
  controller: number; // 0-127
  value: number; // 0-127
  timestamp: number;
}

export interface NoteEvent {
  type: 'note';
  device: string;
  channel: number; // 1-16
  note: number; // 0-127
  velocity: number; // 0-127
  noteOn: boolean;
  timestamp: number;
}

export interface PitchBendEvent {
  type: 'pitchbend';
  device: string;
  channel: number; // 1-16
  value: number; // -8192 to 8191
  timestamp: number;
}

export type MidiInputEvent = CCEvent | NoteEvent | PitchBendEvent;

/**
 * Manages MIDI input devices and routes messages to registered mappings
 */
export class MidiInputHandler extends EventEmitter {
  private inputPorts: Map<string, midi.Input> = new Map();
  private mappings: Map<string, MappingEntity> = new Map();
  private channelFilter: Set<number> | null = null; // null = all channels enabled
  private deviceFilter: Set<string> | null = null; // null = all devices enabled

  constructor() {
    super();
  }

  /**
   * Discover available MIDI input devices
   */
  async listDevices(): Promise<MidiInputDevice[]> {
    const input = new midi.Input();
    const devices: MidiInputDevice[] = [];

    try {
      const portCount = input.getPortCount();
      for (let i = 0; i < portCount; i++) {
        devices.push({
          port: i,
          name: input.getPortName(i)
        });
      }
    } finally {
      input.closePort();
    }

    return devices;
  }

  /**
   * Open a MIDI input device by name
   */
  async openDevice(deviceName: string): Promise<void> {
    if (this.inputPorts.has(deviceName)) {
      return; // Already open
    }

    const devices = await this.listDevices();
    const device = devices.find(d => d.name === deviceName);

    if (!device) {
      throw new Error(`MIDI input device not found: ${deviceName}`);
    }

    const input = new midi.Input();
    input.openPort(device.port);

    input.on('message', (deltaTime: number, message: number[]) => {
      console.log(`[MidiInputHandler] Raw MIDI from "${deviceName}": [${message.map(b => b.toString(16).padStart(2, '0')).join(' ')}] (delta: ${deltaTime.toFixed(3)}ms)`);
      this.handleMessage(deviceName, message);
    });

    this.inputPorts.set(deviceName, input);
  }

  /**
   * Open a MIDI input device by port number
   */
  async openDeviceByPort(port: number): Promise<void> {
    const devices = await this.listDevices();
    const device = devices.find(d => d.port === port);

    if (!device) {
      throw new Error(`MIDI input device not found at port: ${port}`);
    }

    return this.openDevice(device.name);
  }

  /**
   * Close a MIDI input device
   */
  closeDevice(deviceName: string): void {
    const input = this.inputPorts.get(deviceName);
    if (input) {
      input.closePort();
      this.inputPorts.delete(deviceName);
    }
  }

  /**
   * Close all open MIDI input devices
   */
  closeAll(): void {
    for (const [deviceName, input] of this.inputPorts) {
      input.closePort();
    }
    this.inputPorts.clear();
  }

  /**
   * Alias for closeAll() for test compatibility
   */
  closeAllDevices(): void {
    this.closeAll();
  }

  /**
   * Destroy handler and clean up all resources
   */
  destroy(): void {
    this.closeAll();
    this.clearMappings();
    this.removeAllListeners();
  }

  /**
   * Get count of registered mappings
   */
  getMappingCount(): number {
    return this.mappings.size;
  }

  /**
   * Check if a mapping is registered
   */
  hasMapping(mappingId: string): boolean {
    return this.mappings.has(mappingId);
  }

  /**
   * Get list of currently open device names
   */
  getActiveDevices(): string[] {
    return Array.from(this.inputPorts.keys());
  }

  /**
   * Check if a device is currently open
   */
  isDeviceOpen(deviceName: string): boolean {
    return this.inputPorts.has(deviceName);
  }

  /**
   * Check if a channel is enabled by the channel filter
   */
  isChannelEnabled(channel: number): boolean {
    if (this.channelFilter === null) {
      return true; // All channels enabled
    }
    return this.channelFilter.has(channel);
  }

  /**
   * Set channel filter (only allow specific channels)
   */
  setChannelFilter(channels: number[]): void {
    // Validate channels
    for (const channel of channels) {
      if (channel < 1 || channel > 16) {
        throw new Error(`Channel must be between 1 and 16, got ${channel}`);
      }
    }

    if (channels.length === 0) {
      this.channelFilter = new Set(); // No channels enabled
    } else {
      this.channelFilter = new Set(channels);
    }
  }

  /**
   * Clear channel filter (enable all channels)
   */
  clearChannelFilter(): void {
    this.channelFilter = null;
  }

  /**
   * Set device filter (only allow specific devices)
   */
  setDeviceFilter(deviceNames: string[]): void {
    if (deviceNames.length === 0) {
      this.deviceFilter = null; // All devices enabled
    } else {
      this.deviceFilter = new Set(deviceNames);
    }
  }

  /**
   * Clear device filter (enable all devices)
   */
  clearDeviceFilter(): void {
    this.deviceFilter = null;
  }

  /**
   * Check if a device is enabled by the device filter
   */
  isDeviceEnabled(deviceName: string): boolean {
    if (this.deviceFilter === null) {
      return true; // All devices enabled
    }

    // Check exact match first
    if (this.deviceFilter.has(deviceName)) {
      return true;
    }

    // Check wildcard patterns
    for (const pattern of this.deviceFilter) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(deviceName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Register a mapping for routing
   */
  registerMapping(mapping: MappingEntity): void {
    this.mappings.set(mapping.id, mapping);

    // Open device if specified and not already open
    if (mapping.source.type !== 'parameter' && mapping.source.device) {
      try {
        this.openDevice(mapping.source.device);
      } catch (error) {
        // Device might not be available, but don't fail registration
        console.warn(`Could not open device for mapping ${mapping.id}:`, error);
      }
    }
  }

  /**
   * Unregister a mapping
   */
  unregisterMapping(mappingId: string): void {
    this.mappings.delete(mappingId);
  }

  /**
   * Clear all registered mappings
   */
  clearMappings(): void {
    this.mappings.clear();
  }

  /**
   * Parse a raw MIDI message into a structured event
   */
  parseMessage(message: number[], deviceName: string = 'unknown'): MidiInputEvent | null {
    if (message.length < 2) {
      return null;
    }

    const timestamp = Date.now();
    const status = message[0];
    const messageType = status & 0xF0; // Upper 4 bits
    const channel = (status & 0x0F) + 1; // Lower 4 bits, convert to 1-16

    // Apply device filter
    if (this.deviceFilter !== null && !this.isDeviceEnabled(deviceName)) {
      return null; // Device filtered out
    }

    // Apply channel filter
    if (!this.isChannelEnabled(channel)) {
      return null; // Channel filtered out
    }

    let event: MidiInputEvent | null = null;

    switch (messageType) {
      case 0xB0: { // Control Change
        if (message.length < 3) {
          return null; // Invalid message
        }
        const controller = message[1];
        const value = message[2];
        event = {
          type: 'cc',
          device: deviceName,
          channel,
          controller,
          value,
          timestamp
        };
        break;
      }

      case 0x90: { // Note On
        if (message.length < 3) {
          return null; // Invalid message
        }
        const note = message[1];
        const velocity = message[2];
        event = {
          type: 'note',
          device: deviceName,
          channel,
          note,
          velocity,
          noteOn: velocity > 0, // velocity 0 is note off
          timestamp
        };
        break;
      }

      case 0x80: { // Note Off
        if (message.length < 3) {
          return null; // Invalid message
        }
        const note = message[1];
        const velocity = message[2];
        event = {
          type: 'note',
          device: deviceName,
          channel,
          note,
          velocity,
          noteOn: false,
          timestamp
        };
        break;
      }

      case 0xE0: { // Pitch Bend
        if (message.length < 3) {
          return null; // Invalid message
        }
        const lsb = message[1];
        const msb = message[2];
        // Pitch bend: 0-16383, center at 8192, convert to -8192 to 8191
        const rawValue = (msb << 7) | lsb;
        const value = rawValue - 8192;
        event = {
          type: 'pitchbend',
          device: deviceName,
          channel,
          value,
          timestamp
        };
        break;
      }

      default:
        return null;
    }

    // Emit type-specific events and route to mappings
    if (event) {
      this.emit(event.type, event);
      this.emit('midi:received', event);

      // Route to registered mappings
      this.routeEventToMappings(event);
    }

    return event;
  }

  /**
   * Route an event to matching mappings
   */
  private routeEventToMappings(event: MidiInputEvent): void {
    for (const mapping of this.mappings.values()) {
      if (this.matchesMapping(event, mapping)) {
        this.emit('mapping:matched', { mapping, event });

        // Emit specific routing events based on target type
        if (mapping.target.type === 'parameter') {
          this.emit('parameter-change', {
            mappingId: mapping.id,
            patternId: mapping.target.patternId,
            parameter: mapping.target.parameter,
            value: this.getInputValue(event),
            event
          });
        } else if (mapping.target.type === 'scene') {
          // Only trigger on note-on
          if (event.type === 'note' && (event as NoteEvent).noteOn) {
            this.emit('scene-trigger', {
              mappingId: mapping.id,
              sceneId: mapping.target.sceneId,
              quantize: mapping.quantize,
              event
            });
          }
        }
      }
    }
  }

  /**
   * Handle incoming MIDI message and route to matching mappings
   */
  private handleMessage(deviceName: string, message: number[]): void {
    // parseMessage will handle filtering, event emission, and routing
    this.parseMessage(message, deviceName);
  }

  /**
   * Check if an event matches a mapping's source criteria
   */
  private matchesMapping(event: MidiInputEvent, mapping: MappingEntity): boolean {
    const source = mapping.source;

    // Parameter sources don't match MIDI input events
    if (source.type === 'parameter') {
      return false;
    }

    // Type must match
    if (source.type !== event.type) {
      return false;
    }

    // Device filter (if specified)
    if (source.device && source.device !== event.device) {
      return false;
    }

    // Channel filter
    if (source.channel !== event.channel) {
      return false;
    }

    // Type-specific filters
    switch (source.type) {
      case 'cc':
        return source.controller === (event as CCEvent).controller;
      case 'note':
        return source.note === (event as NoteEvent).note;
      case 'pitchbend':
        return true; // No additional filters for pitch bend
      default:
        return false;
    }
  }

  /**
   * Get input value from event for transformation
   */
  getInputValue(event: MidiInputEvent): number {
    switch (event.type) {
      case 'cc':
        return event.value;
      case 'note':
        return event.velocity;
      case 'pitchbend':
        return event.value;
      default:
        return 0;
    }
  }
}
