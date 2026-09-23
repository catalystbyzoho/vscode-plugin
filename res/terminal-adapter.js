#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

function clearConsole() {
	// eslint-disable-next-line no-console
	console.clear();
}

clearConsole();

const net = require('net');

const events = require('events');

const adapterEvent = new events.EventEmitter();

let connection;

const authToken = process.argv.at(4); // No I18N

function handleData(dataStr) {
	if (dataStr === 'CLRSTD') {
		return clearConsole();
	}
	process.stdout.write(dataStr);
}

const server = net
	.createServer((socket) => {
		// Require every connection to present the per-process auth token as
		// the first line before it is treated as the authenticated terminal
		// connection. This prevents any other local process that discovers
		// the port from hijacking or spoofing terminal output.
		let authBuffer = '';
		let authenticated = false;

		const authTimeout = setTimeout(() => {
			if (!authenticated) {
				socket.destroy();
			}
		}, 5000);

		const onAuthData = (chunk) => {
			authBuffer += chunk.toString();
			const newlineIdx = authBuffer.indexOf('\n');
			if (newlineIdx === -1) {
				// Bound the buffer so a client that never sends a
				// newline-terminated auth frame cannot grow it unboundedly.
				if (authBuffer.length > 256) {
					socket.destroy();
				}
				return;
			}
			const authLine = authBuffer.slice(0, newlineIdx);
			const rest = authBuffer.slice(newlineIdx + 1);
			clearTimeout(authTimeout);
			socket.removeListener('data', onAuthData);

			if (!authToken || authLine !== `AUTH:${authToken}`) {
				// Reject silently: do not disturb any existing authenticated
				// connection and do not reveal why the handshake failed.
				socket.destroy();
				return;
			}

			authenticated = true;
			if (connection && !connection.destroyed) {
				connection.destroy(); // replace the previous authenticated connection
			}
			connection = socket;

			if (rest) {
				handleData(rest);
			}
			socket.on('data', (data) => handleData(data.toString()));

			const sigintListener = () => {
				!socket.destroyed && socket.write('SIGINT');
			};

			socket.on('close', () => {
				adapterEvent.removeListener('SIGINT', sigintListener);
			});

			adapterEvent.on('SIGINT', sigintListener);
		};

		socket.on('data', onAuthData);
	})
	// eslint-disable-next-line no-console
	.on('error', (err) => console.error(err));

process.on('SIGINT', () => {
	adapterEvent.emit('SIGINT');
});

if (!authToken) {
	// eslint-disable-next-line no-console
	console.error('Missing auth token; refusing to start terminal adapter.'); // No I18N
	process.exit(1);
}

const port = parseInt(process.argv.at(2));
if (!Number.isInteger(port) || port < 1 || port > 65535) {
	// eslint-disable-next-line no-console
	console.error('Invalid or missing port argument; refusing to start terminal adapter.'); // No I18N
	process.exit(1);
}
//eslint-disable-line @zoho/zstandard/no-global-function-call
server.listen(port, '127.0.0.1'); // No I18N

