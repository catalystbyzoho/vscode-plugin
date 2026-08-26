import EventEmitter from 'events';
import { join } from 'path';
import { debug as vsDebug, DebugConfiguration, Uri, window, workspace } from 'vscode';
import { catalystExec, getCatalystRoot, serverEvent, ICatalystResult, log } from '../catalyst';
import { setStatusBarMessage } from '../status-bar';
import { promiseWrapper, timeOut, WrappedPromise } from '../utils';
import { IFnDetail } from '../util_types/config';
import { LogTerminal } from './terminals';
import { getPortPromise } from 'portfinder';
import { CatalystError } from '../error';

class ServeTerminalEvents extends EventEmitter {}

export class ServeTerminal {
	private terminal?: LogTerminal;
	private command: string;

	private static curServePromise: WrappedPromise<ICatalystResult>;

	public static busy = false;

	private ServeTerminalEvents = new ServeTerminalEvents();

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	private constructor(command: string) {
		this.command = command;
	}

	static async initTerminal(command: 'serve' | 'functions:execute' = 'serve') {
		const serveTerminal = new ServeTerminal(command);
		serveTerminal.terminal = await LogTerminal.createTerminal('serve');
		return serveTerminal;
	}

	private async prepareTerminal() {
		if (ServeTerminal.curServePromise && !ServeTerminal.curServePromise.isFulfilled) {
			if (ServeTerminal.busy) {
				throw new Error('Serve Terminal is busy');
			}
			ServeTerminal.busy = true; // marking as busy to kill the prev server
			serverEvent.emit('stop');
			// eslint-disable-next-line no-console
			await ServeTerminal.curServePromise.promise.catch((err) => console.error(err));
			serverEvent.once('start', () => {
				ServeTerminal.busy = false;
			});
		}

		setStatusBarMessage(
			'$(loading~spin) Starting Catalyst Server',
			new Promise((res) => {
				timeOut(30000).then(res);
				serverEvent.once('start', res);
				this.ServeTerminalEvents.once('close', res);
			})
		);

		if (!this.terminal) {
			throw new Error('Terminal property not initialized');
		}
		let stopEmitted = false;
		const writeToTerminal = (chunk: Buffer) => {
			const logObj = JSON.parse(chunk.toString()) as {
				data: string;
				command: string;
			};
			if (logObj.command === this.command) {
				this.terminal?.write(logObj.data);
			}
		};

		this.terminal
			.on('ready', () => {
				this.ServeTerminalEvents.emit('ready');
				this.terminal?.showTerminal();
				log.on('data', writeToTerminal);
			})
			.on('data', (chunk) => {
				if (chunk.toString() === 'SIGINT') {
					if (!stopEmitted) {
						serverEvent.emit('stop');
						stopEmitted = true;
					}
				}
			})
			.on('close', () => {
				this.ServeTerminalEvents.emit('close');
				!stopEmitted && serverEvent.emit('stop');
				log.removeListener('data', writeToTerminal);
			});

		ServeTerminal.busy = true; // mark busy when the terminal is starting
		await this.terminal.connect();

		serverEvent.once('start', () => {
			ServeTerminal.busy = false; // mark not busy when the server is started
		});
		serverEvent.once('stop', () => {
			ServeTerminal.busy = false; // mark not busy when the server is stopped
			stopEmitted = true;
		});
		serverEvent.once('close', () => stopEmitted && this.terminal?.closeConnection());

		if (
			LogTerminal.curProcess?.type === 'deploy' &&
			!LogTerminal.curProcess.promise.isFulfilled
		) {
			throw new Error(
				'Catalyst deploy in progress. Please wait until the deploy process is completed'
			);
		}
		return true;
	}

	async serve(targets: Array<string> = []): Promise<ICatalystResult | void> {
		try {
			await this.prepareTerminal();
		} catch (err) {
			const message = 'Unable to start the Catalyst Server';
			err instanceof Error
				? window.showErrorMessage(message + ': ' + err.message)
				: window.showErrorMessage(message);
			return;
		}

		const catalystRoot = getCatalystRoot();
		if (targets.length === 0) {
			window.showInformationMessage('No http components to serve');
			return;
		}

		const servePromise = catalystExec('serve', catalystRoot, catalystRoot, {
			options: {
				only: targets,
				'no-open': true
			}
		}) as Promise<ICatalystResult>;

		servePromise.finally(() => {
			ServeTerminal.busy = false;
			this.terminal?.closeConnection();
		});

		const wrappedPromise = promiseWrapper(servePromise);

		LogTerminal.curProcess = {
			type: 'serve',
			promise: wrappedPromise
		};

		ServeTerminal.curServePromise = wrappedPromise;
		return servePromise;
	}

