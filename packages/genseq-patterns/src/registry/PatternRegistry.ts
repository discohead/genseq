import { EventEmitter } from 'events';
import type { Pattern, PatternGeneratorFn } from '../types';

/**
 * T023: Pattern registry for managing pattern instances
 *
 * Registers patterns and their generator functions
 * Manages pattern lifecycle and hot-reload
 */
export class PatternRegistry extends EventEmitter {
  private patterns: Map<string, Pattern> = new Map();
  private generators: Map<string, PatternGeneratorFn> = new Map();

  register(pattern: Pattern, generator: PatternGeneratorFn): void {
    if (this.patterns.has(pattern.id)) {
      throw new Error(`Pattern with ID ${pattern.id} already registered`);
    }

    this.patterns.set(pattern.id, pattern);
    this.generators.set(pattern.id, generator);

    this.emit('patternRegistered', pattern);
  }

  unregister(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);

    if (!pattern) {
      return false;
    }

    this.patterns.delete(patternId);
    this.generators.delete(patternId);

    this.emit('patternUnregistered', pattern);

    return true;
  }

  update(patternId: string, updates: Partial<Pattern>): boolean {
    const pattern = this.patterns.get(patternId);

    if (!pattern) {
      return false;
    }

    const updatedPattern = {
      ...pattern,
      ...updates
    };

    this.patterns.set(patternId, updatedPattern);

    this.emit('patternUpdated', updatedPattern);

    return true;
  }

  get(patternId: string): Pattern | undefined {
    return this.patterns.get(patternId);
  }

  getGenerator(patternId: string): PatternGeneratorFn | undefined {
    return this.generators.get(patternId);
  }

  getAll(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  getEnabled(): Pattern[] {
    return Array.from(this.patterns.values()).filter(p => p.enabled);
  }

  enable(patternId: string): boolean {
    return this.update(patternId, { enabled: true });
  }

  disable(patternId: string): boolean {
    return this.update(patternId, { enabled: false });
  }

  clear(): void {
    const patterns = Array.from(this.patterns.values());

    this.patterns.clear();
    this.generators.clear();

    patterns.forEach(pattern => {
      this.emit('patternUnregistered', pattern);
    });
  }

  has(patternId: string): boolean {
    return this.patterns.has(patternId);
  }

  count(): number {
    return this.patterns.size;
  }
}
