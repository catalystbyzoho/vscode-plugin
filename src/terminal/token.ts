import { window } from 'vscode';
import { catalystExec, log } from '../catalyst';
import { getWorkSpaceRoot, parseCliLogChunk, timeOut } from '../utils';
import { LogTerminal } from './terminals';

export class TokenTerminal {
	public static isBusy = false;

	static async generateToken() {
		if (TokenTerminal.isBusy) {
			window.showErrorMessage('Token generation already in progress please wait.');
			return;
		}
		const terminal = await LogTerminal.createTerminal('token');
		const writeToTerminal = (chunk: Buffer) => {
			const logObj = parseCliLogChunk(chunk);
			if (logObj && logObj.command === 'token:generate') {
				terminal.write(logObj.data);
			}
		};

		// Wait for the terminal connection to be ready before proceeding.
		const readyPromise = new Promise<void>((res, rej) => {
			terminal
				.on('ready', () => {
					TokenTerminal.isBusy = true;
					terminal.showTerminal();
					terminal.write('CLRSTD');
					log.on('data', writeToTerminal);
					res();
				})
				.on('error', (err) => {
					rej(err);
				});
		});

		try {
			await terminal.connect();
			await readyPromise;

			const workspaceRoot = getWorkSpaceRoot();
			const tkGenRes = await catalystExec(
				'token:generate',
				workspaceRoot,
				workspaceRoot
			).finally(async () => {
				// Clear the visible screen immediately (while still connected)
				// so no credential output lingers, then dispose the terminal
				// shortly after to avoid an abrupt UI transition.
				// Accepted residual risk: VS Code does not expose an API to
				// erase terminal scrollback. CLRSTD only clears the visible
				// viewport; scrollback may be retained by capture extensions
				// or screenshots taken during the generation window.
				terminal.write('CLRSTD');
				await timeOut(2000);
				terminal.closeConnection();
				terminal.disposeTerminal();
			});

			if (tkGenRes.exitCode === 2 || tkGenRes.error) {
				throw tkGenRes.error;
			}
		} finally {
			TokenTerminal.isBusy = false;
			log.removeListener('data', writeToTerminal);
		}
	}
}
