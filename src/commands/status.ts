import { Disposable, workspace } from 'vscode';
import Inputs from '../inputs';
import { statusBarWithProgress } from '../status-bar';
import { refreshTreeView, resolveSafePath, timeOut, writeJsonFile } from '../utils';
import { getCatalystRoot } from '../catalyst';
import { ICatalystJson } from '../util_types/config';
import { FILENAMES } from '../constants';
import { registerCommands } from './utils.js';

async function updateApig(catalystJsonPath: string, catalystJson: ICatalystJson) {
	if (!workspace.isTrusted) {
		throw new Error(
			'This action requires a trusted workspace. Workspace configuration is not ' +
				'written to disk in untrusted workspaces.'
		);
	}
	if (!catalystJson.apig) {
		throw new Error('Unable to get the catalyst json');
	}
	// Defense in depth: only ever write to the current Catalyst root's
	// catalyst.json, regardless of what path the caller supplied.
	const expectedPath = await resolveSafePath(getCatalystRoot(), FILENAMES.CATALYST_JSON);
	if (catalystJsonPath !== expectedPath) {
		throw new Error('Unexpected catalyst.json path for APIG status update');
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
				if (cancelTkn.isCancellationRequested) {
					return;
				}
				progress.report({ message: 'Updating status' });
				await timeOut(2000);
				if (!cancelTkn.isCancellationRequested) {
					await writeJsonFile(catalystJsonPath, catalystJson);
				}
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
	return registerCommands(statusCommands, { auth: true, trusted: true });
}
