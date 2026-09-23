import * as vs from 'vscode';
import _auth from '../auth.js';

const UNTRUSTED_WORKSPACE_MESSAGE =
	'This action requires a trusted workspace. Workspace configuration such as ' +
	'lifecycle scripts, plugins, and runtime paths is not executed in untrusted workspaces.';

/**
 * Defense-in-depth trust check to be called directly at a destructive/CLI-invoking
 * operation sink (e.g. inside a webview action handler), in addition to any
 * `registerCommands(..., { trusted: true })` gate applied at command registration.
 *
 * @returns `true` if the workspace is trusted, `false` otherwise (an error message
 * is shown to the user in the untrusted case).
 */
export function requireTrustedWorkspace(): boolean {
	if (!vs.workspace.isTrusted) {
		vs.window.showErrorMessage(UNTRUSTED_WORKSPACE_MESSAGE);
		return false;
	}
	return true;
}

/**
 * Registers the required vscode commands
 *
 * All the commands will be registered under the `zcatalyst` root node. ex: `zcatalyst.functions.open`
 *
 * @param cmd Array of Tuples [command_name, handler_function]
 * @returns Array of Command disposables
 */
export function registerCommands(
	cmd: Array<[string, (...args: Array<unknown>) => unknown]>,
	{
		thisArgs,
		auth = false,
		trusted = false
	}: { thisArgs?: unknown; auth?: boolean; trusted?: boolean } = {}
): Array<vs.Disposable> {
	const commandDisposables: Array<vs.Disposable> = [];
	cmd.forEach(([command, handler]) => {
		if (trusted) {
			const _handler = handler;
			handler = (...args: Array<any>) => {
				if (!vs.workspace.isTrusted) {
					vs.window.showErrorMessage(UNTRUSTED_WORKSPACE_MESSAGE);
					return;
				}
				return _handler(...args);
			};
		}
		if (auth) {
			const _handler = handler;
			handler = (...args: Array<any>) => {
				try {
					_auth();
				} catch (err) {
					// eslint-disable-next-line no-console
					console.log(err);
					return;
				}
				return _handler(...args);
			};
		}
		commandDisposables.push(
			vs.commands.registerCommand('zcatalyst.' + command, handler, thisArgs)
		);
	});
	return commandDisposables;
}
