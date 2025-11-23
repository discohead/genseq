import { EventEmitter } from 'events';
import type { RouteEntity } from '../config/entities/RouteEntity';
import type { MidiIO } from './MidiIO';

/**
 * T031: BusRouter - maps logical buses to physical MIDI ports
 *
 * Responsibilities:
 * - Maintain bus-to-device routing table
 * - Apply transformations (transpose, velocity scaling)
 * - Handle multiple outputs per bus
 * - Support hot-reload of routing configuration
 */

export interface BusRouterConfig {
  midiIO: MidiIO;
}

export interface RoutedMessage {
  bus: string;
  device: string;
  channel: number;
  type: string;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
}

export class BusRouter extends EventEmitter {
  private midiIO: MidiIO;
  private routes: Map<string, RouteEntity[]> = new Map();

  constructor(config: BusRouterConfig) {
    super();
    this.midiIO = config.midiIO;
  }

  /**
   * Add route to routing table
   */
  addRoute(route: RouteEntity): void {
    const busRoutes = this.routes.get(route.bus) || [];
    busRoutes.push(route);
    this.routes.set(route.bus, busRoutes);

    this.emit('routeAdded', route.id);
  }

  /**
   * Remove route from routing table
   */
  removeRoute(routeId: string): void {
    for (const [bus, routes] of this.routes.entries()) {
      const filtered = routes.filter(r => r.id !== routeId);
      if (filtered.length !== routes.length) {
        this.routes.set(bus, filtered);
        this.emit('routeRemoved', routeId);
        return;
      }
    }
  }

  /**
   * Update route configuration
   */
  updateRoute(routeId: string, updates: Partial<RouteEntity>): void {
    for (const routes of this.routes.values()) {
      const route = routes.find(r => r.id === routeId);
      if (route) {
        Object.assign(route, updates);
        this.emit('routeUpdated', routeId);
        return;
      }
    }
  }

  /**
   * Get routes for a bus
   */
  getRoutesForBus(bus: string): RouteEntity[] {
    return this.routes.get(bus) || [];
  }

  /**
   * Route message from bus to physical devices
   */
  async routeMessage(message: RoutedMessage): Promise<void> {
    const routes = this.routes.get(message.bus);

    if (!routes || routes.length === 0) {
      this.emit('warn', `No routes configured for bus: ${message.bus}`);
      return;
    }

    for (const route of routes) {
      if (!route.enabled) {
        continue;
      }

      try {
        const transformedMessage = this.applyTransform(message, route);

        // Send to MIDI device
        await this.midiIO.sendMessage({
          type: transformedMessage.type,
          channel: transformedMessage.channel - 1, // MidiIO uses 0-based channels
          note: transformedMessage.note,
          velocity: transformedMessage.velocity,
          controller: transformedMessage.controller,
          value: transformedMessage.value
        });

        this.emit('messageRouted', { bus: message.bus, route: route.id });
      } catch (error) {
        this.emit('error', { route: route.id, error });
      }
    }
  }

  /**
   * Apply route transformations to message
   */
  private applyTransform(message: RoutedMessage, route: RouteEntity): RoutedMessage {
    const transformed: RoutedMessage = {
      ...message,
      channel: route.channel
    };

    if (!route.transform) {
      return transformed;
    }

    // Apply transpose
    if (route.transform.transpose !== undefined && message.note !== undefined) {
      transformed.note = Math.max(0, Math.min(127, message.note + route.transform.transpose));
    }

    // Apply velocity scaling and offset
    if (message.velocity !== undefined) {
      let velocity = message.velocity;

      if (route.transform.velocityScale !== undefined) {
        velocity = velocity * route.transform.velocityScale;
      }

      if (route.transform.velocityOffset !== undefined) {
        velocity = velocity + route.transform.velocityOffset;
      }

      transformed.velocity = Math.max(1, Math.min(127, Math.round(velocity)));
    }

    // Apply channel override
    if (route.transform.channelOverride !== undefined) {
      transformed.channel = route.transform.channelOverride;
    }

    return transformed;
  }

  /**
   * Clear all routes
   */
  clearAll(): void {
    this.routes.clear();
    this.emit('routesCleared');
  }

  /**
   * Get all bus names
   */
  getBuses(): string[] {
    return Array.from(this.routes.keys());
  }

  /**
   * Get total route count
   */
  getRouteCount(): number {
    let count = 0;
    for (const routes of this.routes.values()) {
      count += routes.length;
    }
    return count;
  }
}
