import * as vscode from 'vscode';
import { exists, isEmpty, readJsonFile } from '../utils.js';
import { extname, join } from 'path';
import type {
	ICatalystFnConfigJson,
	ICatalystJson,
	ICatalystJsonFunctions,
	IFnDetail,
	IPluginConfig
} from '../util_types/config';
import { refreshEvent } from '../events.js';
import { getCatalystJson } from '../catalyst/index.js';
import { setStatusBarMessage } from '../status-bar.js';
import { EFnGroup, FILENAMES, FN_STACK, FN_TYPES } from '../constants.js';
import { displayNoFolderView } from './utils.js';
import { LogTerminal } from '../terminal/terminals.js';

export class FunctionsOption extends vscode.TreeItem {
	fnDetail: IFnDetail;
	url?: string;
	constructor(fnDetail: IFnDetail, label: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.fnDetail = fnDetail;
	}

	copyUrlToClipboard() {
		this.url &&
			vscode.env.clipboard
				.writeText(this.url)
				.then(() => setStatusBarMessage('$(loading~spin) URL Copied', 1000));
	}
}

export class FunctionsServe extends FunctionsOption {
	fnGroup: EFnGroup;
	parent: FunctionsTreeItem;
	constructor(parent: FunctionsTreeItem, fnDetail: IFnDetail, fnGroup: EFnGroup) {
		super(fnDetail, 'Serve');
		this.parent = parent;
		this.fnGroup = fnGroup;
		this.tooltip = `Serve ${fnDetail.name} function in localhost`;
		this.iconPath = new vscode.ThemeIcon('zcatalyst-serve');
		this.command = {
			command: 'zcatalyst.serve.function',
			title: `Serve ${fnDetail.name} function`,
			arguments: [this]
		};
	}

	showKillBtn(show: boolean) {
		if (show) {
			this.contextValue = 'currentServe';
			this.description = 'Serving';
		} else {
			this.contextValue = undefined;
			this.description = '';
		}
		this.fnGroup === EFnGroup.http
			? vscode.commands.executeCommand('zcatalyst.view.httpFunctions.refreshView')
			: vscode.commands.executeCommand('zcatalyst.view.nonHttpFunctions.refreshView');
	}
}

export class FunctionsDebug extends FunctionsOption {
	fnGroup: EFnGroup;
	parent: FunctionsTreeItem;
	constructor(parent: FunctionsTreeItem, fnDetail: IFnDetail, fnGroup: EFnGroup) {
		super(fnDetail, 'Debug');
		this.parent = parent;
		this.fnGroup = fnGroup;
		this.tooltip = `Debug ${fnDetail.name} function in localhost`;
		this.iconPath = new vscode.ThemeIcon('zcatalyst-debug'); // Need logo for debug
		this.command = {
			command: 'zcatalyst.serve.function.debug',
			title: `Debug ${fnDetail.name} function`,
			arguments: [this]
		};
		this.fnGroup === EFnGroup.http
			? vscode.commands.executeCommand('zcatalyst.view.httpFunctions.refreshView')
			: vscode.commands.executeCommand('zcatalyst.view.nonHttpFunctions.refreshView');
	}

	showKillBtn(show: boolean) {
		if (show) {
			this.contextValue = 'currentServe';
			this.description = 'Debugging';
		} else {
			this.contextValue = undefined;
			this.description = '';
		}
		this.fnGroup === EFnGroup.http
			? vscode.commands.executeCommand('zcatalyst.view.httpFunctions.refreshView')
			: vscode.commands.executeCommand('zcatalyst.view.nonHttpFunctions.refreshView');
	}
}

export class FunctionsDeploy extends FunctionsOption {
	constructor(fnDetail: IFnDetail) {
		super(fnDetail, 'Deploy');
		this.tooltip = `Deploy ${fnDetail.name} function to Catalyst Remote Console`;
		this.iconPath = new vscode.ThemeIcon('zcatalyst-deploy');
		this.contextValue = 'functionsDeploy';
		this.command = {
			command: 'zcatalyst.deploy.function',
			title: 'Deploy function',
			arguments: [fnDetail]
		};
	}
}

