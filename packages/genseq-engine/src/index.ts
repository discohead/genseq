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
export { MidiInputHandler, type MidiInputDevice, type MidiInputEvent, type CCEvent, type NoteEvent, type PitchBendEvent } from './midi/MidiInputHandler';

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
export {
  MappingEntityLoader,
  MappingEntityValidator,
  type MappingEntity,
  type MappingSource,
  type MappingTarget,
  type TransformConfig,
  type TransformType,
  type CCSource,
  type NoteSource,
  type PitchBendSource,
  type ParameterSource,
  type ParameterTarget,
  type MacroTarget as MappingMacroTarget,
  type SceneTarget
} from './config/entities/MappingEntity';
export {
  MacroEntityLoader,
  MacroEntityValidator,
  type MacroEntity,
  type MacroTarget
} from './config/entities/MacroEntity';

// Patterns
export { PatternExecutor, type PatternExecutorConfig, type ActivePattern } from './patterns/PatternExecutor';

// Mappings
export { InputTransformer } from './mappings/InputTransformer';
export { QuantizedTrigger, type QuantizationMode, type QueuedTrigger, type TriggerScheduledEvent, type TriggerExecutedEvent } from './mappings/QuantizedTrigger';
export { MacroExpander, type MacroExpansionResult, type ExpandedTarget, type ParameterChangeEvent } from './mappings/MacroExpander';
export { MappingRouter, type ParameterChangeEvent as MappingParameterChangeEvent, type SceneTriggerEvent, type MacroExpandedEvent } from './mappings/MappingRouter';

// MIDI Routing
export { BusRouter, type BusRouterConfig, type RoutedMessage } from './midi/BusRouter';
export { MidiOutputHandler, type MidiOutputHandlerConfig, type PatternEvent, type ActiveNote } from './midi/MidiOutputHandler';

// Transport
export { TransportController, TransportState, type TransportPosition, type TransportControllerConfig } from './transport/TransportController';

// Main Engine
export { GenSeqEngine, type GenSeqEngineConfig, type EngineStatus } from './GenSeqEngine';
