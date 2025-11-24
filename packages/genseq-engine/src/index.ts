/**
 * @genseq/engine - Core sequencing library
 */

export const version = '0.1.0';

// Clock
export { Clock, type ClockConfig, type ClockPosition } from './clock/Clock';

// Scheduler
export { Scheduler, type SchedulerConfig, type ScheduledEvent } from './scheduler/Scheduler';

// MIDI
export { MidiIO, type MidiIOConfig, type MidiMessage, type MidiPort } from './midi/MidiIO';

// Configuration
export { ConfigLoader, type ConfigLoaderConfig, type LoadOptions, type WatchOptions } from './config/ConfigLoader';
export { SchemaValidator, type ValidationResult, type ValidationError, type SchemaValidatorConfig, type ValidationContext } from './config/SchemaValidator';
export { ConfigurationManager, type ProjectConfig, type ConfigurationManagerOptions, type ConfigSnapshot, type ConfigDiff } from './config/ConfigurationManager';

// Logging
export { ErrorLogger, type ErrorDetail, type FormatOptions, type ParseErrorLocation } from './logging/ErrorLogger';

// Sandbox
export { ScriptSandbox, type ScriptSandboxConfig } from './sandbox/ScriptSandbox';

// Monitoring
export { PerformanceMonitor, type PerformanceMetrics } from './monitoring/PerformanceMonitor';

// Entities
export { ClockEntityLoader, ClockEntityValidator, type ClockEntity } from './config/entities/ClockEntity';
export { PatternEntityLoader, PatternEntityValidator, type PatternEntity } from './config/entities/PatternEntity';
export { RouteEntityLoader, RouteEntityValidator, type RouteEntity, type RouteTransform } from './config/entities/RouteEntity';

// Patterns
export { PatternExecutor, type PatternExecutorConfig, type ActivePattern } from './patterns/PatternExecutor';

// MIDI Routing
export { BusRouter, type BusRouterConfig, type RoutedMessage } from './midi/BusRouter';
export { MidiOutputHandler, type MidiOutputHandlerConfig, type PatternEvent, type ActiveNote } from './midi/MidiOutputHandler';

// Transport
export { TransportController, TransportState, type TransportPosition, type TransportControllerConfig } from './transport/TransportController';

// Main Engine
export { GenSeqEngine, type GenSeqEngineConfig, type EngineStatus } from './GenSeqEngine';
