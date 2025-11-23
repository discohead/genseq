/**
 * GenSeq VS Code Extension API Contract
 * VS Code integration for GenSeq MIDI Sequencer
 */

import * as vscode from 'vscode';
import { GenSeqEngine, EngineStatus, ValidationError, MidiDevice } from './genseq-engine.api';

// ============================================================================
// Extension Activation
// ============================================================================

export function activate(context: vscode.ExtensionContext): void;
export function deactivate(): void;

// ============================================================================
// Engine Manager
// ============================================================================

export class EngineManager {
  constructor(context: vscode.ExtensionContext);

  // Engine lifecycle
  startEngine(projectPath: string): Promise<void>;
  stopEngine(): Promise<void>;
  restartEngine(): Promise<void>;
  isRunning(): boolean;
  getEngine(): GenSeqEngine | undefined;

  // Project management
  loadProject(projectPath: string): Promise<void>;
  validateProject(projectPath: string): Promise<ValidationError[]>;
  getCurrentProject(): string | undefined;

  // Status
  getStatus(): EngineStatus | undefined;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}

// ============================================================================
// Tree Data Providers
// ============================================================================

export class PatternTreeProvider implements vscode.TreeDataProvider<PatternItem> {
  constructor(engineManager: EngineManager);

  getTreeItem(element: PatternItem): vscode.TreeItem;
  getChildren(element?: PatternItem): Thenable<PatternItem[]>;
  refresh(): void;

  private _onDidChangeTreeData: vscode.EventEmitter<PatternItem | undefined | null | void>;
  readonly onDidChangeTreeData: vscode.Event<PatternItem | undefined | null | void>;
}

export class PatternItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly type: string,
    public readonly enabled: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  );

  contextValue = 'pattern';
}

export class SceneTreeProvider implements vscode.TreeDataProvider<SceneItem> {
  constructor(engineManager: EngineManager);

  getTreeItem(element: SceneItem): vscode.TreeItem;
  getChildren(element?: SceneItem): Thenable<SceneItem[]>;
  refresh(): void;
  setCurrentScene(sceneId: string): void;

  private _onDidChangeTreeData: vscode.EventEmitter<SceneItem | undefined | null | void>;
  readonly onDidChangeTreeData: vscode.Event<SceneItem | undefined | null | void>;
}

export class SceneItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly isActive: boolean,
    public readonly patternCount: number
  );

  contextValue = 'scene';
}

export class DeviceTreeProvider implements vscode.TreeDataProvider<DeviceItem> {
  constructor(engineManager: EngineManager);

  getTreeItem(element: DeviceItem): vscode.TreeItem;
  getChildren(element?: DeviceItem): Thenable<DeviceItem[]>;
  refresh(): void;

  private _onDidChangeTreeData: vscode.EventEmitter<DeviceItem | undefined | null | void>;
  readonly onDidChangeTreeData: vscode.Event<DeviceItem | undefined | null | void>;
}

export class DeviceItem extends vscode.TreeItem {
  constructor(
    public readonly device: MidiDevice,
    public readonly type: 'input' | 'output'
  );

  contextValue = 'midiDevice';
}

// ============================================================================
// Diagnostics Provider
// ============================================================================

export class DiagnosticsProvider {
  constructor(engineManager: EngineManager);

  // Validation
  validateDocument(document: vscode.TextDocument): Promise<vscode.Diagnostic[]>;
  validateWorkspace(): Promise<Map<string, vscode.Diagnostic[]>>;

  // Diagnostic management
  updateDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): void;
  clearDiagnostics(uri?: vscode.Uri): void;
  getDiagnosticCollection(): vscode.DiagnosticCollection;

  // Real-time validation
  enableRealtimeValidation(): void;
  disableRealtimeValidation(): void;
  isRealtimeValidationEnabled(): boolean;
}

// ============================================================================
// Status Bar
// ============================================================================

export class StatusBarManager {
  constructor(engineManager: EngineManager);

  // Status items
  createTransportStatus(): vscode.StatusBarItem;
  createBpmStatus(): vscode.StatusBarItem;
  createSceneStatus(): vscode.StatusBarItem;
  createPatternStatus(): vscode.StatusBarItem;

  // Updates
  updateTransport(playing: boolean): void;
  updateBpm(bpm: number): void;
  updateScene(sceneName: string): void;
  updatePatterns(activeCount: number, totalCount: number): void;

  // Visibility
  show(): void;
  hide(): void;
  dispose(): void;
}

// ============================================================================
// Commands
// ============================================================================

export interface GenSeqCommands {
  // Transport
  'genseq.start': () => Promise<void>;
  'genseq.stop': () => Promise<void>;
  'genseq.continue': () => Promise<void>;
  'genseq.tapTempo': () => void;

