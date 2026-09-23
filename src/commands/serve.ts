import { commands, Disposable, env, extensions, Uri, window } from 'vscode';
import {
	getCatalystRoot,
	serverEvent,
	IServerDetails,
	IFnTarget,
	IClientTarget,
	TAppSailServerDetails
} from '../catalyst';
import { EFnGroup, FILENAMES, FN_TYPES } from '../constants';
import Inputs, { TQuickPickItem } from '../inputs';
import { ServeTerminal } from '../terminal/serve.js';
import { ClientServe, ClientTreeItem } from '../tree_view/client';
import { ApigTreeItem, ServeAll as ServeTreeItem } from '../tree_view/configs';
import { FunctionsDebug, FunctionsServe, FunctionsTreeItem } from '../tree_view/functions';
import { readJsonFile, resolveSafePath, setContext } from '../utils';
import { ICatalystFnConfigJson, ICatalystJson, ICatalystJsonFunctions } from '../util_types/config';
import { registerCommands } from './utils.js';
import { AppSailServe, AppSailTreeItem } from '../tree_view/appsail';

function serveComponentsTransformer(
	serveComponents: Array<FunctionsTreeItem | AppSailTreeItem | ClientTreeItem | ApigTreeItem> = []
) {
	return serveComponents.reduce(
		(acc, comp) => {
			if (comp instanceof ClientTreeItem) {
				acc.http.push('client');
			} else if (comp instanceof FunctionsTreeItem) {
				comp.fnGroup === EFnGroup.http
					? acc.http.push(`functions:${comp.fnDetails.name}`)
					: acc.nonHttp.push(`functions:${comp.fnDetails.name}`);
			} else if (comp instanceof ApigTreeItem) {
				acc.http.push('apig');
			} else if (comp instanceof AppSailTreeItem) {
				acc.http.push(`appsail:${comp.appSailDetails.name}`);
			}
			return acc;
		},
		{
			http: [],
			nonHttp: []
		} as {
			http: Array<string>;
			nonHttp: Array<string>;
		}
	);
}

async function getFnTargets(functions: ICatalystJsonFunctions, catalystRoot: string) {
	const fnTargets = functions.targets;
	const targetObjects = {
		httpFns: [] as Array<string>,
		nonHttpFns: [] as Array<string>
	};
	let fnSource: string;
	try {
		fnSource = await resolveSafePath(catalystRoot, functions.source || 'functions');
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Invalid functions source path: ' + functions.source, err);
		return targetObjects;
	}
	await Promise.all(
		fnTargets.map(async (fn) => {
			try {
				const configPath = await resolveSafePath(
					fnSource,
					fn,
					FILENAMES.CATALYST_CONFIG_JSON
				);
				const config = await readJsonFile<ICatalystFnConfigJson>(configPath);

				if (config) {
					FN_TYPES.http.includes(config.deployment.type)
						? targetObjects.httpFns.push(`functions:${fn}`)
						: targetObjects.nonHttpFns.push(`functions:${fn}`);
				}
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error(err);
			}
		})
	);
	return targetObjects;
}

async function enableKillCommand(enable = true) {
	return setContext('serverKill', enable);
}
const codeLenseTarget = ['functions', 'client', 'appsail'] as const;
type TCodeLenseTargets = typeof codeLenseTarget[number];

