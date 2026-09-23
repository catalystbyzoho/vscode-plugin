import { readFile } from 'fs/promises';
import { join } from 'path';
import { commands, ViewColumn, WebviewPanel, window, Uri, EventEmitter, Disposable } from 'vscode';

import auth from '../../auth';
import { getCatalystRoot, getUserDetails } from '../../catalyst/index.js';
import { SCOPE } from '../../constants';
import { TokenTerminal } from '../../terminal/token';
import { registerCommands } from '../utils';
import actionsHandler, { getAllViewDetails } from './actions-handler.js';

export enum EViewOptions {
	reload = 1
}

const configViewEvent = new EventEmitter<EViewOptions>();

export function reloadView() {
	configViewEvent.fire(EViewOptions.reload);
}

export let panel: WebviewPanel | undefined = undefined;

export async function openView() {
	try {
		getCatalystRoot();
	} catch (err) {
		window.showErrorMessage('Not in a Catalyst app directory.');
		return;
	}
	getUserDetails() || (await commands.executeCommand('zcatalyst.auth.login'));

	try {
		auth([
			SCOPE.projects,
			SCOPE.functions,
			SCOPE.appsail_read,
			SCOPE.webapp,
			SCOPE.contacts_read,
			SCOPE.apig_read,
			SCOPE.api_read
		]);
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return;
	}

	if (TokenTerminal.isBusy) {
		window.showInformationMessage(
			'Token generation in progress. Please complete the process either by generating a token or closing the Catalyst Token terminal to continue.'
		);
		return;
	}
	if (!panel) {
		panel = window.createWebviewPanel('catalystConfig', 'Catalyst', ViewColumn.Active, {
			localResourceRoots: [Uri.file(join(__dirname, '../../../res/config_view/'))],
			enableScripts: true
		});
	} else {
		panel.reveal();
		return;
	}

	setHtml(panel);
	panel.webview.onDidReceiveMessage(async (data: Record<string, unknown>) => {
		if (data.message) {
			const message = data.message as { type?: 'info' | 'warn' | 'err'; text: string };
			switch (message.type) {
				case 'warn': {
					window.showWarningMessage(message.text);
					break;
				}
				case 'err': {
					window.showErrorMessage(message.text);
					break;
				}
				default: {
					window.showInformationMessage(message.text);
				}
			}
			return;
		}

		if (data.action && panel) {
			await actionsHandler(panel, data.action as { name: string; data: unknown });
		}
	});

	panel.onDidDispose(() => {
		panel = undefined;
	});

	try {
		await getAllViewDetails(panel);
	} catch (er) {
		panel?.dispose();
		throw new Error(
			'Unable to fetch the details for the Project View.\nReason: ' +
				(er instanceof Error ? er.message : er)
		);
	}

	if (!panel) {
		return; // return if there's any when getting view details
	}

	panel.onDidChangeViewState(() => {
		panel?.active && panel.webview.postMessage({});
	});

	configViewEvent.event((opt) => {
		panel && opt === EViewOptions.reload && getAllViewDetails(panel);
	});
}

async function setHtml(panel: WebviewPanel): Promise<string> {
	const htmlFile = join(__dirname, '../../../res/config_view/configs.html');
	const htmlStr = await readFile(htmlFile, 'utf-8');
	const replaceContext = [
		{
			context: panel.webview
				.asWebviewUri(Uri.file(join(__dirname, '../../../res/config_view/js/main.js')))
				.toString(),
			key: '{{main_js}}'
		},
		{
			context: panel.webview
				.asWebviewUri(Uri.file(join(__dirname, '../../../res/config_view/js/select.js')))
				.toString(),
			key: '{{select_js}}'
		},
		{
			context: panel.webview
				.asWebviewUri(Uri.file(join(__dirname, '../../../res/config_view/js/configs.js')))
				.toString(),
			key: '{{configs_js}}'
		},
		{
			context: panel.webview
				.asWebviewUri(Uri.file(join(__dirname, '../../../res/config_view/js/security.js')))
				.toString(),
			key: '{{security_js}}'
		},
		{
			// vendored locally (no longer loaded from unpkg) to remove the
			// mutable-remote-script webview supply-chain risk
			context: panel.webview
				.asWebviewUri(
					Uri.file(
						join(__dirname, '../../../res/config_view/js/vendor/popper.min.js')
					)
				)
				.toString(),
			key: '{{popper_js}}'
		},
		{
			context: panel.webview
				.asWebviewUri(
					Uri.file(
						join(
							__dirname,
							'../../../res/config_view/js/vendor/tippy-bundle.iife.min.js'
						)
					)
				)
				.toString(),
			key: '{{tippy_js}}'
		},
		{
			context: panel.webview
				.asWebviewUri(Uri.file(join(__dirname, '../../../res/config_view/css/main.css')))
				.toString(),
			key: '{{main_css}}'
		},
		{
			context: panel.webview
				.asWebviewUri(Uri.file(join(__dirname, '../../../res/config_view/css/select.css')))
				.toString(),
			key: '{{select_css}}'
		},
		{
			context: panel.webview
				.asWebviewUri(
					Uri.file(join(__dirname, '../../../res/config_view/css/utility-classes.css'))
				)
				.toString(),
			key: '{{utility_css}}'
		},
		{
			context: panel.webview
				.asWebviewUri(Uri.file(join(__dirname, '../../../res/config_view/css/icons.css')))
				.toString(),
			key: '{{icons_css}}'
		},
		{
			context: panel.webview
				.asWebviewUri(
					Uri.file(join(__dirname, '../../../res/config_view/css/custom-fonts.css'))
				)
				.toString(),
			key: '{{custom_font_css}}'
		}
	];

	const preparedHtml = replaceContext.reduce((acc, rep) => {
		return acc.replace(rep.key, rep.context);
	}, htmlStr);
	panel.webview.html = preparedHtml;
	return htmlStr;
}

export function registerConfigCommand(): Array<Disposable> {
	const cmdPrefix = 'config';
	const configViewCommands: Array<[string, (...arg: Array<unknown>) => unknown]> = [
		[cmdPrefix, openView],
		[cmdPrefix + '.reload', reloadView]
	];
	return registerCommands(configViewCommands, { trusted: true });
}
