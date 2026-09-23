import { createConnection, Socket } from 'net';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { Terminal as vsTerminal, TerminalLocation, ThemeIcon, window, EventEmitter } from 'vscode';
import { getCatalystRoot, ICatalystResult } from '../catalyst';

import { getTrustedNodeExecutable, timeOut, WrappedPromise } from '../utils';
import { getPortPromise } from 'portfinder';

type Terminal = vsTerminal & { port?: number; authToken?: string };
type TLogTerminals = 'serve' | 'deploy' | 'token' | 'pull';

class TerminalFactory {
	private static _serveTerminal: Terminal;
	private static _deployTerminal: Terminal;
	private static _tokenTerminal: Terminal;
	private static _pullTerminal: Terminal;
	// private static _shellTerminal: Terminal;

	private static async createTerminal(name: string, attachAdapter = true): Promise<Terminal> {
		const terminal = window.createTerminal({
			cwd: getCatalystRoot(),
			location: TerminalLocation.Panel,
			name: `Catalyst ${name}`,
			iconPath: new ThemeIcon('home')
		}) as Terminal;
		// Self-disposing listener: releases itself as soon as this terminal closes
		// so listeners do not accumulate across many terminal creations.
		const closeListener = window.onDidCloseTerminal((t) => {
			if (t === terminal) {
				closeListener.dispose();
			}
		});
		if (attachAdapter) {
			terminal.port = await getPortPromise({
				port: 9000,
				stopPort: 9020
			});
			// A random per-connection token so the adapter can reject any
			// other local process that discovers the port and tries to
			// connect (see terminal-adapter.js).
			terminal.authToken = randomBytes(24).toString('hex');
			const nodeBin = await getTrustedNodeExecutable();
			if (!nodeBin) {
				throw new Error(
					'Could not locate a trusted Node.js executable to launch the terminal adapter.'
				);
			}
			const termAdapter = `"${nodeBin}" "${join(
				__dirname,
				'../../res/terminal-adapter.js'
			)}" ${terminal.port} 127.0.0.1 ${terminal.authToken}`;
			terminal.sendText(termAdapter);
		}
		return terminal;
	}

	/**
	 * Drop the cached terminal instance for `type` so the next `getTerminal()`
	 * call creates a fresh terminal/adapter/port/auth-token instead of
	 * reusing this one. Used to avoid caching the Token terminal for reuse
	 * after a credential has been displayed in it.
	 */
	static forgetTerminal(type: TLogTerminals): void {
		switch (type) {
			case 'serve': {
				this._serveTerminal = undefined as unknown as Terminal;
				break;
			}
			case 'deploy': {
				this._deployTerminal = undefined as unknown as Terminal;
				break;
			}
			case 'token': {
				this._tokenTerminal = undefined as unknown as Terminal;
				break;
			}
			case 'pull': {
				this._pullTerminal = undefined as unknown as Terminal;
				break;
			}
		}
	}

	private static async serveTerminal(): Promise<Terminal> {
		if (!this._serveTerminal || this._serveTerminal.exitStatus) {
			this._serveTerminal = await this.createTerminal('Serve');
		}
		return this._serveTerminal;
	}

	private static async deployTerminal(): Promise<Terminal> {
		if (!this._deployTerminal || this._deployTerminal.exitStatus) {
			this._deployTerminal = await this.createTerminal('Deploy');
		}
		return this._deployTerminal;
	}

	private static async tokenTerminal(): Promise<Terminal> {
		if (!this._tokenTerminal || this._tokenTerminal.exitStatus) {
			this._tokenTerminal = await this.createTerminal('Token');
		}
		return this._tokenTerminal;
	}

	private static async pullTerminal(): Promise<Terminal> {
		if (!this._pullTerminal || this._pullTerminal.exitStatus) {
			this._pullTerminal = await this.createTerminal('Pull');
		}
		return this._pullTerminal;
	}

	private static async shellTerminal(): Promise<Terminal> {
		// if(!this._shellTerminal || this._shellTerminal.exitStatus) {
		//     this._shellTerminal = await this.createTerminal('Shell', false);
		// }
		// return this._shellTerminal;
		return this.createTerminal('Shell', false);
	}

	/**
	 * Get a terminal instance.
	 * - For **Log Terminals**, if the terminal process is live it'll be used otherwise a new terminal will be created
	 * - For **Shell Terminals**, a new terminal will be created each time
	 * @param terminal The type of Terminal
	 * @returns An instance of Terminal
	 */
	static async getTerminal(terminal: TLogTerminals): Promise<Terminal> {
		switch (terminal) {
			case 'serve': {
				return this.serveTerminal();
			}
			case 'deploy': {
				return this.deployTerminal();
			}
			case 'token': {
				return this.tokenTerminal();
			}
			case 'pull': {
				return this.pullTerminal();
			}
			default: {
				throw new Error('Unknown terminal type');
			}
		}
	}
}

