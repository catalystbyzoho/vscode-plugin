import * as vscode from 'vscode';
import { ICatalystJson } from './util_types/config';

export const refreshEvent = new vscode.EventEmitter<ICatalystJson | undefined>();