class FunctionsDelete extends FunctionsOption {
	constructor(fnDetail: IFnDetail) {
		super(fnDetail, 'Delete');
		this.tooltip = `Delete ${fnDetail.name} function and its configurations from local machine`;
		this.iconPath = new vscode.ThemeIcon('zcatalyst-delete');
		this.command = {
			command: 'zcatalyst.delete.function',
			title: 'Delete function',
			arguments: [fnDetail]
		};
	}
}

export class FunctionsTreeItem extends vscode.TreeItem {
	fnDetails: IFnDetail;
	fnGroup: EFnGroup;
	fnOptions: Array<FunctionsOption> = [];

	constructor(fnDetails: IFnDetail, fnGroup: EFnGroup) {
		super(fnDetails.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.fnDetails = fnDetails;
		this.fnGroup = fnGroup;
		this.id = fnDetails.name;
		this.description = ' [' + fnDetails.type + ']';
		this.tooltip = fnDetails.stack + ' function';
		this.contextValue = 'functionsTreeItem';
		this.resourceUri = vscode.Uri.file('functionsTreeItem');
		this.fnOptions.push(
			new FunctionsServe(this, fnDetails, fnGroup),
			new FunctionsDebug(this, fnDetails, fnGroup),
			new FunctionsDeploy(fnDetails),
			new FunctionsDelete(fnDetails)
		);
		switch (fnDetails.type) {
			case 'basicio': {
				this.iconPath = new vscode.ThemeIcon('zcatalyst-bio');
				break;
			}
			case 'advancedio': {
				this.iconPath = new vscode.ThemeIcon('zcatalyst-aio');
				break;
			}
			case 'job': {
				this.iconPath = new vscode.ThemeIcon('zcatalyst-job-scheduling');
				break;
			}
			case 'cron': {
				this.iconPath = new vscode.ThemeIcon('zcatalyst-cron');
				break;
			}
			case 'event': {
				this.iconPath = new vscode.ThemeIcon('zcatalyst-event');
				break;
			}
			case 'integration': {
				this.iconPath = new vscode.ThemeIcon('zcatalyst-integ');
				break;
			}
			case 'browser_logic': {
				this.iconPath = new vscode.ThemeIcon('zcatalyst-browserlogic');
				this.fnOptions.splice(1, 1); // remove debug item for browser logic functions
				break;
			}
		}
	}

	get fnConfigPath(): string {
		return join(this.fnDetails.source, FILENAMES.CATALYST_CONFIG_JSON);
	}

	isServing() {
		return this.resourceUri && this.resourceUri.path.includes('/servingTreeItem');
	}

	setServing(serving = true) {
		if (serving) {
			this.resourceUri = vscode.Uri.file('servingTreeItem'); // used to highlight the serving element
		} else {
			this.resourceUri = undefined;
		}
	}

	// setDebugging(debugging = true) {
	// 	if (debugging) {
	// 		this.resourceUri = vscode.Uri.file('debuggingFnTreeItem');
	// 	} else {
	// 		this.resourceUri = undefined;
	// 	}
	// }
}

class FunctionsTreeProvider
	implements vscode.TreeDataProvider<FunctionsTreeItem | FunctionsOption>
{
	readonly catalystRoot: string;
	fnRoot: string | undefined;
	readonly fnGroup?: EFnGroup;
	private _functions: Array<FunctionsTreeItem> = [];

	constructor(catalystRoot: string, fnRoot: string, fnGroup: EFnGroup) {
		this.catalystRoot = catalystRoot;
		this.fnRoot = fnRoot;
		this.fnGroup = fnGroup;

		if (fnGroup === EFnGroup.http) {
			vscode.commands.registerCommand(
				'zcatalyst.view.httpFunctions.refreshTree',
				() => !LogTerminal.curProcess && this.refreshTree()
			);
			vscode.commands.registerCommand('zcatalyst.view.httpFunctions.refreshView', () =>
				this.refreshTree({ onlyView: true })
			);
		} else {
			vscode.commands.registerCommand(
				'zcatalyst.view.nonHttpFunctions.refreshTree',
				() => !LogTerminal.curProcess && this.refreshTree()
			);
			vscode.commands.registerCommand('zcatalyst.view.nonHttpFunctions.refreshView', () =>
				this.refreshTree({ onlyView: true })
			);
		}

		refreshEvent.event((catalystJson?: ICatalystJson) => this.refreshTree({ catalystJson }));
	}

	private readonly _onDidChangeTreeDataEvent: vscode.EventEmitter<FunctionsTreeItem | void> =
		new vscode.EventEmitter();
	onDidChangeTreeData?: vscode.Event<void | FunctionsTreeItem | null | undefined> | undefined =
		this._onDidChangeTreeDataEvent.event;
	getTreeItem(element: FunctionsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
	async getChildren(
		element?: FunctionsTreeItem
	): Promise<Array<FunctionsTreeItem | FunctionsOption>> {
		if (isEmpty(this._functions)) {
			return [];
		}

		if (!element) {
			return this._functions;
		}

		return element.fnOptions;
	}

	public get items(): Array<FunctionsTreeItem> {
		return this._functions;
	}

	public clearTree(refreshTree = true) {
		this._functions = [];
		refreshTree && this.refreshTree({ onlyView: true });
	}

	public async refreshTree({
		catalystJson,
		onlyView = false
	}: { catalystJson?: ICatalystJson; onlyView?: boolean } = {}): Promise<void> {
		if (onlyView) {
			return this._onDidChangeTreeDataEvent.fire();
		}

		if (!this.catalystRoot) {
			displayNoFolderView();
			return;
		}
		catalystJson = catalystJson
			? catalystJson
			: await getCatalystJson({ catalystRoot: this.catalystRoot, refresh: true });
		const fnRoot =
			this.fnRoot || join(this.catalystRoot, catalystJson?.functions?.source || 'functions');
		const filledFunctions = await setStatusBarMessage(
			`$(sync~spin) Refreshing functions view...`,
			fillTreeProviderFunctions(this.catalystRoot, fnRoot, {
				fnGroup: this.fnGroup,
				fnTargets: catalystJson?.functions?.targets || []
			})
		);
		const updatedFns =
			this.fnGroup === EFnGroup.http ? filledFunctions.http : filledFunctions.nonHttp;

		this._functions = updatedFns.map((fn) => {
			const oldFn = this._functions.find((_fn) => _fn.id === fn.id);
			if (oldFn?.isServing()) {
				oldFn.fnDetails = fn.fnDetails;
				oldFn.collapsibleState = fn.collapsibleState;
				oldFn.description = fn.description;
				oldFn.id = fn.id;
				oldFn.label = fn.label;
				oldFn.tooltip = fn.tooltip;
				return oldFn;
			}
			return fn;
		});
		this.fnRoot = filledFunctions.fnRoot;
		this._onDidChangeTreeDataEvent.fire();
	}
}

export class FunctionsTree {
	readonly catalystRoot: string;
	fnRoot: string;
	fnTargets: Array<string>;
	plugins?: string | IPluginConfig;
	ignore?: Array<string>;
	httpFunctionsTreeProvider: FunctionsTreeProvider;
	nonHttpFunctionsTreeProvider: FunctionsTreeProvider;

	private constructor(catalystRoot: string, fnRoot: string, fnTargets: Array<string>) {
		this.catalystRoot = catalystRoot;
		this.fnRoot = fnRoot;
		this.fnTargets = fnTargets;
		this.httpFunctionsTreeProvider = new FunctionsTreeProvider(
			catalystRoot,
			fnRoot,
			EFnGroup.http
		);
		this.nonHttpFunctionsTreeProvider = new FunctionsTreeProvider(
			catalystRoot,
			fnRoot,
			EFnGroup.nonHttp
		);
	}

	public static async init(
		catalystRoot: string,
		catalystFunctionConfig?: ICatalystJsonFunctions
	): Promise<FunctionsTree> {
		if (!catalystFunctionConfig) {
			const fnTreeObj = new FunctionsTree(catalystRoot, '', []);

			return fnTreeObj;
		}
		const fnRoot = join(catalystRoot, catalystFunctionConfig.source || 'functions');
		const fn = catalystFunctionConfig.targets;
		const fnRootExits = await exists(fnRoot);
		if (!fnRootExits) {
			throw new Error('Invalid FnRoot: ' + fnRoot);
		}
		const fnTreeObj = new FunctionsTree(catalystRoot, fnRoot, fn);
		fnTreeObj.ignore = catalystFunctionConfig.ignore;
		fnTreeObj.plugins = catalystFunctionConfig.plugin as IPluginConfig;
		const filledFunctions = await fillTreeProviderFunctions(catalystRoot, fnRoot, {
			fnTargets: fn
		});
		fnTreeObj.httpFunctionsTreeProvider.items.push(...filledFunctions.http);
		fnTreeObj.nonHttpFunctionsTreeProvider.items.push(...filledFunctions.nonHttp);

		return fnTreeObj;
	}
}

function constructFunctionDetails(fnSource: string, fnConfig: ICatalystFnConfigJson): IFnDetail {
	const details = {
		source: fnSource
	} as IFnDetail;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	Object.entries(fnConfig).forEach(([_key, val]) => Object.assign(details, val));

	if (details.stack === FN_STACK.java.java8 && !extname(details.main)) {
		details.main += '.java';
	}

	details.main = join(details.source, details.main);

	return details;
}

async function fillTreeProviderFunctions(
	catalystRoot: string,
	fnRoot: string | undefined,
	{ fnTargets = [], fnGroup }: { fnTargets?: Array<string>; fnGroup?: EFnGroup }
): Promise<{
	http: Array<FunctionsTreeItem>;
	nonHttp: Array<FunctionsTreeItem>;
	fnRoot?: string;
}> {
	const functionsFilled = {
		http: [],
		nonHttp: [],
		fnRoot
	} as {
		http: Array<FunctionsTreeItem>;
		nonHttp: Array<FunctionsTreeItem>;
		fnRoot?: string;
	};

	if (isEmpty(fnTargets) || !fnRoot) {
		const catalystJson = await getCatalystJson();
		if (catalystJson && catalystJson.functions) {
			fnTargets.push(...catalystJson.functions.targets);
			fnRoot = join(catalystRoot, catalystJson.functions.source);
		} else {
			functionsFilled.fnRoot = undefined;
			return functionsFilled;
		}
	}

	await Promise.all(
		fnTargets.map(async (fnTarget) => {
			if (!fnRoot) {
				return;
			}
			const fnSource = join(fnRoot, fnTarget);
			const catalystConfig = await readJsonFile<ICatalystFnConfigJson>(
				join(fnSource, FILENAMES.CATALYST_CONFIG_JSON)
			);
			if (!catalystConfig) {
				// eslint-disable-next-line no-console
				console.error('Unable to get the config File for function: ' + fnTarget);
				return;
			}
			const functionDetail = constructFunctionDetails(fnSource, catalystConfig);

			if (
				(!fnGroup || fnGroup === EFnGroup.http) &&
				FN_TYPES.http.includes(functionDetail.type)
			) {
				functionsFilled.http.push(new FunctionsTreeItem(functionDetail, EFnGroup.http));
			} else if (
				(!fnGroup || fnGroup === EFnGroup.nonHttp) &&
				FN_TYPES.nonHttp.includes(functionDetail.type)
			) {
				functionsFilled.nonHttp.push(
					new FunctionsTreeItem(functionDetail, EFnGroup.nonHttp)
				);
			}
		})
	);

	const sortFn = (fnA: FunctionsTreeItem, fnB: FunctionsTreeItem) => {
		if (fnA.fnDetails.name > fnB.fnDetails.name) {
			return 1;
		} else if (fnB.fnDetails.name > fnA.fnDetails.name) {
			return -1;
		}
		return 0;
	};

	// to maintain a consistent order in the view
	functionsFilled.http.sort(sortFn);
	functionsFilled.nonHttp.sort(sortFn);

	return functionsFilled;
}
