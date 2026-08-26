import { catalystExec, getCatalystRoot, log } from '../catalyst';
import { LogTerminal } from './terminals';

export class PullTerminal {
	private static pullBusy: string | undefined = undefined;

	static async pull(feature: string, _inputs?: Record<string, unknown>) {
		if (PullTerminal.pullBusy) {
			throw new Error(`${this.pullBusy} pull is in progress`);
		}
		const terminal = await LogTerminal.createTerminal('pull');
		const writeToTerminal = (chunk: Buffer) => {
			const logObj = JSON.parse(chunk.toString()) as {
				data: string;
				command: string;
			};
			if (logObj.command === 'pull') {
				// if (logObj.data === '') {
				// 	logObj.data = ' ';
				// }
				terminal?.write(logObj.data);
			}
		};
		terminal
			.on('ready', () => {
				PullTerminal.pullBusy = feature;
				terminal.showTerminal();
				log.on('data', writeToTerminal);
			})
			.on('close', () => {
				PullTerminal.pullBusy = undefined;
				log.removeListener('data', writeToTerminal);
			});

		await terminal.connect();

		const catalystRoot = getCatalystRoot();
		return catalystExec('pull', catalystRoot, catalystRoot, {
			args: [feature.toLowerCase()],
			inputs: {
				confirmation: true,
				..._inputs
			}
		}).finally(() => terminal.closeConnection());
	}
}
