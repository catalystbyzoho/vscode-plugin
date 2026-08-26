import { ThemeIcon, TreeItem, window } from 'vscode';
import Inputs, { TOutput, TQuickPickItem } from '../../inputs.js';
import { isEmpty, isNumber, refreshTreeView, resolveSafePath, setContext } from '../../utils.js';
import {
	ICatalystResult,
	getCatalystJson,
	ICatalystFnRuntime,
	getCatalystRoot,
	getUserDetails,
	catalystExec,
	CATALYST_CONSTANTS
} from '../../catalyst/index.js';
import { FnDetails, isValidClassName, overwrite } from './utils.js';
import { setStatusBarMessage } from '../../status-bar.js';
import { getDetails } from '../../catalyst/project.js';
import { EFnGroup } from '../../constants.js';
import { CatalystError, ERROR_CODES } from '../../error.js';
import { inspect } from 'util';

async function initFunctions(fnGroup?: EFnGroup): Promise<Inputs | void> {
	const catalystRoot = getCatalystRoot();
	const catalystJson = await getCatalystJson({ catalystRoot, refresh: true });

	const httpFns: Array<TQuickPickItem> = [
		[[new ThemeIcon('zcatalyst-bio'), 'BasicIO'], 'BasicIO'],
		[[new ThemeIcon('zcatalyst-aio'), 'AdvancedIO'], 'AdvancedIO'],
		[[new ThemeIcon('zcatalyst-browserlogic'), 'Browser Logic'], 'browser_logic']
	];
	const nonHttpFns: Array<TQuickPickItem> = [
		[[new ThemeIcon('zcatalyst-event'), 'Event'], 'Event'],
		[[new ThemeIcon('zcatalyst-cron'), 'Cron'], 'Cron'],
		[[new ThemeIcon('zcatalyst-job-scheduling'), 'Job'], 'Job'],
		[[new ThemeIcon('zcatalyst-integ'), 'Integration'], 'Integration']
	];

	const fnInit = new Inputs();
	fnInit.push(() =>
		Inputs.createQuickPick(
			'fnType',
			(fnGroup === EFnGroup.http && httpFns) ||
				(fnGroup === EFnGroup.nonHttp && nonHttpFns) || [...httpFns, ...nonHttpFns],
			{
				title: 'Select Function Type',
				placeHolder: 'Which type of function do you like to create?'
			}
		)
	);

	fnInit.push(() => {
		const runtimePromise = new Promise<
			Array<TQuickPickItem<{ runtime: string; lang: string } | string>>
		>(async (res, rej) => {
			try {
				const fnType = fnInit.getValue('fnType')[0];
				const fnRuntime = await getDetails<ICatalystFnRuntime>('runtime', fnType);
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
			placeHolder: 'Which runtime do you prefer to write your function?'
		});
	});

	fnInit.push(() => {
		const fnType = fnInit.getValue('fnType')[0];
		const _runtime = fnInit.getValue<{ runtime: string; lang: string }>('runtime');
		const runtime = Array.isArray(_runtime) && _runtime.at(0);
		if (!runtime) {
			throw new Error('Invalid runtime');
		}
		if (fnType === 'Integration') {
			const integFunctions = new Inputs();
			const integServices = new Promise<Array<TQuickPickItem>>(async (_resolve, _reject) => {
				try {
					const details = await getDetails<{ integration_services: Array<string> }>(
						'integration_services'
					);
					return _resolve(
						details.integration_services.map<TQuickPickItem>((service) => {
							switch (service) {
								case 'ZohoCliq':
									return ['ZohoCliq', 'Cliq'];
								case 'ConvoKraft':
									return ['ConvoKraft', 'ConvoKraft'];
								default:
									return [service, service];
							}
						})
					);
				} catch (er) {
					const _er =
						er instanceof CatalystError
							? er
							: new CatalystError(
									'Unable to get the integration services: ' + inspect(er),
									{
										code: ERROR_CODES.UNKNOWN_ERROR
									}
							  );
					window.showErrorMessage(_er.message);
					_reject(_er);
				}
			});
			integFunctions.push(() =>
				Inputs.createQuickPick('integService', integServices, {
					title: 'Integration services',
					placeHolder: 'Please select one of the integration services to continue'
				})
			);
			integFunctions.push(() => {
				if (integFunctions.getValue('integService')[0] === 'Cliq') {
					return Inputs.createQuickPick(
						'cliqHandlers',
						[
							'bot_handler',
							'command_handler',
							'messageaction_handler',
							'widget_handler',
							'function_handler',
							'extension_handler',
							'link_preview_handler'
						],
						{
							title: 'Cliq Handlers',
							placeHolder: 'Please select the handlers to be initialized',
							multiSelect: true
						}
					);
				}
			});
			return integFunctions;
		}
		if (fnType === 'browser_logic' && runtime.lang === 'node') {
			const browserLogicFunction = new Inputs();
			browserLogicFunction.push(() =>
				Inputs.createQuickPick('framework', ['Puppeteer', 'Playwright', 'Selenium'], {
					title: 'Browser Logic Frameworks',
					placeHolder: 'Please choose a framework to initialize'
				})
			);
			return browserLogicFunction;
		}
	});

	fnInit.push(() => {
		const _runtime = fnInit.getValue<{ runtime: string; lang: string }>('runtime');
		const runtime = Array.isArray(_runtime) && _runtime.at(0);
		if (!runtime) {
			throw new Error('Invalid runtime');
		}
		const fnType = fnInit.getValue('fnType')[0].toLocaleLowerCase();

		switch (runtime.lang) {
			case 'java': {
				const addJavaFunction = new Inputs();
				addJavaFunction.push(() =>
					Inputs.createInputBox(
						'name',
						'Java Function name',
						'Please enter a name for the java function',
						{
							validate: async (val) => {
								if (val.length > 50) {
									return 'Function name should be less than or equal to 50 characters in length';
								}
								if (isNumber(val)) {
									return 'Function name cannot be a valid number';
								}
								if (!val.match(/(?!^\d+$)^(\w|-)+$/g)) {
									return 'Invalid function name';
								}
								return overwrite(
									val,
									resolveSafePath(
										catalystRoot,
										catalystJson?.functions?.source || 'functions',
										val as string
									)
								);
							},
							prompt: 'Note: This is not the class name.',
							defaultVal: 'sample'
						}
					)
				);

				addJavaFunction.push(() =>
					Inputs.createInputBox(
						'class',
						'Main Class name',
						'Please enter a name for the main class of the java function',
						{
							validate: (val) => {
								const valid = isValidClassName(val);
								return valid || 'Invalid class name';
							},
							defaultVal: 'Sample'
						}
					)
				);
				return addJavaFunction;
			}
			case 'node': {
				const addNodeFunction = new Inputs();
				addNodeFunction.push(() =>
					Inputs.createInputBox(
						'pkgName',
						'Package Name',
						'Please enter a name for the NodeJS package',
						{
							validate: (val) => {
								if (val.length > 50) {
									return 'Function name should be less than or equal to 50 characters in length';
								}
								if (isNumber(val)) {
									return 'Function name cannot be a valid number';
								}
								if (!val.match(/(^[a-z0-9_-]+$)|(^@[a-z0-9_-]+\/[a-z0-9_-]+$)/g)) {
									return 'invalid package name';
								}
								return overwrite(
									val,
									resolveSafePath(
										catalystRoot,
										catalystJson?.functions?.source || 'functions',
										val as string
									)
								);
							},
							prompt: 'Note: This will also act as the function name.',
							defaultVal: 'node_function' // get from project details
						}
					)
				);
				addNodeFunction.push(() =>
					Inputs.createInputBox(
						'entry',
						'Entry point',
						'Please enter a name for the index file of the function',
						{
							validate: (val) => {
								if (isEmpty(val)) {
									return 'Invalid entry point';
								}
								return true;
							},
							postProcess: (val) => (val.endsWith('.js') ? val : val + '.js'),
							defaultVal: 'index'
						}
					)
				);
				addNodeFunction.push(() =>
					Inputs.createInputBox(
						'author',
						'Author',
						"Please enter the author's email id",
						{
							validate: (val) => {
								if (val !== '' && isEmpty(val)) {
									return 'Invalid author details';
								}
								return true;
							},
							defaultVal: (getUserDetails().Email as string) || ''
						}
					)
				);
				if (fnType !== 'integration') {
					addNodeFunction.push(() =>
						Inputs.confirmQuestion(
							'nodeNpmInstall',
							'Install dependencies',
							'Do you wish to install all dependencies now?'
						)
					);
				}
				return addNodeFunction;
			}
			case 'python': {
				const addPythonFunction = new Inputs();
				addPythonFunction.push(() =>
					Inputs.createInputBox(
						'name',
						'Package name',
						'Please enter a name for your python package',
						{
							validate: (val) => {
								if (val.length > 50) {
									return 'Function name should be less than or equal to 50 characters in length';
								}
								if (isNumber(val)) {
									return 'Function name cannot be a valid number';
								}
								if (!val.match(/(^[a-z0-9_-]+$)|(^@[a-z0-9_-]+\/[a-z0-9_-]+$)/g)) {
									return 'invalid package name';
								}
								return overwrite(
									val,
									resolveSafePath(
										catalystRoot,
										catalystJson?.functions?.source || 'functions',
										val as string
									)
								);
							},
							prompt: 'Note: This will also act as the function name.',
							defaultVal: 'python_function' // get from project details
						}
					)
				);
				addPythonFunction.push(() =>
					Inputs.createInputBox(
						'main',
						'Entry point',
						'Please enter a name for the entry file of the function',
						{
							validate: (val) => {
								if (isEmpty(val)) {
									return 'Invalid entry point';
								}
								return true;
							},
							postProcess: (val) => (val.endsWith('.py') ? val : val + '.py'),
							defaultVal: 'main'
						}
					)
				);
				return addPythonFunction;
			}
			default: {
				throw new Error('Unsupported runtime: ' + runtime.runtime);
			}
		}
	});

	return fnInit;
}

let addingFunction = false;

export async function addHttpFunction(details?: TOutput<unknown>) {
	return functionsAdd(EFnGroup.http, details instanceof TreeItem ? undefined : details);
}

export async function addNonHttpFunction(details?: TOutput<unknown>) {
	return functionsAdd(EFnGroup.nonHttp, details instanceof TreeItem ? undefined : details);
}

export async function functionsAdd(
	fnGroup?: EFnGroup,
	details?: TOutput<unknown>
): Promise<void | ICatalystResult> {
	if (addingFunction === true) {
		window.showWarningMessage('Already adding a function');
		return;
	}
	const contexts = [];
	if (fnGroup) {
		fnGroup === EFnGroup.http
			? contexts.push('viewWelcome.httpFunctions.enable')
			: contexts.push('viewWelcome.nonHttpFunctions.enable');
	} else {
		contexts.push('viewWelcome.httpFunctions.enable', 'viewWelcome.nonHttpFunctions.enable');
	}
	try {
		addingFunction = true;
		await Promise.all(contexts.map((context) => setContext(context, false))); // disable view welcome buttons
		const fnDetails =
			details ||
			(await (await initFunctions(fnGroup))?.getInputs().catch((err) => {
				if (!(err instanceof CatalystError) || err.code !== ERROR_CODES.ABORTED_BY_USER) {
					window.showErrorMessage('Unable to get the function details for init');
				}
				// eslint-disable-next-line no-console
				console.error(err);
			}));
		if (!fnDetails) {
			return;
		}
		const catalystRoot = getCatalystRoot();
		const fnInputDetails = new FnDetails(fnDetails).getDetails();

		const fnInitRes = await setStatusBarMessage(
			'$(loading~spin) Adding function',
			catalystExec('functions:add', catalystRoot, catalystRoot, {
				inputs: fnInputDetails
			})
			// eslint-disable-next-line no-console
		).catch((err) => console.error('Unable to execute the catalyst command', err));

		if (!fnInitRes) {
			return;
		}

		if (fnInitRes.exitCode === 2 || fnInitRes.error) {
			// eslint-disable-next-line no-console
			console.error(fnInitRes.error);
			window.showErrorMessage(
				'Unable to add the function to project: ' + fnInitRes.error?.message ||
					'Unknown Error'
			);
			return fnInitRes as ICatalystResult;
		}

		window.showInformationMessage('Function added to project successfully');
		if (!details) {
			refreshTreeView();
		}
		return fnInitRes as ICatalystResult;
	} catch (e) {
		throw e;
	} finally {
		addingFunction = false;
		await Promise.all(contexts.map((context) => setContext(context, true))); // enable view welcome buttons
	}
}