  // Scenes
  'genseq.loadScene': (sceneId?: string) => Promise<void>;
  'genseq.nextScene': () => Promise<void>;
  'genseq.previousScene': () => Promise<void>;

  // Patterns
  'genseq.enablePattern': (patternId: string) => void;
  'genseq.disablePattern': (patternId: string) => void;
  'genseq.togglePattern': (patternId: string) => void;
  'genseq.editPattern': (patternId: string) => Promise<void>;

  // Configuration
  'genseq.reloadConfig': () => Promise<void>;
  'genseq.validateConfig': () => Promise<void>;
  'genseq.openProjectSettings': () => Promise<void>;

  // Devices
  'genseq.refreshDevices': () => Promise<void>;
  'genseq.showDeviceInfo': (deviceId: string) => void;

  // Project
  'genseq.newProject': () => Promise<void>;
  'genseq.openProject': () => Promise<void>;
  'genseq.closeProject': () => Promise<void>;

  // Views
  'genseq.showPatternVisualizer': () => Promise<void>;
  'genseq.showMidiMonitor': () => Promise<void>;
  'genseq.showPerformanceMetrics': () => Promise<void>;
}

export function registerCommands(context: vscode.ExtensionContext, engineManager: EngineManager): void;

// ============================================================================
// Webview Providers
// ============================================================================

export class PatternVisualizerProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private engineManager: EngineManager
  );

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void;

  updatePattern(patternId: string, data: any): void;
  updatePosition(position: any): void;
}

export class MidiMonitorProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private engineManager: EngineManager
  );

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void;

  addMidiMessage(device: string, message: number[], direction: 'in' | 'out'): void;
  clear(): void;
}

export class PerformanceMonitorProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private engineManager: EngineManager
  );

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void;

  updateMetrics(metrics: any): void;
}

// ============================================================================
// Configuration
// ============================================================================

export interface GenSeqConfiguration {
  // Engine settings
  'genseq.engine.autoStart': boolean;
  'genseq.engine.maxPatterns': number;
  'genseq.engine.maxCpuPercent': number;
  'genseq.engine.performanceTracking': boolean;

  // Editor settings
  'genseq.editor.validateOnSave': boolean;
  'genseq.editor.validateOnType': boolean;
  'genseq.editor.showInlineErrors': boolean;
  'genseq.editor.formatOnSave': boolean;

  // MIDI settings
  'genseq.midi.debug': boolean;
  'genseq.midi.defaultInputDevice': string;
  'genseq.midi.defaultOutputDevice': string;
  'genseq.midi.virtualPortName': string;

  // UI settings
  'genseq.ui.showStatusBar': boolean;
  'genseq.ui.showMidiActivity': boolean;
  'genseq.ui.patternColors': boolean;
  'genseq.ui.theme': 'dark' | 'light' | 'auto';
}

export function getConfiguration<T extends keyof GenSeqConfiguration>(
  key: T
): GenSeqConfiguration[T];

export function updateConfiguration<T extends keyof GenSeqConfiguration>(
  key: T,
  value: GenSeqConfiguration[T],
  target?: vscode.ConfigurationTarget
): Promise<void>;

// ============================================================================
// Language Server
// ============================================================================

export class GenSeqLanguageClient {
  constructor(context: vscode.ExtensionContext);

  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;

  // Document validation
  validateDocument(uri: vscode.Uri): Promise<ValidationError[]>;

  // Completions
  provideCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]>;

  // Hover
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | null>;

  // Code actions
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): Promise<vscode.CodeAction[]>;
}

// ============================================================================
// File System Watcher
// ============================================================================

export class ProjectWatcher {
  constructor(
    projectPath: string,
    engineManager: EngineManager
  );

  // Watch management
  start(): void;
  stop(): void;
  isWatching(): boolean;

  // File events
  onFileCreated(handler: (uri: vscode.Uri) => void): vscode.Disposable;
  onFileChanged(handler: (uri: vscode.Uri) => void): vscode.Disposable;
  onFileDeleted(handler: (uri: vscode.Uri) => void): vscode.Disposable;

  // Pattern matching
  watchPatterns(patterns: string[]): void;
  unwatchPatterns(patterns: string[]): void;
}

// ============================================================================
// Telemetry
// ============================================================================

export class TelemetryReporter {
  constructor(
    extensionId: string,
    extensionVersion: string,
    key: string
  );

  // Event tracking
  sendTelemetryEvent(
    eventName: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>
  ): void;

  // Error tracking
  sendTelemetryErrorEvent(
    eventName: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
    errorProps?: string[]
  ): void;

  // Performance tracking
  trackPerformance(
    eventName: string,
    startTime: number,
    properties?: Record<string, string>
  ): void;

  dispose(): void;
}