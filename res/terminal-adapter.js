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

const server = net
	.createServer((socket) => {
		if (connection && !connection.destroyed) {
			connection.destroy(); // destroy old connection
		}
		connection = socket;

		socket.on('data', (data) => {
			const dataStr = data.toString();
			if (dataStr === 'CLRSTD') {
				return clearConsole();
			}
			process.stdout.write(dataStr);
		});

		const sigintListener = () => {
			!socket.destroyed && socket.write('SIGINT');
		};

		socket.on('close', () => {
			adapterEvent.removeListener('SIGINT', sigintListener);
		});

		adapterEvent.on('SIGINT', sigintListener);
	})
	// eslint-disable-next-line no-console
	.on('error', (err) => console.error(err));

process.on('SIGINT', () => {
	adapterEvent.emit('SIGINT');
});

//eslint-disable-line @zoho/zstandard/no-global-function-call
server.listen(parseInt(process.argv.at(2)), process.argv.at(3));
