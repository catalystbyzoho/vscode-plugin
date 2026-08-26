import * as vs from 'vscode';
import _auth from '../auth.js';

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
	{ thisArgs, auth = false }: { thisArgs?: unknown; auth?: boolean } = {}
): Array<vs.Disposable> {
	const commandDisposables: Array<vs.Disposable> = [];
	cmd.forEach(([command, handler]) => {
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
				_handler(...args);
			};
		}
		commandDisposables.push(
			vs.commands.registerCommand('zcatalyst.' + command, handler, thisArgs)
		);
	});
	return commandDisposables;
}
