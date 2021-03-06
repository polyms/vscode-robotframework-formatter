// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RobotFormatProvider } from './provider/format-provider/RobotFormatProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(
  // context: vscode.ExtensionContext
) {
  vscode.languages.registerDocumentFormattingEditProvider(
    'robotframework', new RobotFormatProvider(),
  );
}

// this method is called when your extension is deactivated
export function deactivate() { }
