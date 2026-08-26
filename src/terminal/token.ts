import { window } from 'vscode';
import { catalystExec, log } from '../catalyst';
import { getWorkSpaceRoot } from '../utils';
import { LogTerminal } from './terminals';

export class TokenTerminal {
	public static isBusy = false;

	static async generateToken() {
		return new Promise<void>(async (res, rej) => {
			if (TokenTerminal.isBusy) {
				window.showErrorMessage('Token generation already in progress please wait.');
				res();
				return;
			}
			const terminal = await LogTerminal.createTerminal('token');
			const writeToTerminal = (chunk: Buffer) => {
				const logObj = JSON.parse(chunk.toString()) as {
					data: string;
					command: string;
				};
				if (logObj.command === 'token:generate') {
					// if (logObj.data === '') {
					// 	logObj.data = ' ';
					// }
					terminal?.write(logObj.data);
				}
			};
			terminal
				.on('ready', () => {
					TokenTerminal.isBusy = true;
					terminal.showTerminal();
					terminal?.write('CLRSTD');
					log.on('data', writeToTerminal);
				})
				.on('close', () => {
					TokenTerminal.isBusy = false;
					log.removeListener('data', writeToTerminal);
					res();
				})
				.on('error', (err) => {
					rej(err);
				});
			await terminal.connect();

			const workspaceRoot = getWorkSpaceRoot();
			const tkGenRes = await catalystExec(
				'token:generate',
				workspaceRoot,
				workspaceRoot
			).finally(() => terminal.closeConnection());

			if (tkGenRes.exitCode === 2 || tkGenRes.error) {
				rej(tkGenRes.error);
				return;
			}
			res();
		});
	}
}