	getDebugConfig(target: IFnDetail, port: number): DebugConfiguration {
		const catalystRoot = getCatalystRoot();
		const debugConfiguration = {
			name: target.name,
			request: 'attach',
			type: '' // will be filled later
		} as DebugConfiguration;

		switch (true) {
			case target.stack?.includes('node'): {
				Object.assign(debugConfiguration, {
					type: 'node',
					address: 'localhost',
					port,
					localRoot: target.source,
					remoteRoot: target.source.replace(catalystRoot, join(catalystRoot, '.build'))
				});
				break;
			}
			case target.stack?.includes('java'): {
				Object.assign(debugConfiguration, {
					type: 'java',
					hostName: 'localhost',
					port,
					projectName: target.name,
					sourcePaths: [target.source]
				});
				break;
			}
			case target.stack?.includes('python'): {
				Object.assign(debugConfiguration, {
					type: 'debugpy',
					connect: {
						host: 'localhost',
						port
					},
					pathMappings: [
						{
							localRoot: target.source,
							remoteRoot: target.source.replace(
								catalystRoot,
								join(catalystRoot, '.build')
							)
						}
					]
				});
				break;
			}
			default: {
				throw new CatalystError('unable to detect the function type');
			}
		}

		return debugConfiguration;
	}

	async debugFunction(target: IFnDetail, debug = false) {
		try {
			await this.prepareTerminal();
		} catch (err) {
			const message = 'Unable to start the Catalyst Server';
			err instanceof Error
				? window.showErrorMessage(message + ': ' + err.message)
				: window.showErrorMessage(message);
			return;
		}

		const catalystRoot = getCatalystRoot();

		const folder = workspace.getWorkspaceFolder(Uri.file(target.source));

		const options = {
			only: `functions:${target.name}`
		} as Record<string, string>;

		if (debug) {
			const debugPort = await getPortPromise({
				port: 4026,
				stopPort: 4045
			});

			const debugConfiguration = this.getDebugConfig(target, debugPort);

			const startDebugging = () => {
				vsDebug.startDebugging(folder, debugConfiguration);
			};

			options.debug = `${target.type}:${target.name}:${debugPort}`;
			serverEvent.once('start', startDebugging); // start debugging once when server start
			serverEvent.on('restart', startDebugging); // start debugging on server restarts
			serverEvent.once('stop', () => serverEvent.removeAllListeners('restart')); // remove all listeners on server close
		}

		const servePromise = catalystExec('serve', catalystRoot, catalystRoot, {
			options
		}) as Promise<ICatalystResult>;

		servePromise.finally(() => {
			ServeTerminal.busy = false;
			this.terminal?.closeConnection();
		});

		const wrappedPromise = promiseWrapper(servePromise);

		LogTerminal.curProcess = {
			type: 'serve',
			promise: wrappedPromise
		};

		ServeTerminal.curServePromise = wrappedPromise;
		return servePromise;
	}

	//execute function

	async executeFunction(target: IFnDetail, key?: string, isDebug = false) {
		try {
			await this.prepareTerminal();
		} catch (err) {
			const message = 'Unable to start the Catalyst Server';
			err instanceof Error
				? window.showErrorMessage(message + ': ' + err.message)
				: window.showErrorMessage(message);
			return;
		}

		serverEvent.once('error', () => {
			// this.terminal?.write('Error executing the function: ' + er);
			serverEvent.emit('stop');
		});

		const catalystRoot = getCatalystRoot();

		const folder = workspace.getWorkspaceFolder(Uri.file(target.source));

		const options = {} as Record<string, string>;

		if (key) {
			options.key = key;
		}

		if (isDebug) {
			const debugPort = await getPortPromise({
				port: 4026,
				stopPort: 4045
			});

			const debugConfiguration = this.getDebugConfig(target, debugPort);

			const startDebugging = async () => {
				let debugging = false;
				try {
					debugging = await vsDebug.startDebugging(folder, debugConfiguration);
				} catch (er) {
					// eslint-disable-next-line no-console
					console.log('error starting the debugger: ', er);
				} finally {
					debugging
						? serverEvent.emit('attach')
						: window.showErrorMessage('Unable to start the debugger');
				}
			};

			options.debug = debugPort + '';
			serverEvent.on('connection', startDebugging);
			serverEvent.once('stop', () => {
				serverEvent.removeListener('connection', startDebugging);
				serverEvent.removeAllListeners('error');
			});
		}

		const servePromise = catalystExec('functions:execute', catalystRoot, catalystRoot, {
			options,
			args: [target.name]
		}) as Promise<ICatalystResult>;

		servePromise.finally(() => {
			ServeTerminal.busy = false;
			this.terminal?.closeConnection();
		});

		const wrappedPromise = promiseWrapper(servePromise);

		LogTerminal.curProcess = {
			type: 'serve',
			promise: wrappedPromise
		};

		ServeTerminal.curServePromise = wrappedPromise;
		return servePromise;
	}

	// serve terminal event binders
	on(event: 'ready' | 'close', fn: () => void): this {
		this.ServeTerminalEvents.on(event, fn);
		return this;
	}
}
