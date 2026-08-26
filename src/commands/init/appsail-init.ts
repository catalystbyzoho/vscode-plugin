import { TreeItem, Uri, window } from 'vscode';
import {
	catalystExec,
	CATALYST_CONSTANTS,
	getCatalystJson,
	getCatalystRoot,
	ICatalystFnRuntime,
	ICatalystResult
} from '../../catalyst';
import { exists, isNumber, refreshTreeView, setContext } from '../../utils';
import Inputs, { TOutput, TQuickPickItem } from '../../inputs';
import { getDetails } from '../../catalyst/project';
import { AppSailDetails } from './utils';
import { setStatusBarMessage } from '../../status-bar';
import { join } from 'path';
import { FILENAMES } from '../../constants';

// todo: remove code duplication with function init
function initAppSail(): Inputs {
	const appSailInit = new Inputs();
	appSailInit.push(() =>
		Inputs.createInputBox('name', 'AppSail Name', 'Please specify a name for your AppSail ', {
			defaultVal: 'appsail',
			validate: async (val) => {
				const catalystJson = await getCatalystJson();
				const nameExists = catalystJson?.appsail?.find((sail) => sail.name === val);
				if (nameExists) {
					return 'AppSail already exists. Please specify a different name !!!';
				}
				if (isNumber(val)) {
					return 'AppSail name cannot be a valid number';
				}
				if (!val) {
					return false;
				}
				return true;
			}
		})
	);
	appSailInit.push(() => {
		const runtimePromise = new Promise<
			Array<TQuickPickItem<{ runtime: string; lang: string } | string>>
		>(async (res, rej) => {
			try {
				const fnRuntime = await getDetails<ICatalystFnRuntime>('runtime');
				const runtimeSep: Record<string, TQuickPickItem<string>> = {
					node: ['Node Runtimes', 'node', undefined, true],
					java: ['Java Runtimes', 'java', undefined, true],
					python: ['Python Runtimes', 'python', undefined, true]
				};

				const runtimeItems = fnRuntime.runtimes.reduce(
					(acc, value) => {
						const langArr = value.match(/^([a-zA-Z]+)([0-9_]+)$/);
						if (langArr === null) {
							throw new Error('Invalid runtime: ' + value);
						}
						const runtimeLang = langArr[1] as 'node' | 'java' | 'python';
						const runtimeV = langArr.at(2)?.split('_');
						const runtimeLabel =
							CATALYST_CONSTANTS.RUNTIME.language[runtimeLang].label +
							' ' +
							(runtimeV?.length === 1
								? runtimeV?.at(0)
								: runtimeV?.slice(1).join('.'));
						if (!acc[runtimeLang]) {
							return acc;
						}
						let description = '';
						// eslint-disable-next-line no-console
						console.log(value);
						if (fnRuntime.eol_runtimes && fnRuntime.eol_runtimes[value]) {
							// modify value so that it is displaced with warnings or removed
							switch (fnRuntime.eol_runtimes[value]) {
								case 1:
									description = 'This runtime has reached its EOL';
									break;
								case 2:
									description = 'Only updates are allowed in this runtime';
									// disabled = true;
									break;
								case 3:
									description = 'This runtime is no longer supported';
									// disabled = true;
									break;
								default:
									throw new Error(
										'unknown eol_runtime value ' + fnRuntime.eol_runtimes[value]
									);
							}
						}
						acc[runtimeLang].push([
							runtimeLabel,
							{ runtime: value, lang: runtimeLang },
							description
						]);
						return acc;
					},
					{
						node: [] as Array<TQuickPickItem<{ runtime: string; lang: string }>>,
						java: [] as Array<TQuickPickItem<{ runtime: string; lang: string }>>,
						python: [] as Array<TQuickPickItem<{ runtime: string; lang: string }>>
					}
				);
				const items = [] as Array<
					TQuickPickItem<{ runtime: string; lang: string } | string>
				>;
				Object.entries(runtimeItems).forEach(([runtime, _items]) => {
					if (_items.length > 0) {
						items.push(runtimeSep[runtime as keyof typeof runtimeSep], ..._items);
					}
				});
				res(items);
			} catch (err) {
				rej(err);
			}
		});
		return Inputs.createQuickPick('runtime', runtimePromise, {
			title: 'Select Runtime',
			placeHolder: 'Which runtime do you prefer for your AppSail?'
		});
	});

	appSailInit.push(() => {
		const stack = appSailInit.getValue<{ runtime: string; lang: string }>('runtime');
		if (Array.isArray(stack) && stack.at(0)?.lang !== 'java') {
			return;
		}
		return Inputs.createQuickPick('platform', ['JavaSE', 'WAR'], {
			title: 'Java AppSail Platform',
			placeHolder: 'Please choose a Platform for your AppSail'
		});
	});
	return appSailInit;
}

