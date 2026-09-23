import { Disposable, window } from 'vscode';
import { catalystExec, getCatalystRoot } from '../catalyst';
import Inputs from '../inputs';
import { LogTerminal } from '../terminal/terminals';
import { refreshTreeView } from '../utils';
import { IClientDetail, IFnDetail } from '../util_types/config';
import { registerCommands } from './utils';
import { setStatusBarMessage } from '../status-bar';

async function deleteFunction(fnDetail: IFnDetail) {
	if (LogTerminal.curProcess && !LogTerminal.curProcess.promise.isFulfilled) {
		const catalystProcess = LogTerminal.curProcess?.type === 'deploy' ? 'deploy' : 'serve';
		window.showErrorMessage(
			`Catalyst ${catalystProcess} in progress. Please wait until the ${catalystProcess} process is completed.`
		);
		return;
	}
	const deleteInput = await Inputs.confirmQuestion(
		'deleteFn',
		'Delete Function',
		`Do you want to delete ${fnDetail.name} function? `
	).getInputs();

	if (deleteInput.deleteFn) {
		try {
			const catalystRoot = getCatalystRoot();

			const deleteRes = await setStatusBarMessage(
				'$(loading~spin) Deleting function...',
				catalystExec('functions:delete', catalystRoot, catalystRoot, {
					args: [fnDetail.name],
					options: {
						local: true
					},
					inputs: {
						consent: true
					}
				})
			);

			if (deleteRes.exitCode === 2 || deleteRes.error) {
				throw deleteRes.error;
			}
			window.showInformationMessage(`Function ${fnDetail.name} is successfully deleted`);
			refreshTreeView();
		} catch (err) {
			window.showErrorMessage(
				`Unable to delete the function.${
					err instanceof Error ? ' Reason: ' + err.message : ''
				}`
			);
		}
	}
}

async function deleteClient(clientDetail: IClientDetail) {
	if (LogTerminal.curProcess && !LogTerminal.curProcess?.promise.isFulfilled) {
		const catalystProcess = LogTerminal.curProcess?.type === 'deploy' ? 'deploy' : 'serve';
		window.showErrorMessage(
			`Catalyst ${catalystProcess} in progress. Please wait until the ${catalystProcess} process is completed.`
		);
		return;
	}
	const deleteInput = await Inputs.confirmQuestion(
		'deleteClient',
		'Delete Client',
		`Do you want to delete ${clientDetail.name}(v${clientDetail.version}) Web Client? `
	).getInputs();

	if (deleteInput.deleteClient) {
		try {
			const catalystRoot = getCatalystRoot();
			const deleteRes = await catalystExec('client:delete', catalystRoot, catalystRoot, {
				options: {
					local: true
				},
				inputs: {
					consent: true
				}
			});

			if (deleteRes.exitCode === 2 || deleteRes.error) {
				throw deleteRes.error;
			}

			window.showInformationMessage(`Client ${clientDetail.name} is successfully deleted`);
			refreshTreeView();
		} catch (err) {
			window.showErrorMessage(
				`Unable to delete the client.${
					err instanceof Error ? ' Reason: ' + err.message : ''
				}`
			);
		}
	}
}

export default function registerDeleteCommands(): Array<Disposable> {
	const cmdPrefix = 'delete.';
	const deleteCommands: Array<[string, (...arg: Array<any>) => unknown]> = [
		[cmdPrefix + 'function', deleteFunction],
		[cmdPrefix + 'client', deleteClient]
	];
	return registerCommands(deleteCommands, { auth: true, trusted: true });
}
