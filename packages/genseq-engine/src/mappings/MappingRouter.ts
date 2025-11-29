import { EventEmitter } from 'events';
import type { MappingEntity } from '../config/entities/MappingEntity';
import type { MacroEntity, MacroTarget } from '../config/entities/MacroEntity';
import type { MidiInputEvent } from '../midi/MidiInputHandler';
import { InputTransformer } from './InputTransformer';

/**
 * T061: MappingRouter - Route MIDI input events to pattern parameters
 *
 * Connects MIDI input events to pattern parameters via mappings:
 * - Apply InputTransformer transformations to MIDI values
 * - Expand MacroEntity targets to multiple patterns
 * - Route to pattern parameters, scene triggers, or macro controls
 * - Handle wildcard pattern matching from MacroEntity
 * - Emit events for parameter changes and scene triggers
 *
 * Performance contract: <1ms routing latency
 *
 * Events emitted:
 * - 'parameter-change': { patternId, parameter, value }
 * - 'scene-trigger': { sceneId, quantize }
 * - 'macro-expanded': { macroId, targets: [...] }
 */

export interface ParameterChangeEvent {
  patternId: string;
  parameter: string;
  value: number;
}

export interface SceneTriggerEvent {
  sceneId: string;
  quantize?: 'bar' | 'beat';
}

export interface MacroExpandedEvent {
  macroId: string;
  targets: Array<{
    patternId: string;
    parameter: string;
    value: number;
  }>;
}

export class MappingRouter extends EventEmitter {
  private transformer: InputTransformer;
  private mappings: Map<string, MappingEntity> = new Map();
  private macros: Map<string, MacroEntity> = new Map();
  private availablePatterns: Set<string> = new Set();

  constructor() {
    super();
    this.transformer = new InputTransformer();
  }

  /**
   * Register a mapping for routing
   */
  registerMapping(mapping: MappingEntity): void {
    this.mappings.set(mapping.id, mapping);
  }

  /**
   * Unregister a mapping
   */
  unregisterMapping(mappingId: string): void {
    this.mappings.delete(mappingId);
    // Clear smoothing state when mapping is removed
    this.transformer.clearSmoothing(mappingId);
  }

  /**
   * Clear all mappings
   */
  clearMappings(): void {
    this.mappings.clear();
    this.transformer.clearAllSmoothing();
  }

  /**
   * Register a macro for expansion
   */
  registerMacro(macro: MacroEntity): void {
    this.macros.set(macro.id, macro);
  }

  /**
   * Unregister a macro
   */
  unregisterMacro(macroId: string): void {
    this.macros.delete(macroId);
  }

  /**
   * Clear all macros
   */
  clearMacros(): void {
    this.macros.clear();
  }

  /**
   * Update list of available patterns for wildcard matching
   */
  updateAvailablePatterns(patternIds: string[]): void {
    this.availablePatterns = new Set(patternIds);
  }

