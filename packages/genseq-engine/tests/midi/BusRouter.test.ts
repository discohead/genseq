import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BusRouter, type RoutedMessage } from '../../src/midi/BusRouter';
import type { MidiIO } from '../../src/midi/MidiIO';
import type { RouteEntity } from '../../src/config/entities/RouteEntity';

/**
 * BusRouter Tests
 *
 * Tests for MIDI bus routing, transformations, and event emission
 */

// Mock MidiIO
function createMockMidiIO(): MidiIO {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getOutputs: vi.fn().mockReturnValue([]),
    getInputs: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  } as unknown as MidiIO;
}

// Helper to create route entity
function createRoute(overrides: Partial<RouteEntity> = {}): RouteEntity {
  return {
    id: 'route-1',
    bus: 'drums',
    device: 'virtual',
    channel: 1,
    enabled: true,
    ...overrides
  };
}

// Helper to create routed message
function createMessage(overrides: Partial<RoutedMessage> = {}): RoutedMessage {
  return {
    bus: 'drums',
    device: 'virtual',
    channel: 1,
    type: 'noteOn',
    note: 60,
    velocity: 100,
    ...overrides
  };
}

describe('BusRouter - Route Management', () => {
  let router: BusRouter;
  let mockMidiIO: MidiIO;

  beforeEach(() => {
    mockMidiIO = createMockMidiIO();
    router = new BusRouter({ midiIO: mockMidiIO });
  });

  describe('addRoute', () => {
    it('should add a route to the routing table', () => {
      const route = createRoute();
      router.addRoute(route);

      expect(router.getRoutesForBus('drums')).toHaveLength(1);
      expect(router.getRoutesForBus('drums')[0]).toBe(route);
    });

    it('should support multiple routes for same bus', () => {
      const route1 = createRoute({ id: 'route-1', device: 'device-1' });
      const route2 = createRoute({ id: 'route-2', device: 'device-2' });

      router.addRoute(route1);
      router.addRoute(route2);

      expect(router.getRoutesForBus('drums')).toHaveLength(2);
    });

    it('should support multiple buses', () => {
      const drumsRoute = createRoute({ bus: 'drums' });
      const bassRoute = createRoute({ id: 'route-2', bus: 'bass' });

      router.addRoute(drumsRoute);
      router.addRoute(bassRoute);

      expect(router.getRoutesForBus('drums')).toHaveLength(1);
      expect(router.getRoutesForBus('bass')).toHaveLength(1);
      expect(router.getBuses()).toContain('drums');
      expect(router.getBuses()).toContain('bass');
    });

    it('should emit "routeAdded" event', () => {
      const handler = vi.fn();
      router.on('routeAdded', handler);

      const route = createRoute();
      router.addRoute(route);

      expect(handler).toHaveBeenCalledWith('route-1');
    });
  });

  describe('removeRoute', () => {
    it('should remove a route from the routing table', () => {
      const route = createRoute();
      router.addRoute(route);
      router.removeRoute('route-1');

      expect(router.getRoutesForBus('drums')).toHaveLength(0);
    });

    it('should emit "routeRemoved" event', () => {
      const handler = vi.fn();
      router.on('routeRemoved', handler);

      const route = createRoute();
      router.addRoute(route);
      router.removeRoute('route-1');

      expect(handler).toHaveBeenCalledWith('route-1');
    });

    it('should not emit event if route not found', () => {
      const handler = vi.fn();
      router.on('routeRemoved', handler);

      router.removeRoute('non-existent');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only remove the specified route', () => {
      const route1 = createRoute({ id: 'route-1' });
      const route2 = createRoute({ id: 'route-2' });

      router.addRoute(route1);
      router.addRoute(route2);
      router.removeRoute('route-1');

      expect(router.getRoutesForBus('drums')).toHaveLength(1);
      expect(router.getRoutesForBus('drums')[0].id).toBe('route-2');
    });
  });

  describe('updateRoute', () => {
    it('should update route properties', () => {
      const route = createRoute();
      router.addRoute(route);
      router.updateRoute('route-1', { channel: 10 });

      expect(router.getRoutesForBus('drums')[0].channel).toBe(10);
    });

    it('should emit "routeUpdated" event', () => {
      const handler = vi.fn();
      router.on('routeUpdated', handler);

      const route = createRoute();
      router.addRoute(route);
      router.updateRoute('route-1', { enabled: false });

      expect(handler).toHaveBeenCalledWith('route-1');
    });

    it('should not emit event if route not found', () => {
      const handler = vi.fn();
      router.on('routeUpdated', handler);

      router.updateRoute('non-existent', { channel: 10 });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should remove all routes', () => {
      router.addRoute(createRoute({ id: 'route-1', bus: 'drums' }));
      router.addRoute(createRoute({ id: 'route-2', bus: 'bass' }));

      router.clearAll();

      expect(router.getRouteCount()).toBe(0);
      expect(router.getBuses()).toHaveLength(0);
    });

    it('should emit "routesCleared" event', () => {
      const handler = vi.fn();
      router.on('routesCleared', handler);

      router.clearAll();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getRouteCount', () => {
    it('should return total number of routes', () => {
      expect(router.getRouteCount()).toBe(0);

      router.addRoute(createRoute({ id: 'route-1', bus: 'drums' }));
      expect(router.getRouteCount()).toBe(1);

      router.addRoute(createRoute({ id: 'route-2', bus: 'bass' }));
      expect(router.getRouteCount()).toBe(2);
    });
  });

  describe('getBuses', () => {
    it('should return all bus names', () => {
      router.addRoute(createRoute({ id: 'route-1', bus: 'drums' }));
      router.addRoute(createRoute({ id: 'route-2', bus: 'bass' }));
      router.addRoute(createRoute({ id: 'route-3', bus: 'lead' }));

      const buses = router.getBuses();

      expect(buses).toHaveLength(3);
      expect(buses).toContain('drums');
      expect(buses).toContain('bass');
      expect(buses).toContain('lead');
    });

    it('should return empty array when no routes', () => {
      expect(router.getBuses()).toEqual([]);
    });
  });

  describe('getRoutesForBus', () => {
    it('should return empty array for unknown bus', () => {
      expect(router.getRoutesForBus('unknown')).toEqual([]);
    });
  });
});

describe('BusRouter - Message Routing', () => {
  let router: BusRouter;
  let mockMidiIO: MidiIO;

  beforeEach(() => {
    mockMidiIO = createMockMidiIO();
    router = new BusRouter({ midiIO: mockMidiIO });
  });

  it('should route message to MidiIO', async () => {
    const route = createRoute();
    router.addRoute(route);

    const message = createMessage();
    await router.routeMessage(message);

    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith({
      type: 'noteOn',
      channel: 0, // 0-based
      note: 60,
      velocity: 100,
      controller: undefined,
      value: undefined
    });
  });

  it('should emit warning for unknown bus', async () => {
    const warnHandler = vi.fn();
    router.on('warn', warnHandler);

    await router.routeMessage(createMessage({ bus: 'unknown' }));

    expect(warnHandler).toHaveBeenCalledWith('No routes configured for bus: unknown');
    expect(mockMidiIO.sendMessage).not.toHaveBeenCalled();
  });

  it('should skip disabled routes', async () => {
    const route = createRoute({ enabled: false });
    router.addRoute(route);

    await router.routeMessage(createMessage());

    expect(mockMidiIO.sendMessage).not.toHaveBeenCalled();
  });

  it('should route to multiple outputs for same bus', async () => {
    router.addRoute(createRoute({ id: 'route-1', device: 'device-1' }));
    router.addRoute(createRoute({ id: 'route-2', device: 'device-2' }));

    await router.routeMessage(createMessage());

    expect(mockMidiIO.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should emit "messageRouted" event for each route', async () => {
    const handler = vi.fn();
    router.on('messageRouted', handler);

    router.addRoute(createRoute({ id: 'route-1' }));
    router.addRoute(createRoute({ id: 'route-2' }));

    await router.routeMessage(createMessage());

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({ bus: 'drums', route: 'route-1' });
    expect(handler).toHaveBeenCalledWith({ bus: 'drums', route: 'route-2' });
  });

  it('should emit "error" event on MidiIO failure', async () => {
    const error = new Error('MIDI send failed');
    (mockMidiIO.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    const errorHandler = vi.fn();
    router.on('error', errorHandler);

    router.addRoute(createRoute());
    await router.routeMessage(createMessage());

    expect(errorHandler).toHaveBeenCalledWith({
      route: 'route-1',
      error
    });
  });

  it('should continue routing to other outputs after error', async () => {
    (mockMidiIO.sendMessage as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('First failed'))
      .mockResolvedValueOnce(undefined);

    // Add error listener to prevent unhandled error
    router.on('error', () => {});

    router.addRoute(createRoute({ id: 'route-1' }));
    router.addRoute(createRoute({ id: 'route-2' }));

    await router.routeMessage(createMessage());

    expect(mockMidiIO.sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('BusRouter - Channel Hierarchy', () => {
  let router: BusRouter;
  let mockMidiIO: MidiIO;

  beforeEach(() => {
    mockMidiIO = createMockMidiIO();
    router = new BusRouter({ midiIO: mockMidiIO });
  });

  it('should use message channel when specified', async () => {
    const route = createRoute({ channel: 1 });
    router.addRoute(route);

    // Message specifies channel 10
    await router.routeMessage(createMessage({ channel: 10 }));

    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 9 }) // 0-based
    );
  });

  it('should fall back to route channel when message channel is null', async () => {
    const route = createRoute({ channel: 5 });
    router.addRoute(route);

    // Message with null channel
    await router.routeMessage({ ...createMessage(), channel: null as unknown as number });

    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 4 }) // 0-based (route channel 5)
    );
  });

  it('should apply channelOverride transform over message channel', async () => {
    const route = createRoute({
      channel: 1,
      transform: { channelOverride: 16 }
    });
    router.addRoute(route);

    await router.routeMessage(createMessage({ channel: 5 }));

    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 15 }) // 0-based (override channel 16)
    );
  });
});

