import { EventEmitter } from 'events';
import type { BusRouter } from './BusRouter';

/**
 * T034: MidiOutputHandler - handles MIDI output with note-on/note-off and velocity
 *
 * Responsibilities:
 * - Process pattern events into MIDI messages
 * - Handle note-on/note-off pairing
 * - Track active notes for proper note-off
 * - Apply velocity curves
 * - Handle MIDI message timing
 */

export interface MidiOutputHandlerConfig {
  busRouter: BusRouter;
}

export interface PatternEvent {
  patternId: string;
  bus: string;
  channel?: number;
  tick: number;
  type: 'noteOn' | 'noteOff' | 'cc' | 'program';
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
}

export interface ActiveNote {
  patternId: string;
  bus: string;
  note: number;
  channel: number;
  noteOnTime: number;
}

export class MidiOutputHandler extends EventEmitter {
  private busRouter: BusRouter;
  private activeNotes: Map<string, ActiveNote> = new Map();

  constructor(config: MidiOutputHandlerConfig) {
    super();
    this.busRouter = config.busRouter;
  }

  /**
   * Process pattern event and send to MIDI output
   */
  async handleEvent(event: PatternEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'noteOn':
          await this.handleNoteOn(event);
          break;

        case 'noteOff':
          await this.handleNoteOff(event);
          break;

        case 'cc':
          await this.handleCC(event);
          break;

        case 'program':
          await this.handleProgramChange(event);
          break;

        default:
          this.emit('warn', `Unknown event type: ${event.type}`);
      }
    } catch (error) {
      this.emit('error', { event, error });
    }
  }

  /**
   * Handle note-on event
   */
  private async handleNoteOn(event: PatternEvent): Promise<void> {
    if (event.note === undefined || event.velocity === undefined) {
      throw new Error('Note-on event requires note and velocity');
    }

    const channel = event.channel || 1;

    // Create note key for tracking
    const noteKey = `${event.bus}:${channel}:${event.note}`;

    // If note is already active, send note-off first to avoid stuck notes
    if (this.activeNotes.has(noteKey)) {
      await this.sendNoteOff(event.bus, channel, event.note);
    }

    // Apply velocity curve if configured
    const velocity = this.applyVelocityCurve(event.velocity);

    // Send note-on via bus router
    await this.busRouter.routeMessage({
      bus: event.bus,
      device: '', // BusRouter determines device from routing table
      channel,
      type: 'noteon',
      note: event.note,
      velocity
    });

    // Track active note
    this.activeNotes.set(noteKey, {
      patternId: event.patternId,
      bus: event.bus,
      note: event.note,
      channel,
      noteOnTime: performance.now()
    });

    this.emit('noteOn', {
      bus: event.bus,
      channel,
      note: event.note,
      velocity
    });
  }

  /**
   * Handle note-off event
   */
  private async handleNoteOff(event: PatternEvent): Promise<void> {
    if (event.note === undefined) {
      throw new Error('Note-off event requires note');
    }

    const channel = event.channel || 1;
    await this.sendNoteOff(event.bus, channel, event.note);
  }

  /**
   * Send note-off message
   */
  private async sendNoteOff(bus: string, channel: number, note: number): Promise<void> {
    const noteKey = `${bus}:${channel}:${note}`;

    // Remove from active notes
    const activeNote = this.activeNotes.get(noteKey);
    if (activeNote) {
      this.activeNotes.delete(noteKey);

      // Send note-off via bus router
      await this.busRouter.routeMessage({
        bus,
        device: '',
        channel,
        type: 'noteoff',
        note,
        velocity: 0
      });

      this.emit('noteOff', {
        bus,
        channel,
        note,
        duration: performance.now() - activeNote.noteOnTime
      });
    }
  }

  /**
   * Handle CC event
   */
  private async handleCC(event: PatternEvent): Promise<void> {
    if (event.controller === undefined || event.value === undefined) {
      throw new Error('CC event requires controller and value');
    }

    const channel = event.channel || 1;

    await this.busRouter.routeMessage({
      bus: event.bus,
      device: '',
      channel,
      type: 'cc',
      controller: event.controller,
      value: event.value
    });

    this.emit('cc', {
      bus: event.bus,
      channel,
      controller: event.controller,
      value: event.value
    });
  }

  /**
   * Handle program change event
   */
  private async handleProgramChange(event: PatternEvent): Promise<void> {
    if (event.program === undefined) {
      throw new Error('Program change event requires program');
    }

    const channel = event.channel || 1;

    await this.busRouter.routeMessage({
      bus: event.bus,
      device: '',
      channel,
      type: 'program',
      value: event.program
    });

    this.emit('programChange', {
      bus: event.bus,
      channel,
      program: event.program
    });
  }

  /**
   * Apply velocity curve (linear for now)
   */
  private applyVelocityCurve(velocity: number): number {
    // Ensure velocity is in valid range
    return Math.max(1, Math.min(127, Math.round(velocity)));
  }

  /**
   * Send note-off for all active notes (panic)
   */
  async panic(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const activeNote of this.activeNotes.values()) {
      promises.push(
        this.sendNoteOff(activeNote.bus, activeNote.channel, activeNote.note)
      );
    }

    await Promise.all(promises);

    this.emit('panic', { notesCleared: promises.length });
  }

  /**
   * Get count of active notes
   */
  getActiveNoteCount(): number {
    return this.activeNotes.size;
  }

  /**
   * Get active notes for a bus
   */
  getActiveNotesForBus(bus: string): ActiveNote[] {
    const notes: ActiveNote[] = [];

    for (const activeNote of this.activeNotes.values()) {
      if (activeNote.bus === bus) {
        notes.push(activeNote);
      }
    }

    return notes;
  }

  /**
   * Clear all active notes tracking
   */
  clearActiveNotes(): void {
    this.activeNotes.clear();
  }
}