  /**
   * Route a MIDI input event to appropriate targets
   */
  routeEvent(event: MidiInputEvent): void {
    // Find matching mappings
    for (const mapping of this.mappings.values()) {
      if (this.matchesMapping(event, mapping)) {
        this.processMapping(event, mapping);
      }
    }
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
        return source.controller === (event as any).controller;
      case 'note':
        return source.note === (event as any).note;
      case 'pitchbend':
        return true; // No additional filters for pitch bend
      default:
        return false;
    }
  }

  /**
   * Process a matched mapping
   */
  private processMapping(event: MidiInputEvent, mapping: MappingEntity): void {
    const target = mapping.target;

    switch (target.type) {
      case 'parameter':
        this.processParameterTarget(event, mapping);
        break;
      case 'macro':
        this.processMacroTarget(event, mapping);
        break;
      case 'scene':
        this.processSceneTarget(event, mapping);
        break;
    }
  }

  /**
   * Process parameter target mapping
   */
  private processParameterTarget(event: MidiInputEvent, mapping: MappingEntity): void {
    if (!mapping.transform) {
      throw new Error(`Transform is required for parameter target in mapping ${mapping.id}`);
    }

    const inputValue = this.getInputValue(event);

    // Apply transformation with smoothing
    const transformedValue = this.transformer.transformSmoothed(
      inputValue,
      mapping.transform,
      mapping.id
    );

    // If value is in dead zone, skip emission
    if (transformedValue === null) {
      return;
    }

    const target = mapping.target as any;
    this.emit('parameter-change', {
      patternId: target.patternId,
      parameter: target.parameter,
      value: transformedValue
    });
  }

  /**
   * Process macro target mapping
   */
  private processMacroTarget(event: MidiInputEvent, mapping: MappingEntity): void {
    if (!mapping.transform) {
      throw new Error(`Transform is required for macro target in mapping ${mapping.id}`);
    }

    const target = mapping.target as any;
    const macro = this.macros.get(target.macroId);

    if (!macro) {
      // Macro not found, skip silently (might be defined later)
      return;
    }

    const inputValue = this.getInputValue(event);

    // Apply transformation with smoothing
    const baseValue = this.transformer.transformSmoothed(
      inputValue,
      mapping.transform,
      mapping.id
    );

    // If value is in dead zone, skip emission
    if (baseValue === null) {
      return;
    }

    // Expand macro targets
    const expandedTargets = this.expandMacroTargets(macro, baseValue);

    // Emit macro expansion event
    this.emit('macro-expanded', {
      macroId: macro.id,
      targets: expandedTargets
    });

    // Emit individual parameter change events
    for (const target of expandedTargets) {
      this.emit('parameter-change', {
        patternId: target.patternId,
        parameter: target.parameter,
        value: target.value
      });
    }
  }

  /**
   * Process scene target mapping
   */
  private processSceneTarget(event: MidiInputEvent, mapping: MappingEntity): void {
    // Only trigger on note-on events
    if (event.type === 'note') {
      const noteEvent = event as any;
      if (!noteEvent.noteOn) {
        return; // Ignore note-off
      }
    }

    // For CC events, check threshold (useful for buttons that send 127 on press, 0 on release)
    if (event.type === 'cc') {
      const ccEvent = event as any;
      const threshold = mapping.threshold ?? 0; // Default to 0 (trigger on any value)
      if (ccEvent.value < threshold) {
        return; // Ignore values below threshold
      }
    }

    const target = mapping.target as any;
    this.emit('scene-trigger', {
      sceneId: target.sceneId,
      quantize: mapping.quantize
    });
  }

  /**
   * Expand macro targets with wildcard pattern matching
   */
  private expandMacroTargets(macro: MacroEntity, baseValue: number): Array<{
    patternId: string;
    parameter: string;
    value: number;
  }> {
    const expandedTargets: Array<{
      patternId: string;
      parameter: string;
      value: number;
    }> = [];

    // Sort targets by priority (higher priority first)
    const sortedTargets = [...macro.targets].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    for (const target of sortedTargets) {
      const matchingPatterns = this.matchWildcardPattern(target.patternId);

      for (const patternId of matchingPatterns) {
        const value = this.applyMacroTransform(baseValue, target);
        expandedTargets.push({
          patternId,
          parameter: target.parameter,
          value
        });
      }
    }

    return expandedTargets;
  }

  /**
   * Match a wildcard pattern against available patterns
   * Supports: *, prefix-*, *-suffix
   */
  private matchWildcardPattern(pattern: string): string[] {
    // Exact match (no wildcard)
    if (!pattern.includes('*')) {
      return this.availablePatterns.has(pattern) ? [pattern] : [];
    }

    // Match all patterns
    if (pattern === '*') {
      return Array.from(this.availablePatterns);
    }

    const matches: string[] = [];

    // Prefix match: prefix-*
    if (pattern.endsWith('*') && !pattern.startsWith('*')) {
      const prefix = pattern.slice(0, -1);
      for (const patternId of this.availablePatterns) {
        if (patternId.startsWith(prefix)) {
          matches.push(patternId);
        }
      }
      return matches;
    }

    // Suffix match: *-suffix
    if (pattern.startsWith('*') && !pattern.endsWith('*')) {
      const suffix = pattern.slice(1);
      for (const patternId of this.availablePatterns) {
        if (patternId.endsWith(suffix)) {
          matches.push(patternId);
        }
      }
      return matches;
    }

    // Invalid pattern (multiple wildcards or middle wildcard)
    return [];
  }

  /**
   * Apply macro target transformations (scale, offset, clamp)
   */
  private applyMacroTransform(baseValue: number, target: MacroTarget): number {
    let value = baseValue;

    // Apply scale
    value *= target.scale ?? 1.0;

    // Apply offset
    value += target.offset ?? 0;

    // Apply clamp
    if (target.clamp) {
      if (target.clamp.min !== undefined) {
        value = Math.max(value, target.clamp.min);
      }
      if (target.clamp.max !== undefined) {
        value = Math.min(value, target.clamp.max);
      }
    }

    return value;
  }

  /**
   * Get input value from MIDI event
   */
  private getInputValue(event: MidiInputEvent): number {
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

  /**
   * Get registered mapping count
   */
  getMappingCount(): number {
    return this.mappings.size;
  }

  /**
   * Get registered macro count
   */
  getMacroCount(): number {
    return this.macros.size;
  }

  /**
   * Check if a mapping is registered
   */
  hasMapping(mappingId: string): boolean {
    return this.mappings.has(mappingId);
  }

  /**
   * Check if a macro is registered
   */
  hasMacro(macroId: string): boolean {
    return this.macros.has(macroId);
  }

  /**
   * Get available patterns count
   */
  getAvailablePatternsCount(): number {
    return this.availablePatterns.size;
  }

  /**
   * Destroy router and clean up resources
   */
  destroy(): void {
    this.clearMappings();
    this.clearMacros();
    this.availablePatterns.clear();
    this.removeAllListeners();
  }
}