let addingAppSail = false;
export async function appSailAdd(details?: TOutput<unknown>): Promise<void | ICatalystResult> {
	if (details instanceof TreeItem) {
		details = undefined;
	}
	if (addingAppSail === true) {
		window.showWarningMessage('Already adding an AppSail');
		return;
	}
	try {
		addingAppSail = true;
		await setContext('viewWelcome.appSail.enable', false);
		const appSailDetails = details || (await initAppSail().getInputs());
		const catalystRoot = getCatalystRoot();
		const srcPath = await window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'select source',
			canSelectFolders: true,
			canSelectFiles: true,
			title: 'Select the AppSail source directory',
			defaultUri: Uri.file(join(catalystRoot))
		});
		if (!srcPath?.at(0)) {
			// eslint-disable-next-line no-console
			console.log('Unable to get srcPath for AppSail: ' + srcPath);
			return;
		}

		const appSailInitDetails = new AppSailDetails(
			appSailDetails,
			srcPath.at(0) as Uri
		).getDetails();

		const appConfigPath = join(srcPath.at(0)?.fsPath as string, FILENAMES.APP_CONFIG_JSON);
		const configExists = await exists(appConfigPath);
		if (configExists) {
			const confOverwrite = await window.showWarningMessage(
				`An ${FILENAMES.APP_CONFIG_JSON} file is already present in path ${appConfigPath}. Do you wish to overwrite?`,
				'Continue',
				'Overwrite'
			);
			switch (confOverwrite) {
				case 'Continue': {
					// eslint-disable-next-line no-console
					console.log('User opted not to overwrite the ' + FILENAMES.APP_CONFIG_JSON);
					appSailInitDetails.appConfig = false;
					break;
				}
				case 'Overwrite': {
					// eslint-disable-next-line no-console
					console.log(
						'User opted to overwrite the existing ' + FILENAMES.APP_CONFIG_JSON
					);
					appSailInitDetails.appConfig = true;
					break;
				}
				default: {
					// eslint-disable-next-line no-console
					console.log('No user input');
					const retry = await window.showErrorMessage(
						'Aborted: Unable to continue with AppSail Initialization, Do you wish to try again ?',
						'Init AppSail'
					);

					if (retry === 'Init AppSail') {
						addingAppSail = false;
						return appSailAdd();
					}
					return;
				}
			}
		}

		const appSailAddRes = await setStatusBarMessage(
			'$(loading~spin) Adding AppSail',
			catalystExec('appsail:add', catalystRoot, catalystRoot, {
				inputs: appSailInitDetails
			})
			// eslint-disable-next-line no-console
		).catch((er) => console.error('Unable to execute the catalyst command', er));

		if (!appSailAddRes) {
			return;
		}

		if (appSailAddRes.exitCode === 2 || appSailAddRes.error) {
			// eslint-disable-next-line no-console
			console.error(appSailAddRes.error);
			window.showErrorMessage(
				'Unable to add the client to project: ' + appSailAddRes.error?.message ||
					'Unknown Error'
			);
			return appSailAddRes as ICatalystResult;
		}

		window.showInformationMessage('AppSail added to project successfully');
		if (!details) {
			refreshTreeView();
		}
		return appSailAddRes;
	} catch (e) {
		throw e;
	} finally {
		addingAppSail = false;
		await setContext('viewWelcome.appSail.enable', true); // enable welcome view buttons
	}
}
