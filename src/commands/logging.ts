import { Disposable } from 'vscode';
import { cliVerbose } from '../catalyst';
import { registerCommands } from './utils';

function verboseEnable() {
	cliVerbose(true);
}

function verboseDisable() {
	cliVerbose(false);
}

export default function registerLoggingCommands(): Array<Disposable> {
	const cmdPrefix = 'logs.';
	const logCommands: Array<[string, (...arg: Array<any>) => unknown]> = [
		[cmdPrefix + 'verbose.enable', verboseEnable],
		[cmdPrefix + 'verbose.disable', verboseDisable]
	];
	return registerCommands(logCommands);
}
