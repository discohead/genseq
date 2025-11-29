import { EventEmitter } from 'events';
import type { MacroEntity, MacroTarget } from '../config/entities/MacroEntity';
import type { PatternRegistry } from '@genseq/patterns';

/**
 * T062: Macro Expander - Expand macro targets to multiple pattern parameters
 *
 * Functionality:
 * - Accept macro ID and input value
 * - Load MacroEntity configuration
 * - Resolve pattern IDs from wildcards (match against active patterns)
 * - Calculate transformed value for each target: (value * scale) + offset
 * - Apply clamping if configured
 * - Sort targets by priority (ascending)
 * - Emit parameter-change event for each resolved target
 *
 * Performance contract: <5ms total expansion latency for 50 targets
 */

export interface MacroExpansionResult {
  macroId: string;
  inputValue: number;
  expandedTargets: ExpandedTarget[];
}

export interface ExpandedTarget {
  patternId: string;
  parameter: string;
  value: number;
  priority: number;
}

export interface ParameterChangeEvent {
  macroId: string;
  patternId: string;
  parameter: string;
  value: number;
  priority: number;
}

/**
 * MacroExpander expands a single macro input value to multiple pattern parameters
 * with transformation, clamping, and priority-based execution
 */
export class MacroExpander extends EventEmitter {
  private macros: Map<string, MacroEntity> = new Map();
  private patternRegistry: PatternRegistry | null = null;

  constructor() {
    super();
  }

  /**
   * Set the pattern registry for wildcard pattern ID resolution
   */
  setPatternRegistry(registry: PatternRegistry): void {
    this.patternRegistry = registry;
  }

  /**
   * Register a macro configuration
   */
  registerMacro(macro: MacroEntity): void {
    this.macros.set(macro.id, macro);
  }

  /**
   * Unregister a macro configuration
   */
  unregisterMacro(macroId: string): void {
    this.macros.delete(macroId);
  }

  /**
   * Get a macro configuration by ID
   */
  getMacro(macroId: string): MacroEntity | undefined {
    return this.macros.get(macroId);
  }

  /**
   * Clear all macro configurations
   */
  clearMacros(): void {
    this.macros.clear();
  }

  /**
   * Get count of registered macros
   */
  getMacroCount(): number {
    return this.macros.size;
  }

  /**
   * Expand a macro value to multiple pattern parameters
   *
   * @param macroId - The macro ID to expand
   * @param inputValue - The input value to transform and distribute
   * @returns MacroExpansionResult with all expanded targets
   * @throws Error if macro not found or pattern registry not set
   */
  expand(macroId: string, inputValue: number): MacroExpansionResult {
    const macro = this.macros.get(macroId);
    if (!macro) {
      throw new Error(`Macro not found: ${macroId}`);
    }

    if (!this.patternRegistry) {
      throw new Error('Pattern registry not set. Call setPatternRegistry() first.');
    }

    // Resolve all targets (expand wildcards)
    const resolvedTargets = this.resolveTargets(macro.targets);

    // Sort by priority (ascending - lower priority executes first)
    resolvedTargets.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    // Apply transformations to each target
    const expandedTargets: ExpandedTarget[] = [];

    for (const target of resolvedTargets) {
      const transformedValue = this.transformValue(inputValue, target);
      expandedTargets.push({
        patternId: target.patternId,
        parameter: target.parameter,
        value: transformedValue,
        priority: target.priority ?? 0
      });

      // Emit parameter-change event for each expanded target
      this.emit('parameter-change', {
        macroId,
        patternId: target.patternId,
        parameter: target.parameter,
        value: transformedValue,
        priority: target.priority
      } as ParameterChangeEvent);
    }

    return {
      macroId,
      inputValue,
      expandedTargets
    };
  }

  /**
   * Resolve pattern IDs from wildcard patterns
   *
   * Supported patterns:
   * - "*" - matches all active patterns
   * - "prefix-*" - matches patterns starting with "prefix-"
   * - "*-suffix" - matches patterns ending with "-suffix"
   *
   * @param targets - Array of macro targets with potential wildcards
   * @returns Array of resolved targets (wildcards expanded to concrete pattern IDs)
   */
  private resolveTargets(targets: MacroTarget[]): MacroTarget[] {
    if (!this.patternRegistry) {
      throw new Error('Pattern registry not set');
    }

    const resolved: MacroTarget[] = [];
    const activePatterns = this.patternRegistry.getAll();
    const activePatternIds = activePatterns.map(p => p.id);

    for (const target of targets) {
      const matchedIds = this.matchPatternIds(target.patternId, activePatternIds);

      // Create a resolved target for each matched pattern ID
      // Ensure all properties including priority are preserved
      for (const patternId of matchedIds) {
        resolved.push({
          patternId,
          parameter: target.parameter,
          scale: target.scale,
          offset: target.offset,
          clamp: target.clamp,
          priority: target.priority ?? 0 // Default to 0 if undefined
        });
      }
    }

    return resolved;
  }

  /**
   * Match pattern IDs against a wildcard pattern
   *
   * @param pattern - Pattern string (may contain wildcard)
   * @param patternIds - Array of available pattern IDs
   * @returns Array of matching pattern IDs
   */
  private matchPatternIds(pattern: string, patternIds: string[]): string[] {
    // No wildcard - exact match
    if (!pattern.includes('*')) {
      return patternIds.includes(pattern) ? [pattern] : [];
    }

    // Wildcard pattern matching
    if (pattern === '*') {
      // Match all patterns
      return patternIds;
    }

    if (pattern.startsWith('*-')) {
      // Suffix match: "*-kick" matches "drum-kick", "bass-kick"
      const suffix = pattern.slice(1); // Remove the asterisk
      return patternIds.filter(id => id.endsWith(suffix));
    }

    if (pattern.endsWith('-*')) {
      // Prefix match: "drum-*" matches "drum-kick", "drum-snare"
      const prefix = pattern.slice(0, -1); // Remove the asterisk
      return patternIds.filter(id => id.startsWith(prefix));
    }

    // Invalid wildcard pattern (should be caught by validation)
    return [];
  }

  /**
   * Transform input value using scale, offset, and clamping
   *
   * Formula: (value * scale) + offset
   * Then apply min/max clamping if configured
   *
   * @param inputValue - The raw input value
   * @param target - The macro target with transformation config
   * @returns Transformed and clamped value
   */
  private transformValue(inputValue: number, target: MacroTarget): number {
    // Apply scale and offset
    const scale = target.scale ?? 1.0;
    const offset = target.offset ?? 0;
    let value = (inputValue * scale) + offset;

    // Apply clamping
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
   * Test helper: Get all expanded targets without emitting events
   * Useful for testing the expansion logic in isolation
   */
  expandWithoutEvents(macroId: string, inputValue: number): MacroExpansionResult {
    const macro = this.macros.get(macroId);
    if (!macro) {
      throw new Error(`Macro not found: ${macroId}`);
    }

    if (!this.patternRegistry) {
      throw new Error('Pattern registry not set');
    }

    const resolvedTargets = this.resolveTargets(macro.targets);
    resolvedTargets.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    const expandedTargets: ExpandedTarget[] = resolvedTargets.map(target => ({
      patternId: target.patternId,
      parameter: target.parameter,
      value: this.transformValue(inputValue, target),
      priority: target.priority ?? 0
    }));

    return {
      macroId,
      inputValue,
      expandedTargets
    };
  }

  /**
   * Destroy the expander and clean up resources
   */
  destroy(): void {
    this.clearMacros();
    this.removeAllListeners();
  }
}