async function codeLenseServe(catalystJson: ICatalystJson = {}, type?: TCodeLenseTargets) {
	if (ServeTerminal.busy) {
		return;
	}
	const targets: Array<string> = [];
	const catalystRoot = getCatalystRoot();

	switch (type) {
		case 'functions': {
			catalystJson.functions &&
				targets.push(...(await getFnTargets(catalystJson.functions, catalystRoot)).httpFns);
			break;
		}
		case 'client': {
			catalystJson.client && targets.push('client');
			break;
		}
		case 'appsail': {
			catalystJson.appsail && targets.push('appsail');
			break;
		}
		default: {
			Object.keys(catalystJson).forEach(
				(key) => codeLenseTarget.includes(key as TCodeLenseTargets) && targets.push(key)
			);
		}
	}

	if (targets.length === 0) {
		window
			.showErrorMessage(
				'No Catalyst components found to serve, Do you wish to create new or pull existing Catalyst components?',
				'Initialize',
				'Pull'
			)
			.then((res) => {
				if (res === 'Initialize') {
					commands.executeCommand('zcatalyst.init.init');
				} else if (res === 'Pull') {
					commands.executeCommand('zcatalyst.config');
				}
			});
		return;
	}

	const confirmServeInputs = Inputs.confirmQuestion(
		'serve',
		'Catalyst Serve',
		`Do you wish to serve all the HTTP components listed in ${FILENAMES.CATALYST_JSON}?`
	);

	// eslint-disable-next-line no-console
	const confirmServe = await confirmServeInputs.getInputs().catch((err) => console.error(err));

	if (confirmServe && confirmServe.serve) {
		try {
			const serveTerminal = await ServeTerminal.initTerminal();
			const res = await serveTerminal.serve(targets);

			if (res && (res.exitCode === 2 || res.error)) {
				throw res.error;
			}
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Unable to serve: ' + err);
		}
	}
}

async function serveAll(serveAllTreeItem: ServeTreeItem) {
	if (ServeTerminal.busy) {
		return;
	}
	const serveComponents = {
		httpFns: serveAllTreeItem.functionsTree.httpFunctionsTreeProvider.items,
		// nonHttpFns: functionsTree.nonHttpFunctionsTreeProvider.functions,
		appSail: serveAllTreeItem.appSailTree.items,
		client: serveAllTreeItem.clientTree.items[0],
		apig: serveAllTreeItem.configTree.apig as ApigTreeItem
	};

	if (serveComponents.httpFns.length === 0 && !serveComponents.client) {
		window
			.showErrorMessage(
				'No Catalyst components found to serve, Do you wish to create new or pull existing Catalyst components?',
				'Initialize',
				'Pull'
			)
			.then((res) => {
				if (res === 'Initialize') {
					commands.executeCommand('zcatalyst.init.init');
				} else if (res === 'Pull') {
					commands.executeCommand('zcatalyst.config');
				}
			});
		return;
	}

	const serveInput = new Inputs();

	serveInput.push(() =>
		Inputs.createQuickPick(
			'serveAll',
			[
				['Yes', true, 'Serve all components'],
				['No', false, 'Let me pick the components to serve']
			],
			{
				placeHolder: 'Do you wish to serve all Catalyst components?',
				title: 'Serve Components'
			}
		)
	);

	const serveFeatures = Object.keys(serveComponents).reduce(
		(acc, key) => {
			switch (key) {
				case 'httpFns': {
					const fns = serveComponents.httpFns;
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					Object.entries(fns).forEach(([_key, fnTreeItem], idx) => {
						if (idx === 0) {
							acc.functions.push([
								'HTTP Functions',
								'httpFunctions',
								undefined,
								true
							]);
						}
						acc.functions.push([
							fnTreeItem.fnDetails.name,
							fnTreeItem,
							' [' + fnTreeItem.fnDetails.type + ']'
						]);
					});
					break;
				}
				case 'client': {
					const client = serveComponents.client;
					if (!client) {
						break;
					}
					acc.client.push(['Client', 'client', undefined, true]);
					acc.client.push([
						client.clientDetail.name,
						client,
						'v' + client.clientDetail.version
					]);
					break;
				}
				case 'apig': {
					const apig = serveComponents.apig;
					if (apig instanceof ApigTreeItem && apig.apigStatus) {
						acc.apig.push(['APIG', 'apig', undefined, true]);
						acc.apig.push(['APIG', apig, 'API Gateway']);
					}
					break;
				}
				case 'appSail': {
					const appSail = serveComponents.appSail;
					appSail.forEach((sail, idx) => {
						if (idx === 0) {
							acc.appSail.push(['AppSail', 'appsail', undefined, true]);
						}
						acc.appSail.push([sail.appSailDetails.name, sail]); // need to decide on the description
					});
					break;
				}
				default: {
					throw new Error('Unknown feature: ' + key);
				}
			}
			return acc;
		},
		{
			functions: [] as Array<TQuickPickItem<FunctionsTreeItem | string>>,
			appSail: [] as Array<TQuickPickItem<AppSailTreeItem | string>>,
			client: [] as Array<TQuickPickItem<ClientTreeItem | string>>,
			apig: [] as Array<TQuickPickItem<ApigTreeItem | string>>
		}
	);

	const serveComponentsArr = [
		...serveFeatures.client,
		...serveFeatures.apig,
		...serveFeatures.functions,
		...serveFeatures.appSail
	] as Array<TQuickPickItem<FunctionsTreeItem | ClientTreeItem | ApigTreeItem | string>>;

	serveInput.push<FunctionsTreeItem | ClientTreeItem | ApigTreeItem, boolean>((prev) => {
		if (Array.isArray(prev) && prev[0] === true) {
			return;
		}
		return Inputs.createQuickPick('serveComponents', serveComponentsArr, {
			title: 'Serve Components',
			placeHolder: 'Please choose the components to serve in local machine',
			multiSelect: true,
			validate: (val) => {
				if (Array.isArray(val) && val.length === 1 && val[0] instanceof ApigTreeItem) {
					window.showWarningMessage(
						'API Gateway cannot be served separately. Please select one or more other components to continue.'
					);
					return false;
				}
				return true;
			}
		});
	});

	const ans = await serveInput.getInputs();

	const serveTerminal = await ServeTerminal.initTerminal();

	const componentsToServe: Array<string> = [];
	if (Array.isArray(ans.serveAll) && ans.serveAll[0] === true) {
		if (serveComponents.client) {
			componentsToServe.push('client');
		}
		if (serveComponents.httpFns) {
			componentsToServe.push(
				...serveComponents.httpFns.map((fn) => `functions:${fn.fnDetails.name}`)
			);
		}
		if (serveComponents.appSail) {
			componentsToServe.push(
				...serveComponents.appSail.map((sail) => `appsail:${sail.appSailDetails.name}`)
			);
		}
		if (serveComponents.apig && serveComponents.apig.apigStatus) {
			componentsToServe.push('apig');
		}
	} else {
		const serveComponentsAns = serveComponentsTransformer(
			ans.serveComponents as Array<FunctionsTreeItem | ClientTreeItem>
		);
		componentsToServe.push(...serveComponentsAns.http);
	}

	serveTerminal
		.on('ready', () => {
			serveAllTreeItem.description = 'Serving';
			serverEvent.once('start', () => {
				enableKillCommand();
				serveAllTreeItem.showKillBtn();
			});
		})
		.serve(componentsToServe)
		.finally(() => {
			serveAllTreeItem.description = undefined;
			serveAllTreeItem.showKillBtn(false);
			enableKillCommand(false);
		});
}

