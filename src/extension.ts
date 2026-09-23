process.env.ZCATALYST_VSCODE = 'true';

import * as vscode from 'vscode';
import { join } from 'path';
import { runtime, refreshTreeView, readJsonFile, setContext, getTrustedNodeExecutable } from './utils.js';
import { CatalystJsonCodeLensProvider } from './code-lens.js';
import { registerInitCommands } from './commands/init/index.js';
import registerDeployCommands from './commands/deploy.js';
import registerDeleteCommands from './commands/delete.js';
import registerServeCommands from './commands/serve.js';
import registerStatusCommands from './commands/status.js';
import { cliRuntime, findCatalystRoot, getCatalystJson } from './catalyst/index.js';
import { registerConfigCommand } from './commands/config_view/index.js';
import { FILENAMES } from './constants.js';
import CatalystTreeView from './tree_view/index.js';
import { rcEvent } from './catalyst/project.js';
import registerAuthCommands from './commands/auth.js';
import registerLoggingCommands from './commands/logging.js';
import initializeSettings from './settings.js';
import auth from './auth.js';
import { displayNoFolderView } from './tree_view/utils.js';

const SUPPORTED_NODE_STACKS = ['node12', 'node14', 'node16', 'node18', 'node20'];

/**
 * Hand the CLI a trusted, absolute Node runtime through its own supported
 * `executables.<version>.bin` config channel (the same mechanism used for
 * explicit user-configured runtime paths in `settings.ts`), instead of
 * mutating the shared, global `process.execPath`.
 */
async function registerHostNodeRuntime(): Promise<void> {
	const nodeVersion = 'node' + process.versions.node.split('.')[0];
	if (!SUPPORTED_NODE_STACKS.includes(nodeVersion)) {
		return;
	}
	// Do not override an explicit user-configured runtime path for this version.
	if (cliRuntime.get(`executables.${nodeVersion}.bin`)) {
		return;
	}
	const hostNodeBin = await getTrustedNodeExecutable();
	if (hostNodeBin) {
		cliRuntime.set(`executables.${nodeVersion}.bin`, hostNodeBin);
	}
}

export async function activate(context: vscode.ExtensionContext) {
	try {
		// try {
		// 	await ensureNode();
		// } catch (err) {
		// 	await setContext('viewWelcome.view', 'NoNode');
		// 	throw err;
		// }

		const disposables: Array<vscode.Disposable> = [];
		//register commands - 1
		disposables.push(...registerAuthCommands());
		disposables.push(...registerLoggingCommands());
		disposables.push(...registerConfigCommand());

		// initialize settings
		disposables.push(...initializeSettings());

		// resolve a trusted, absolute Node runtime for the CLI without
		// mutating the global process.execPath (see registerHostNodeRuntime)
		await registerHostNodeRuntime();

		// enable view welcome buttons
		await setContext('viewWelcome.enable', true);
		await setContext('viewWelcome.httpFunctions.enable', true);
		await setContext('viewWelcome.nonHttpFunctions.enable', true);
		await setContext('viewWelcome.appSail.enable', true);
		await setContext('viewWelcome.client.enable', true);

		//find the catalyst root of the project
		// eslint-disable-next-line no-console
		const catalystRoot = await findCatalystRoot().catch((err) => console.error(err));
		if (!catalystRoot) {
			await CatalystTreeView.constructTreeViews('');
			await displayNoFolderView();
			return;
		}

		runtime.set('catalyst.root', catalystRoot); // set catalyst root to runtime

		const packageJson = await readJsonFile<Record<string, unknown>>(
			join(__dirname, '../package.json')
		);
		packageJson && cliRuntime.set('cli.userAgents', `CatalystVsCode/${packageJson.version}`);

		// get catalyst json
		let user = false;
		const catalystJson = await (async () => {
			try {
				auth([], { showError: false });
				user = true;
			} catch (err) {
				if (
					err instanceof Error &&
					err.message.includes('Command requires authentication')
				) {
					const initRes = await vscode.window.showInformationMessage(
						'Please Login to your Catalyst Account to continue',
						'Login'
					);
					if (initRes === 'Login') {
						const currentUser = await vscode.commands.executeCommand(
							'zcatalyst.auth.login'
						);
						if (currentUser) {
							user = true;
						}
					}
				}
			}
			const json = await getCatalystJson({ catalystRoot, refresh: true });
			if (json) {
				return json;
			}
			if (!user) {
				return;
			}
			vscode.window
				.showInformationMessage(
					'Unable to read the catalyst.json file. Please initialize to continue.',
					'Initialize'
				)
				.then((init) => {
					if (init) {
						return vscode.commands.executeCommand('zcatalyst.init.init');
					}
				});
		})();

		// construct the tree views
		const viewDisposables = await CatalystTreeView.constructTreeViews(
			catalystRoot,
			catalystJson
		);

		if (!user) {
			CatalystTreeView.setViewMessage('Please Login to your Catalyst account to continue', {
				clearView: true
			});
			await setContext('viewWelcome.view', 'login');
		} else if (!catalystJson) {
			CatalystTreeView.setViewMessage('Please initialize a Catalyst Project to continue.', {
				clearView: true
			});
			await setContext('viewWelcome.view', 'init');
		} else {
			await setContext('viewWelcome.view', 'all');
		}

		// register commands - 2
		disposables.push(...registerInitCommands());
		disposables.push(...registerDeployCommands());
		disposables.push(...registerServeCommands());
		disposables.push(...registerDeleteCommands());
		disposables.push(...registerStatusCommands());

		// Refresh all tree views on save of catalyst.json

		disposables.push(
			vscode.workspace.onDidSaveTextDocument((doc) => {
				switch (true) {
					case doc.fileName.includes(FILENAMES.APP_CONFIG_JSON):
					case doc.fileName.includes(FILENAMES.CLIENT_PACKAGE_JSON):
					case doc.fileName.includes(FILENAMES.CATALYST_CONFIG_JSON): {
						refreshTreeView();
						break;
					}
					case doc.fileName.includes(FILENAMES.CATALYST_JSON): {
						try {
							refreshTreeView({ catalystJson: JSON.parse(doc.getText()) });
						} catch (err) {
							// eslint-disable-next-line no-console
							console.error('Invalid catalyst.json file: ' + err);
						}
						break;
					}
					case doc.fileName.includes(FILENAMES.CATALYST_RC): {
						try {
							rcEvent.fire(JSON.parse(doc.getText()));
						} catch (err) {
							// eslint-disable-next-line no-console
							console.error('Invalid .catalystrc file: ' + err);
						}
						break;
					}
				}
			})
		);

		// register code lens provider

		disposables.push(
			vscode.languages.registerCodeLensProvider(
				{ language: 'json', scheme: 'file', pattern: '**/catalyst.json' },
				new CatalystJsonCodeLensProvider()
			)
		);

		// add the necessary elements to dispose
		context.subscriptions.push(...disposables, ...viewDisposables);

		// set context to denote successful initialization
		await setContext('init', true);
	} catch (err) {
		vscode.window.showErrorMessage((err as Error).message);
		await setContext('init', false);
	}
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
