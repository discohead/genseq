import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternRegistry } from '../src/registry/PatternRegistry';
import type { Pattern, PatternGeneratorFn, PatternContext, MidiEvent } from '../src/types';

/**
 * PatternRegistry Tests
 *
 * Tests for pattern lifecycle management, registration, updates, and events
 */

// Helper to create a test pattern
function createPattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'pattern-1',
    name: 'Test Pattern',
    type: 'euclidean',
    enabled: true,
    length: 1,
    division: 4,
    bus: 'drums',
    note: 60,
    channel: 1,
    parameters: {
      steps: 16,
      pulses: 4,
      velocity: 100
    },
    ...overrides
  };
}

// Helper to create a test generator function
function createGenerator(): PatternGeneratorFn {
  return (_context: PatternContext): MidiEvent[] => {
    return [
      { tick: 0, type: 'noteOn', note: 60, velocity: 100 },
      { tick: 24, type: 'noteOff', note: 60, velocity: 0 }
    ];
  };
}

describe('PatternRegistry - Registration', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  describe('register', () => {
    it('should register a pattern with generator', () => {
      const pattern = createPattern();
      const generator = createGenerator();

      registry.register(pattern, generator);

      expect(registry.has('pattern-1')).toBe(true);
      expect(registry.get('pattern-1')).toBe(pattern);
      expect(registry.getGenerator('pattern-1')).toBe(generator);
    });

    it('should throw error for duplicate pattern ID', () => {
      const pattern = createPattern();
      const generator = createGenerator();

      registry.register(pattern, generator);

      expect(() => {
        registry.register(createPattern(), createGenerator());
      }).toThrow('Pattern with ID pattern-1 already registered');
    });

    it('should emit "patternRegistered" event', () => {
      const handler = vi.fn();
      registry.on('patternRegistered', handler);

      const pattern = createPattern();
      registry.register(pattern, createGenerator());

      expect(handler).toHaveBeenCalledWith(pattern);
    });

    it('should register multiple patterns with different IDs', () => {
      const pattern1 = createPattern({ id: 'pattern-1' });
      const pattern2 = createPattern({ id: 'pattern-2' });

      registry.register(pattern1, createGenerator());
      registry.register(pattern2, createGenerator());

      expect(registry.count()).toBe(2);
      expect(registry.has('pattern-1')).toBe(true);
      expect(registry.has('pattern-2')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('should unregister a pattern', () => {
      const pattern = createPattern();
      registry.register(pattern, createGenerator());

      const result = registry.unregister('pattern-1');

      expect(result).toBe(true);
      expect(registry.has('pattern-1')).toBe(false);
      expect(registry.get('pattern-1')).toBeUndefined();
      expect(registry.getGenerator('pattern-1')).toBeUndefined();
    });

    it('should return false for non-existent pattern', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });

    it('should emit "patternUnregistered" event', () => {
      const handler = vi.fn();
      registry.on('patternUnregistered', handler);

      const pattern = createPattern();
      registry.register(pattern, createGenerator());
      registry.unregister('pattern-1');

      expect(handler).toHaveBeenCalledWith(pattern);
    });

    it('should not emit event for non-existent pattern', () => {
      const handler = vi.fn();
      registry.on('patternUnregistered', handler);

      registry.unregister('non-existent');

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('PatternRegistry - Updates', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  describe('update', () => {
    it('should update pattern properties', () => {
      const pattern = createPattern({ enabled: true });
      registry.register(pattern, createGenerator());

      const result = registry.update('pattern-1', { enabled: false });

      expect(result).toBe(true);
      expect(registry.get('pattern-1')?.enabled).toBe(false);
    });

    it('should return false for non-existent pattern', () => {
      const result = registry.update('non-existent', { enabled: false });

      expect(result).toBe(false);
    });

    it('should emit "patternUpdated" event', () => {
      const handler = vi.fn();
      registry.on('patternUpdated', handler);

      const pattern = createPattern();
      registry.register(pattern, createGenerator());
      registry.update('pattern-1', { name: 'Updated Name' });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: 'pattern-1',
        name: 'Updated Name'
      }));
    });

    it('should merge update with existing pattern', () => {
      const pattern = createPattern({
        name: 'Original',
        note: 60,
        parameters: { steps: 16, pulses: 4 }
      });
      registry.register(pattern, createGenerator());

      registry.update('pattern-1', {
        name: 'Updated',
        parameters: { steps: 8, pulses: 3 }
      });

      const updated = registry.get('pattern-1');
      expect(updated?.name).toBe('Updated');
      // Original fields preserved
      expect(updated?.note).toBe(60);
      // Parameters replaced (shallow merge)
      expect(updated?.parameters).toEqual({ steps: 8, pulses: 3 });
    });
  });
});

describe('PatternRegistry - Enable/Disable', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  describe('enable', () => {
    it('should enable a disabled pattern', () => {
      const pattern = createPattern({ enabled: false });
      registry.register(pattern, createGenerator());

      const result = registry.enable('pattern-1');

      expect(result).toBe(true);
      expect(registry.get('pattern-1')?.enabled).toBe(true);
    });

    it('should return false for non-existent pattern', () => {
      const result = registry.enable('non-existent');

      expect(result).toBe(false);
    });

    it('should emit "patternUpdated" event', () => {
      const handler = vi.fn();
      registry.on('patternUpdated', handler);

      const pattern = createPattern({ enabled: false });
      registry.register(pattern, createGenerator());
      registry.enable('pattern-1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('should disable an enabled pattern', () => {
      const pattern = createPattern({ enabled: true });
      registry.register(pattern, createGenerator());

      const result = registry.disable('pattern-1');

      expect(result).toBe(true);
      expect(registry.get('pattern-1')?.enabled).toBe(false);
    });

    it('should return false for non-existent pattern', () => {
      const result = registry.disable('non-existent');

      expect(result).toBe(false);
    });
  });
});

describe('PatternRegistry - Query Methods', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  describe('get', () => {
    it('should return pattern by ID', () => {
      const pattern = createPattern();
      registry.register(pattern, createGenerator());

      expect(registry.get('pattern-1')).toBe(pattern);
    });

    it('should return undefined for non-existent ID', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('getGenerator', () => {
    it('should return generator by ID', () => {
      const generator = createGenerator();
      registry.register(createPattern(), generator);

      expect(registry.getGenerator('pattern-1')).toBe(generator);
    });

    it('should return undefined for non-existent ID', () => {
      expect(registry.getGenerator('non-existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all patterns', () => {
      registry.register(createPattern({ id: 'p1' }), createGenerator());
      registry.register(createPattern({ id: 'p2' }), createGenerator());
      registry.register(createPattern({ id: 'p3' }), createGenerator());

      const all = registry.getAll();

      expect(all).toHaveLength(3);
      expect(all.map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
    });

    it('should return empty array when no patterns', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('getEnabled', () => {
    it('should return only enabled patterns', () => {
      registry.register(createPattern({ id: 'p1', enabled: true }), createGenerator());
      registry.register(createPattern({ id: 'p2', enabled: false }), createGenerator());
      registry.register(createPattern({ id: 'p3', enabled: true }), createGenerator());

      const enabled = registry.getEnabled();

      expect(enabled).toHaveLength(2);
      expect(enabled.map(p => p.id)).toEqual(['p1', 'p3']);
    });

    it('should return empty array when no enabled patterns', () => {
      registry.register(createPattern({ id: 'p1', enabled: false }), createGenerator());

      expect(registry.getEnabled()).toEqual([]);
    });
  });

  describe('has', () => {
    it('should return true for existing pattern', () => {
      registry.register(createPattern(), createGenerator());

      expect(registry.has('pattern-1')).toBe(true);
    });

    it('should return false for non-existent pattern', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('count', () => {
    it('should return number of registered patterns', () => {
      expect(registry.count()).toBe(0);

      registry.register(createPattern({ id: 'p1' }), createGenerator());
      expect(registry.count()).toBe(1);

      registry.register(createPattern({ id: 'p2' }), createGenerator());
      expect(registry.count()).toBe(2);
    });
  });
});

describe('PatternRegistry - Clear', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  it('should remove all patterns', () => {
    registry.register(createPattern({ id: 'p1' }), createGenerator());
    registry.register(createPattern({ id: 'p2' }), createGenerator());
    registry.register(createPattern({ id: 'p3' }), createGenerator());

    registry.clear();

    expect(registry.count()).toBe(0);
    expect(registry.getAll()).toEqual([]);
  });

  it('should remove all generators', () => {
    registry.register(createPattern({ id: 'p1' }), createGenerator());

    registry.clear();

    expect(registry.getGenerator('p1')).toBeUndefined();
  });

  it('should emit "patternUnregistered" for each pattern', () => {
    const handler = vi.fn();
    registry.on('patternUnregistered', handler);

    registry.register(createPattern({ id: 'p1' }), createGenerator());
    registry.register(createPattern({ id: 'p2' }), createGenerator());
    registry.register(createPattern({ id: 'p3' }), createGenerator());

    registry.clear();

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('should handle clear on empty registry', () => {
    const handler = vi.fn();
    registry.on('patternUnregistered', handler);

    registry.clear();

    expect(handler).not.toHaveBeenCalled();
    expect(registry.count()).toBe(0);
  });
});

describe('PatternRegistry - Event Emitter', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  it('should inherit from EventEmitter', () => {
    expect(typeof registry.on).toBe('function');
    expect(typeof registry.off).toBe('function');
    expect(typeof registry.emit).toBe('function');
  });

  it('should allow removing event listeners', () => {
    const handler = vi.fn();
    registry.on('patternRegistered', handler);
    registry.off('patternRegistered', handler);

    registry.register(createPattern(), createGenerator());

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple listeners', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    registry.on('patternRegistered', handler1);
    registry.on('patternRegistered', handler2);

    registry.register(createPattern(), createGenerator());

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });
});

describe('PatternRegistry - Pattern Types', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  it('should handle euclidean patterns', () => {
    const pattern = createPattern({
      type: 'euclidean',
      parameters: { steps: 16, pulses: 4 }
    });
    registry.register(pattern, createGenerator());

    expect(registry.get('pattern-1')?.type).toBe('euclidean');
  });

  it('should handle probability patterns', () => {
    const pattern = createPattern({
      type: 'probability',
      parameters: { probability: 50, density: 0.5 }
    });
    registry.register(pattern, createGenerator());

    expect(registry.get('pattern-1')?.type).toBe('probability');
  });

  it('should handle phase patterns', () => {
    const pattern = createPattern({
      type: 'phase',
      parameters: { phaseOffset: 0, phaseRate: 1 }
    });
    registry.register(pattern, createGenerator());

    expect(registry.get('pattern-1')?.type).toBe('phase');
  });

  it('should handle script patterns', () => {
    const pattern = createPattern({
      type: 'script',
      scriptPath: './custom-pattern.js',
      scriptParams: { customParam: 'value' }
    });
    registry.register(pattern, createGenerator());

    expect(registry.get('pattern-1')?.type).toBe('script');
    expect(registry.get('pattern-1')?.scriptPath).toBe('./custom-pattern.js');
  });
});

describe('PatternRegistry - Edge Cases', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
  });

  it('should handle rapid registration/unregistration', () => {
    for (let i = 0; i < 100; i++) {
      registry.register(createPattern({ id: `p${i}` }), createGenerator());
    }

    expect(registry.count()).toBe(100);

    for (let i = 0; i < 100; i++) {
      registry.unregister(`p${i}`);
    }

    expect(registry.count()).toBe(0);
  });

  it('should handle special characters in pattern ID', () => {
    const pattern = createPattern({ id: 'pattern-with-special_chars.v1' });
    registry.register(pattern, createGenerator());

    expect(registry.has('pattern-with-special_chars.v1')).toBe(true);
    expect(registry.get('pattern-with-special_chars.v1')).toBe(pattern);
  });

  it('should preserve pattern reference after update', () => {
    const pattern = createPattern();
    registry.register(pattern, createGenerator());

    registry.update('pattern-1', { name: 'Updated' });

    // The stored pattern should be updated in place
    const retrieved = registry.get('pattern-1');
    expect(retrieved?.name).toBe('Updated');
  });
});