async function debugFunction(fnServeItem: FunctionsDebug) {
	if (fnServeItem.fnDetail.stack.includes('python')) {
		const debugPy = extensions.getExtension('ms-python.debugpy');
		const pyExtUrl = Uri.parse('vscode:extension/ms-python.debugpy');
		if (!debugPy) {
			const installExt = await window.showWarningMessage(
				'Unable to debug the python function since the [Python Debugger extension](https://marketplace.visualstudio.com/items?itemName=ms-python.debugpy) is not installed/enabled.' +
					` Click "INSTALL" to install the required extension`,
				'INSTALL'
			);
			if (installExt === 'INSTALL') {
				env.openExternal(pyExtUrl);
			}
			return;
		}
	}
	return serveFunction(fnServeItem, true);
}

async function serveFunction(fnServeItem: FunctionsServe | FunctionsDebug, debug = false) {
	if (ServeTerminal.busy) {
		return;
	}
	if (fnServeItem.fnGroup === EFnGroup.http) {
		(await ServeTerminal.initTerminal())
			.on('ready', () => {
				serverEvent.once('start', (fnServeTarget: IServerDetails<IFnTarget>) => {
					fnServeItem.url = fnServeTarget.target?.local_url;
					enableKillCommand();
					fnServeItem.parent.setServing();
					fnServeItem.showKillBtn(true);
				});
			})
			.debugFunction(fnServeItem.fnDetail, debug)
			.finally(() => {
				fnServeItem.description = undefined;
				fnServeItem.parent.setServing(false);
				fnServeItem.showKillBtn(false);
				enableKillCommand(false);
			});
		return;
	}

	const inputsPath = await resolveSafePath(
		fnServeItem.fnDetail.source,
		typeof fnServeItem.fnDetail.test_inputs === 'string'
			? fnServeItem.fnDetail.test_inputs
			: 'catalyst-inputs.json'
	).catch((err) => err as Error);

	if (inputsPath instanceof Error) {
		window.showErrorMessage(
			`Unable to Execute the function. Reason: Invalid test_inputs path`
		);
		return;
	}

	const inputsJson = await readJsonFile<Record<string, unknown>>(inputsPath, true).catch(
		(err) => err
	);

	if (inputsJson instanceof Error) {
		window.showErrorMessage(
			`Unable to Execute the function. Reason: ${
				(inputsJson as Error & { code: string }).code === 'ENOENT'
					? 'catalyst-inputs.json file not found'
					: 'Unable to read the catalyst-inputs.json file'
			}`
		);
		return;
	}

	if (Object.keys(inputsJson).length === 0) {
		window.showErrorMessage('Unable to execute the function. Reason: No input keys found');
		return;
	}

	const inputKeys = Object.keys(inputsJson);

	const keyInputs = new Inputs();

	keyInputs.push(() =>
		Inputs.createQuickPick('key', inputKeys, {
			placeHolder: 'Select the input for function',
			title: 'Input Key'
		})
	);
	const input =
		inputKeys.length === 1
			? undefined
			: ((await keyInputs.getInputs()).key as Array<string>)[0];

	(await ServeTerminal.initTerminal('functions:execute'))
		.on('ready', () => {
			serverEvent.once('start', () => {
				enableKillCommand();
				fnServeItem.parent.setServing();
				fnServeItem.showKillBtn(true);
			});
		})
		.executeFunction(fnServeItem.fnDetail, input, debug)
		.finally(() => {
			fnServeItem.description = undefined;
			fnServeItem.parent.setServing(false);
			fnServeItem.showKillBtn(false);
			enableKillCommand(false);
		});
	return;
}

