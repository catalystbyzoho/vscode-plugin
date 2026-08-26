import { Disposable } from 'vscode';
import Inputs from '../inputs';
import { statusBarWithProgress } from '../status-bar';
import { refreshTreeView, timeOut, writeJsonFile } from '../utils';
import { ICatalystJson } from '../util_types/config';
import { registerCommands } from './utils.js';

async function updateApig(catalystJsonPath: string, catalystJson: ICatalystJson) {
	if (!catalystJson.apig) {
		throw new Error('Unable to get the catalyst json');
	}
	const apigConfig = catalystJson.apig;
	const apigStatusInput = Inputs.confirmQuestion(
		'apigStatus',
		'Change APIG status',
		`Do you wish to ${apigConfig.enabled ? 'DISABLE' : 'ENABLE'} the APIG status`
	);
	const res = await apigStatusInput.getInputs();

	if (res.apigStatus) {
		catalystJson.apig.enabled = apigConfig.enabled ? false : true;

		await statusBarWithProgress(
			'$(sync~spin) updating APIG status...',
			'APIG',
			async (progress, cancelTkn) => {
				return new Promise<void>(async (res, rej) => {
					if (!cancelTkn.isCancellationRequested) {
						cancelTkn.onCancellationRequested(() => rej('cancelled'));
					}
					progress.report({ message: 'Updating status' });
					await timeOut(2000);
					writeJsonFile(catalystJsonPath, catalystJson);
					res();
				});
			}
		);

		refreshTreeView({ catalystJson });
	}
}

export default function registerStatusCommands(): Array<Disposable> {
	const cmdPrefix = 'status.';
	const statusCommands: Array<[string, (...args: Array<any>) => unknown]> = [
		[cmdPrefix + 'apig', updateApig]
	];
	return registerCommands(statusCommands, { auth: true });
}
