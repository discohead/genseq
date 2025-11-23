/**
 * GenSeq VS Code Extension
 *
 * VS Code integration providing project management, engine control,
 * and real-time diagnostics.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  console.log('GenSeq extension activated');

  // Placeholder - full implementation in Phase 8 (User Story 6)
  const startCommand = vscode.commands.registerCommand('genseq.start', () => {
    vscode.window.showInformationMessage('GenSeq: Start Engine (Coming in Phase 8)');
  });

  const stopCommand = vscode.commands.registerCommand('genseq.stop', () => {
    vscode.window.showInformationMessage('GenSeq: Stop Engine (Coming in Phase 8)');
  });

  context.subscriptions.push(startCommand, stopCommand);
}

export function deactivate(): void {
  console.log('GenSeq extension deactivated');
}
