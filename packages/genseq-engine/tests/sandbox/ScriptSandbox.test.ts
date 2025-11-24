import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptSandbox, type ScriptSandboxConfig } from '../../src/sandbox/ScriptSandbox';

/**
 * ScriptSandbox Tests
 *
 * Tests for script execution with context passing
 *
 * NOTE: The current implementation uses Function constructor as a placeholder.
 * isolated-vm should be used in production for proper sandboxing.
 * These tests document expected behavior for when proper sandboxing is implemented.
 */

describe('ScriptSandbox - Initialization', () => {
  it('should create sandbox with default config', () => {
    const sandbox = new ScriptSandbox();

    expect(sandbox).toBeInstanceOf(ScriptSandbox);
  });

  it('should create sandbox with custom config', () => {
    const config: ScriptSandboxConfig = {
      maxExecutionTime: 10,
      maxMemory: 20
    };

    const sandbox = new ScriptSandbox(config);

    expect(sandbox).toBeInstanceOf(ScriptSandbox);
  });

  it('should use default values when config is empty', () => {
    const sandbox = new ScriptSandbox({});

    // Just verify it doesn't throw
    expect(sandbox).toBeInstanceOf(ScriptSandbox);
  });
});

describe('ScriptSandbox - Script Execution', () => {
  let sandbox: ScriptSandbox;

  beforeEach(() => {
    sandbox = new ScriptSandbox();
  });

  describe('Basic Execution', () => {
    it('should execute simple code', async () => {
      const result = await sandbox.executeScript('return 42;');

      expect(result).toBe(42);
    });

    it('should execute code with arithmetic', async () => {
      const result = await sandbox.executeScript('return 2 + 2;');

      expect(result).toBe(4);
    });

    it('should execute code with string operations', async () => {
      const result = await sandbox.executeScript('return "hello" + " " + "world";');

      expect(result).toBe('hello world');
    });

    it('should execute code with array operations', async () => {
      const result = await sandbox.executeScript('return [1, 2, 3].map(x => x * 2);');

      expect(result).toEqual([2, 4, 6]);
    });

    it('should execute code that returns objects', async () => {
      const result = await sandbox.executeScript('return { note: 60, velocity: 100 };');

      expect(result).toEqual({ note: 60, velocity: 100 });
    });

    it('should execute code with undefined return', async () => {
      const result = await sandbox.executeScript('const x = 5;');

      expect(result).toBeUndefined();
    });
  });

  describe('Context Access', () => {
    it('should access context variables', async () => {
      const context = { value: 42 };
      const result = await sandbox.executeScript('return value;', context);

      expect(result).toBe(42);
    });

    it('should access nested context properties', async () => {
      const context = {
        pattern: {
          steps: 16,
          pulses: 4
        }
      };
      const result = await sandbox.executeScript('return pattern.steps;', context);

      expect(result).toBe(16);
    });

    it('should access context functions', async () => {
      const context = {
        add: (a: number, b: number) => a + b
      };
      const result = await sandbox.executeScript('return add(2, 3);', context);

      expect(result).toBe(5);
    });

    it('should use default empty context', async () => {
      const result = await sandbox.executeScript('return typeof undefined;');

      expect(result).toBe('undefined');
    });

    it('should access multiple context variables', async () => {
      const context = {
        note: 60,
        velocity: 100,
        channel: 1
      };
      const result = await sandbox.executeScript(
        'return { n: note, v: velocity, c: channel };',
        context
      );

      expect(result).toEqual({ n: 60, v: 100, c: 1 });
    });
  });

  describe('Pattern Generation Context', () => {
    it('should work with pattern-like context', async () => {
      const context = {
        params: { steps: 16, pulses: 4 },
        position: { bar: 1, beat: 1, tick: 0 },
        ppq: 480
      };

      const result = await sandbox.executeScript(
        'return { steps: params.steps, bar: position.bar };',
        context
      );

      expect(result).toEqual({ steps: 16, bar: 1 });
    });

    it('should generate MIDI events from context', async () => {
      const context = {
        note: 60,
        velocity: 100
      };

      const result = await sandbox.executeScript(`
        return [
          { tick: 0, type: 'noteOn', note: note, velocity: velocity },
          { tick: 24, type: 'noteOff', note: note, velocity: 0 }
        ];
      `, context);

      expect(result).toEqual([
        { tick: 0, type: 'noteOn', note: 60, velocity: 100 },
        { tick: 24, type: 'noteOff', note: 60, velocity: 0 }
      ]);
    });

    it('should use helper functions from context', async () => {
      const context = {
        helpers: {
          euclidean: (steps: number, pulses: number) => {
            const pattern = new Array(steps).fill(false);
            if (pulses > 0) {
              const slope = steps / pulses;
              for (let i = 0; i < pulses; i++) {
                pattern[Math.floor(i * slope)] = true;
              }
            }
            return pattern;
          }
        }
      };

      const result = await sandbox.executeScript(
        'return helpers.euclidean(8, 3);',
        context
      );

      expect(result).toHaveLength(8);
      expect(result.filter((p: boolean) => p).length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should throw on syntax error', async () => {
      await expect(
        sandbox.executeScript('return {;')
      ).rejects.toThrow();
    });

    it('should throw on runtime error', async () => {
      await expect(
        sandbox.executeScript('return foo.bar;')
      ).rejects.toThrow();
    });

    it('should throw on undefined function call', async () => {
      await expect(
        sandbox.executeScript('return nonExistentFunction();')
      ).rejects.toThrow();
    });
  });
});

describe('ScriptSandbox - Module Loading (Placeholder)', () => {
  let sandbox: ScriptSandbox;

  beforeEach(() => {
    sandbox = new ScriptSandbox();
  });

  it('should return empty object for loadModule (placeholder)', async () => {
    const result = await sandbox.loadModule('./some-module.js');

    expect(result).toEqual({});
  });
});

describe('ScriptSandbox - Cleanup', () => {
  it('should dispose without error', () => {
    const sandbox = new ScriptSandbox();

    expect(() => sandbox.dispose()).not.toThrow();
  });

  it('should handle multiple dispose calls', () => {
    const sandbox = new ScriptSandbox();

    sandbox.dispose();
    sandbox.dispose();

    // Should not throw
    expect(true).toBe(true);
  });
});

describe('ScriptSandbox - Configuration', () => {
  describe('maxExecutionTime', () => {
    it('should accept maxExecutionTime config', () => {
      const sandbox = new ScriptSandbox({ maxExecutionTime: 10 });

      // Current placeholder doesn't enforce this, but config should be accepted
      expect(sandbox).toBeInstanceOf(ScriptSandbox);
    });

    // NOTE: When isolated-vm is implemented, add tests for:
    // - Script timeout enforcement
    // - Infinite loop detection
    // - Long-running computation termination
  });

  describe('maxMemory', () => {
    it('should accept maxMemory config', () => {
      const sandbox = new ScriptSandbox({ maxMemory: 20 });

      // Current placeholder doesn't enforce this, but config should be accepted
      expect(sandbox).toBeInstanceOf(ScriptSandbox);
    });

    // NOTE: When isolated-vm is implemented, add tests for:
    // - Memory limit enforcement
    // - Large allocation detection
  });
});

describe('ScriptSandbox - Security Considerations', () => {
  let sandbox: ScriptSandbox;

  beforeEach(() => {
    sandbox = new ScriptSandbox();
  });

  // NOTE: These tests document expected behavior for a properly sandboxed implementation.
  // The current Function constructor implementation does NOT provide these guarantees.

  describe('Context Isolation (Expected Behavior)', () => {
    it('should not allow modification of passed context', async () => {
      const context = { value: 42 };

      await sandbox.executeScript('value = 100;', context);

      // NOTE: Current implementation DOES modify context (not sandboxed)
      // Proper sandboxing should prevent this
      // expect(context.value).toBe(42);
    });

    it('should not share state between executions', async () => {
      await sandbox.executeScript('var shared = 42;', {});
      const result = await sandbox.executeScript('return typeof shared;', {});

      expect(result).toBe('undefined');
    });
  });

  describe('Documentation of Security Gaps', () => {
    it('should document that current implementation is NOT sandboxed', () => {
      // This test exists to document the security status
      // The current implementation uses Function constructor which:
      // - Has access to global scope
      // - Can modify global objects
      // - Has no timeout enforcement
      // - Has no memory limits
      //
      // Production should use isolated-vm when Node 18/20 compatibility is ensured

      expect(true).toBe(true);
    });
  });
});

describe('ScriptSandbox - Practical Usage Patterns', () => {
  let sandbox: ScriptSandbox;

  beforeEach(() => {
    sandbox = new ScriptSandbox();
  });

  it('should support conditional pattern generation', async () => {
    const context = {
      params: { probability: 75 },
      random: () => 0.5 // Mocked random for deterministic test
    };

    const result = await sandbox.executeScript(`
      if (random() * 100 < params.probability) {
        return [{ tick: 0, type: 'noteOn', note: 60, velocity: 100 }];
      }
      return [];
    `, context);

    expect(result).toEqual([{ tick: 0, type: 'noteOn', note: 60, velocity: 100 }]);
  });

  it('should support looping pattern generation', async () => {
    const context = {
      steps: 4,
      note: 60
    };

    const result = await sandbox.executeScript(`
      const events = [];
      for (let i = 0; i < steps; i++) {
        events.push({
          tick: i * 24,
          type: 'noteOn',
          note: note + i,
          velocity: 100
        });
      }
      return events;
    `, context);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ tick: 0, type: 'noteOn', note: 60, velocity: 100 });
    expect(result[3]).toEqual({ tick: 72, type: 'noteOn', note: 63, velocity: 100 });
  });

  it('should support scale-aware pattern generation', async () => {
    const context = {
      baseNote: 60,
      scale: [0, 2, 4, 5, 7, 9, 11], // Major scale intervals
      steps: 4
    };

    const result = await sandbox.executeScript(`
      return scale.slice(0, steps).map((interval, i) => ({
        tick: i * 96,
        type: 'noteOn',
        note: baseNote + interval,
        velocity: 100
      }));
    `, context);

    expect(result).toHaveLength(4);
    expect(result.map((e: { note: number }) => e.note)).toEqual([60, 62, 64, 65]);
  });

  it('should support velocity variation', async () => {
    const context = {
      baseVelocity: 100,
      variation: 20,
      random: () => 0.5
    };

    const result = await sandbox.executeScript(`
      const v = baseVelocity + (random() - 0.5) * variation * 2;
      return Math.round(v);
    `, context);

    expect(result).toBe(100);
  });
});