async function serverAppSail(appSailServerItem: AppSailServe) {
	if (ServeTerminal.busy) {
		return;
	}
	(await ServeTerminal.initTerminal())
		.on('ready', () =>
			serverEvent.once('start', (sail: IServerDetails<TAppSailServerDetails>) => {
				appSailServerItem.url = `http://localhost:${sail.target?.port?.proxy || 9000}/`;
				enableKillCommand();
				appSailServerItem.parent.setServing();
				appSailServerItem.showKillBtn();
			})
		)
		.serve([`appsail:${appSailServerItem.appSailDetail.name}`])
		.finally(() => {
			appSailServerItem.parent.setServing(false);
			appSailServerItem.showKillBtn(false);
			enableKillCommand(false);
		});
}

async function serveClient(clientServeItem: ClientServe) {
	if (ServeTerminal.busy) {
		return;
	}
	(await ServeTerminal.initTerminal())
		.on('ready', () =>
			serverEvent.once('start', (clientTarget: IServerDetails<IClientTarget>) => {
				clientServeItem.url = clientTarget.target?.local_url;
				enableKillCommand();
				clientServeItem.parent.setServing();
				clientServeItem.showKillBtn();
			})
		)
		.serve(['client'])
		.finally(() => {
			clientServeItem.showKillBtn(false);
			clientServeItem.parent.setServing(false);
			enableKillCommand(false);
		});
}

async function killServer() {
	serverEvent.emit('stop');
}

async function copyUrl(treeItem: FunctionsServe | ClientServe) {
	treeItem.copyUrlToClipboard();
}

export default function registerServeCommands(): Array<Disposable> {
	const cmdPrefix = 'serve.';
	const serveCommands: Array<[string, (...arg: Array<any>) => unknown]> = [
		[cmdPrefix + 'serve', serveAll],
		[cmdPrefix + 'codeLense', codeLenseServe],
		[cmdPrefix + 'function', serveFunction],
		[cmdPrefix + 'appSail', serverAppSail],
		[cmdPrefix + 'function.debug', debugFunction],
		[cmdPrefix + 'client', serveClient],
		[cmdPrefix + 'kill', killServer],
		[cmdPrefix + 'copy-url', copyUrl]
	];
	return registerCommands(serveCommands, { auth: true, trusted: true });
}