export class LogTerminal {
	static curProcess?: {
		type: 'serve' | 'deploy' | 'token';
		promise: WrappedPromise<ICatalystResult>;
	};
	private terminal?: Terminal;
	private sockConn?: Socket;
	private type?: TLogTerminals;
	private eventCb = {
		data: new EventEmitter<Buffer>(),
		end: new EventEmitter<void>(),
		error: new EventEmitter<Error | undefined>(),
		ready: new EventEmitter<void>(),
		close: new EventEmitter<void>()
	};

	/**
	 * Write data to the socket
	 */
	write(data: string | Uint8Array) {
		return this.sockConn?.write(data);
	}

	/**
	 * Event emitted when the socket is ready for data transmission
	 */
	on(name: 'ready', cb: () => void): this;
	/**
	 * Event emitted when the socket receives any data
	 */
	on(name: 'data', cb: (data: Buffer) => void): this;
	/**
	 * Emitted when the other end of the socket signals the end of transmission, thus ending the readable side of the socket.
	 * This does not signal the close of a socket.
	 */
	on(name: 'end', cb: () => void): this;
	/**
	 * Emitter when there is an error
	 */
	on(name: 'error', cb: (e?: Error) => void): this;
	/**
	 * Emitted when the socket is fully closed
	 */
	on(name: 'close', cb: () => void): this;
	on(
		name: 'ready' | 'data' | 'end' | 'error' | 'close',
		cb: (...data: Array<any>) => void
	): this {
		this.eventCb[name].event(cb);
		return this;
	}

	#handleEvent(name: string, ...params: Array<any>): void {
		switch (name) {
			case 'data': {
				params[0] && this.eventCb.data.fire(params[0] as Buffer);
				break;
			}
			case 'end': {
				this.eventCb.end.fire();
				break;
			}
			case 'error': {
				params[0] && this.eventCb.error.fire(params[0] as Error);
				break;
			}
			case 'ready': {
				this.eventCb.ready.fire();
				break;
			}
			case 'close': {
				this.eventCb.close.fire();
				break;
			}
		}
	}

	/**
	 * Create a new Log Terminal instance
	 * @param type The type of log terminal to create
	 * @returns
	 */
	static async createTerminal(type: TLogTerminals): Promise<LogTerminal> {
		const _terminal = new LogTerminal();
		_terminal.type = type;
		_terminal.terminal = await TerminalFactory.getTerminal(type);
		return _terminal;
	}

	#maxRetry = 50;
	#retryTimeOut = 200;
	async #connectSocket(port: number, token: string, retry = 0): Promise<Socket> {
		if (retry > this.#maxRetry) {
			throw new Error('Timeout: Unable to communicate with the terminal');
		}

		const sock = createConnection({ port, host: '127.0.0.1' });

		const conn = await new Promise<boolean>((res, rej) => {
			sock.on('connect', () => {
				// Authenticate as the very first bytes on the wire so the
				// adapter can identify and accept this connection before any
				// real terminal data is written to it (see terminal-adapter.js).
				sock.write(`AUTH:${token}\n`);
				res(true);
			});
			sock.on('ready', () => this.#handleEvent('ready'));
			sock.on('error', (err) => {
				const error = err as Error & { code: string };
				if (error.code === 'ECONNREFUSED') {
					return res(false);
				}
				rej(err);
			});
		});

		if (!conn) {
			await timeOut(this.#retryTimeOut);
			return await this.#connectSocket(port, token, ++retry);
		}

		return sock;
	}

	/**
	 * Create a connection between the extension and the terminal adapter
	 *
	 * At a time only one live connection to the terminal adapter will be maintained
	 */
	async connect(): Promise<boolean> {
		if (!this.terminal || !this.terminal.port || !this.terminal.authToken) {
			throw new Error('Invalid Terminal');
		}
		const socket = await this.#connectSocket(this.terminal.port, this.terminal.authToken);
		socket
			.on('data', (buf) => this.#handleEvent('data', buf))
			.on('error', (e) => this.#handleEvent('error', e))
			.on('end', () => this.#handleEvent('end'))
			.on('close', () => {
				LogTerminal.curProcess = undefined;
				this.#handleEvent('close');
			});

		this.sockConn && this.sockConn.destroy(); // destroy previous connection
		this.sockConn = socket;
		return true;
	}

	/**
	 * close the socket connection
	 * @returns
	 */
	closeConnection() {
		return this.sockConn && !this.sockConn.destroyed && this.sockConn.destroy();
	}

	/**
	 * Show the terminal window
	 * @returns
	 */
	showTerminal() {
		return this.terminal && this.terminal.show();
	}

	/**
	 * Hide the terminal window
	 * @returns
	 */
	hideTerminal() {
		return this.terminal && this.terminal.hide();
	}

	/**
	 * Close and dispose the terminal window
	 * @returns
	 */
	closeTerminal() {
		return this.terminal && this.terminal.dispose();
	}

	/**
	 * Dispose the terminal and stop caching it for reuse, so any credential
	 * output it may have displayed (e.g. a generated token) is not retained
	 * in scrollback nor exposed to a later, unrelated session.
	 */
	disposeTerminal() {
		this.closeTerminal();
		if (this.type) {
			TerminalFactory.forgetTerminal(this.type);
		}
	}
}
