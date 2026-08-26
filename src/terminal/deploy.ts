import { window, EventEmitter } from 'vscode';
import { catalystExec, deployEvent, getCatalystRoot, ICatalystResult, log } from '../catalyst';
import { reloadView } from '../commands/config_view';
import { setStatusBarMessage } from '../status-bar';
import { promiseWrapper } from '../utils';
import { LogTerminal } from './terminals.js';

class DeployQueue {
	private static onCurDeployChange = new EventEmitter<void>();

	private static _curDeploy?: string;
	private static get curDeploy() {
		return DeployQueue._curDeploy;
	}
	private static set curDeploy(val: string | undefined) {
		DeployQueue._curDeploy = val;
		val !== undefined && DeployQueue.onCurDeployChange.fire();
	}

	private static deployQueue: Array<string> = [];

	public static deploying = false;

	static flush() {
		DeployQueue.curDeploy = undefined;
		DeployQueue.deployQueue = [];
	}

	private static async deploy() {
		const catalystRoot = getCatalystRoot();
		const deployOptions = DeployQueue.curDeploy
			? {
					only: DeployQueue.curDeploy
			  }
			: undefined;
		const deployPromise = setStatusBarMessage(
			'$(loading~spin) Deploying',
			catalystExec('deploy', catalystRoot, catalystRoot, {
				options: deployOptions
			})
		) as Promise<ICatalystResult>;

		LogTerminal.curProcess = {
			type: 'deploy',
			promise: promiseWrapper(deployPromise)
		};

		const res = await deployPromise;

		if (res.exitCode === 2) {
			window
				.showErrorMessage(
					'Fatal Error: Unable to deploy.\nSee Catalyst Deploy Terminal for more info',
					'Retry',
					'Cancel'
				)
				.then((val) => {
					switch (val) {
						case 'Retry': {
							DeployQueue.curDeploy = DeployQueue.curDeploy;
							break;
						}
						case 'Cancel': {
							DeployQueue.flush();
						}
					}
				});
			return;
		}

		reloadView();
		DeployQueue.curDeploy = DeployQueue.deployQueue.shift();
	}

	static {
		DeployQueue.onCurDeployChange.event(DeployQueue.deploy);
		deployEvent.on('start', () => {
			DeployQueue.deploying = true;
		});
		deployEvent.on('end', () => {
			DeployQueue.deploying = false;
		});
	}

	static addToQueue(target = '') {
		if (DeployQueue.curDeploy === undefined) {
			DeployQueue.curDeploy = target;
			return;
		}
		DeployQueue.deployQueue.push(target);
	}
}

export class DeployTerminal {
	private static isTerminalAlive = false;
	private static terminal?: LogTerminal;
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	private constructor() {}

	static async initTerminal() {
		if (DeployTerminal.isTerminalAlive) {
			return new DeployTerminal();
		}
		const terminal = await LogTerminal.createTerminal('deploy');
		const writeToTerminal = (chunk: Buffer) => {
			const logObj = JSON.parse(chunk.toString()) as {
				data: string;
				command: string;
			};
			if (logObj.command === 'deploy' && DeployQueue.deploying) {
				terminal?.write(logObj.data);
			}
		};
		terminal
			.on('ready', () => {
				DeployTerminal.isTerminalAlive = true;
				terminal?.showTerminal();
				log.on('data', writeToTerminal);
			})
			.on('close', () => {
				DeployTerminal.isTerminalAlive = false;
				DeployQueue.flush();
				log.removeListener('data', writeToTerminal);
			});
		await terminal.connect();
		DeployTerminal.terminal = terminal;
		return new DeployTerminal();
	}

	async deploy(targets: Array<string> = []): Promise<ICatalystResult | void> {
		if (
			LogTerminal.curProcess?.type === 'serve' &&
			!LogTerminal.curProcess.promise.isFulfilled
		) {
			window.showWarningMessage(
				'Catalyst Serve is in progress. Please terminate the Catalyst servers to continue.'
			);
			return;
		}

		DeployQueue.addToQueue(targets.join(','));
		window.showInformationMessage('Deploy job added to queue.');

		DeployTerminal.isTerminalAlive && DeployTerminal.terminal?.showTerminal();
	}
}