describe('BusRouter - Transformations', () => {
  let router: BusRouter;
  let mockMidiIO: MidiIO;

  beforeEach(() => {
    mockMidiIO = createMockMidiIO();
    router = new BusRouter({ midiIO: mockMidiIO });
  });

  describe('Transpose', () => {
    it('should transpose note up', async () => {
      const route = createRoute({
        transform: { transpose: 12 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ note: 60 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ note: 72 })
      );
    });

    it('should transpose note down', async () => {
      const route = createRoute({
        transform: { transpose: -12 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ note: 60 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ note: 48 })
      );
    });

    it('should clamp transposed note to 0', async () => {
      const route = createRoute({
        transform: { transpose: -100 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ note: 60 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ note: 0 })
      );
    });

    it('should clamp transposed note to 127', async () => {
      const route = createRoute({
        transform: { transpose: 100 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ note: 60 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ note: 127 })
      );
    });

    it('should not transpose messages without note', async () => {
      const route = createRoute({
        transform: { transpose: 12 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({
        type: 'cc',
        note: undefined,
        controller: 1,
        value: 64
      }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ note: undefined })
      );
    });
  });

  describe('Velocity Scale', () => {
    it('should scale velocity up', async () => {
      const route = createRoute({
        transform: { velocityScale: 1.5 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 80 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 120 })
      );
    });

    it('should scale velocity down', async () => {
      const route = createRoute({
        transform: { velocityScale: 0.5 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 100 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 50 })
      );
    });

    it('should clamp scaled velocity to 127', async () => {
      const route = createRoute({
        transform: { velocityScale: 2.0 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 100 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 127 })
      );
    });

    it('should clamp scaled velocity to minimum 1', async () => {
      const route = createRoute({
        transform: { velocityScale: 0.0 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 100 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 1 })
      );
    });
  });

  describe('Velocity Offset', () => {
    it('should add positive offset', async () => {
      const route = createRoute({
        transform: { velocityOffset: 20 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 80 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 100 })
      );
    });

    it('should add negative offset', async () => {
      const route = createRoute({
        transform: { velocityOffset: -20 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 80 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 60 })
      );
    });

    it('should clamp offset velocity to 127', async () => {
      const route = createRoute({
        transform: { velocityOffset: 50 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 100 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 127 })
      );
    });

    it('should clamp offset velocity to minimum 1', async () => {
      const route = createRoute({
        transform: { velocityOffset: -200 }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({ velocity: 100 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 1 })
      );
    });
  });

  describe('Combined Transformations', () => {
    it('should apply scale before offset', async () => {
      const route = createRoute({
        transform: {
          velocityScale: 0.5,
          velocityOffset: 20
        }
      });
      router.addRoute(route);

      // 100 * 0.5 = 50, then 50 + 20 = 70
      await router.routeMessage(createMessage({ velocity: 100 }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ velocity: 70 })
      );
    });

    it('should apply all transformations together', async () => {
      const route = createRoute({
        channel: 1,
        transform: {
          transpose: 12,
          velocityScale: 0.8,
          velocityOffset: 10,
          channelOverride: 10
        }
      });
      router.addRoute(route);

      await router.routeMessage(createMessage({
        channel: 5,
        note: 60,
        velocity: 100
      }));

      // Note: 60 + 12 = 72
      // Velocity: 100 * 0.8 + 10 = 90
      // Channel: override to 10 (0-based = 9)
      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith({
        type: 'noteOn',
        channel: 9,
        note: 72,
        velocity: 90,
        controller: undefined,
        value: undefined
      });
    });
  });

  describe('No Transform', () => {
    it('should pass through message unchanged without transform', async () => {
      const route = createRoute(); // No transform
      router.addRoute(route);

      await router.routeMessage(createMessage({
        channel: 5,
        note: 60,
        velocity: 100
      }));

      expect(mockMidiIO.sendMessage).toHaveBeenCalledWith({
        type: 'noteOn',
        channel: 4, // 0-based
        note: 60,
        velocity: 100,
        controller: undefined,
        value: undefined
      });
    });
  });
});

describe('BusRouter - CC and Other Message Types', () => {
  let router: BusRouter;
  let mockMidiIO: MidiIO;

  beforeEach(() => {
    mockMidiIO = createMockMidiIO();
    router = new BusRouter({ midiIO: mockMidiIO });
  });

  it('should route CC messages', async () => {
    router.addRoute(createRoute());

    await router.routeMessage({
      bus: 'drums',
      device: 'virtual',
      channel: 1,
      type: 'cc',
      controller: 1,
      value: 64
    });

    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cc',
        controller: 1,
        value: 64
      })
    );
  });

  it('should not apply note transform to CC messages', async () => {
    const route = createRoute({
      transform: { transpose: 12 }
    });
    router.addRoute(route);

    await router.routeMessage({
      bus: 'drums',
      device: 'virtual',
      channel: 1,
      type: 'cc',
      controller: 1,
      value: 64
    });

    // Controller value should not be transposed
    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        controller: 1,
        value: 64
      })
    );
  });

  it('should route noteOff messages', async () => {
    router.addRoute(createRoute());

    await router.routeMessage(createMessage({ type: 'noteOff' }));

    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'noteOff' })
    );
  });

  it('should apply transpose to noteOff messages', async () => {
    const route = createRoute({
      transform: { transpose: 12 }
    });
    router.addRoute(route);

    await router.routeMessage(createMessage({
      type: 'noteOff',
      note: 60,
      velocity: 0
    }));

    expect(mockMidiIO.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'noteOff',
        note: 72
      })
    );
  });
});
