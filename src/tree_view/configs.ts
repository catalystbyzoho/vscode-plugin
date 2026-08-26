import * as vs from 'vscode';
import { readJsonFile, setContext, timeOut } from '../utils.js';
import { join } from 'path';
import { ICatalystJson, ICatalystJsonApig } from '../util_types/config.js';
import { refreshEvent } from '../events.js';
import { getCatalystJson } from '../catalyst/index.js';
import { setStatusBarMessage } from '../status-bar.js';
import { FunctionsTree } from './functions.js';
import { ClientTree } from './client.js';
import { FILENAMES } from '../constants.js';
import CatalystTreeView from './index.js';
import { displayNoFolderView } from './utils.js';
import auth from '../auth.js';
import { AppSailTree } from './appsail.js';

export class ConfigOptions extends vs.TreeItem {
	constructor(label: string) {
		super(label, vs.TreeItemCollapsibleState.None);
		this.iconPath = new vs.ThemeIcon('add');
	}
}

export class ServeAll extends ConfigOptions {
	constructor(
		readonly functionsTree: FunctionsTree,
		readonly appSailTree: AppSailTree,
		readonly clientTree: ClientTree,
		readonly configTree: ConfigTree
	) {
		super('Serve');
		this.command = {
			command: 'zcatalyst.serve.serve',
			title: 'serve',
			arguments: [this]
		};
		this.iconPath = new vs.ThemeIcon('zcatalyst-serve');
		this.tooltip = 'Serve locally the available resources in this project directory';
	}

	showKillBtn(show = true) {
		this.contextValue = show ? 'currentServeAll' : undefined;
		vs.commands.executeCommand('zcatalyst.view.config.refreshView');
	}
}

export class DeployAll extends ConfigOptions {
	constructor(
		functionsTree: FunctionsTree,
		appsailTree: AppSailTree,
		clientTree: ClientTree,
		configTree: ConfigTree
	) {
		super('Deploy');
		this.command = {
			command: 'zcatalyst.deploy.deploy',
			title: 'deploy',
			arguments: [functionsTree, appsailTree, clientTree, configTree]
		};
		this.iconPath = new vs.ThemeIcon('zcatalyst-deploy');
		this.tooltip = 'Deploy the resources to Catalyst Remote Console';
	}
}

class OpenRemoteView extends ConfigOptions {
	constructor() {
		super('Project');
		this.command = {
			command: 'zcatalyst.config',
			title: 'Catalyst Project'
		};
		this.tooltip = 'Open Catalyst Project config';
		this.iconPath = new vs.ThemeIcon('account');
	}
}

class ApigOptions extends vs.TreeItem {
	constructor(label: string) {
		super(label, vs.TreeItemCollapsibleState.None);
		this.iconPath = new vs.ThemeIcon('add');
	}
}

class ApigDeploy extends ApigOptions {
	private apigConfig: ICatalystJsonApig;
	constructor(apigConfig: ICatalystJsonApig) {
		super('Deploy');
		this.apigConfig = apigConfig;
		this.iconPath = new vs.ThemeIcon('zcatalyst-deploy');
		this.command = {
			command: 'zcatalyst.deploy.apig',
			title: 'Config Open',
			arguments: [this.apigConfig.rules]
		};
	}
}

class ApigStatus extends ApigOptions {
	constructor(catalystRoot: string, catalystJson: ICatalystJson) {
		super('Status');
		this.description = catalystJson.apig?.enabled ? 'Enabled' : 'Disabled';
		this.iconPath = new vs.ThemeIcon('symbol-property');
		this.command = {
			command: 'zcatalyst.status.apig',
			title: 'APIG status',
			arguments: [join(catalystRoot, FILENAMES.CATALYST_JSON), catalystJson]
		};
	}
}

export class ApigTreeItem extends vs.TreeItem {
	apigConfig: ICatalystJsonApig;
	private catalystRoot: string;
	private apigRules: Record<string, string | unknown>;
	options: Array<ApigOptions> = [];
	private constructor(
		catalystRoot: string,
		apigConfig: ICatalystJsonApig,
		apigRules: Record<string, string | unknown>
	) {
		super('APIG', vs.TreeItemCollapsibleState.Collapsed);
		this.catalystRoot = catalystRoot;
		this.apigConfig = apigConfig;
		this.apigRules = apigRules;
		this.contextValue = 'apigTreeItem';
		this.iconPath = new vs.ThemeIcon('zcatalyst-apig');
	}

	get apigSource(): string {
		return join(this.catalystRoot, this.apigConfig.rules);
	}

	get apigStatus(): boolean {
		return this.apigConfig.enabled;
	}

	static async init(catalystRoot: string, catalystJson: ICatalystJson): Promise<ApigTreeItem> {
		const apigConfig = catalystJson.apig as ICatalystJsonApig;
		const apigRules = await readJsonFile<Record<string, string | unknown>>(
			join(catalystRoot, apigConfig.rules)
		);
		if (!apigRules) {
			throw new Error('Unable to read the APIG rules');
		}
		const treeItemObject = new ApigTreeItem(catalystRoot, apigConfig, apigRules);
		treeItemObject.options.push(
			new ApigDeploy(apigConfig),
			new ApigStatus(catalystRoot, catalystJson)
		);
		return treeItemObject;
	}
}

export class ConfigTreeItem extends vs.TreeItem {
	options: Array<ApigDeploy | ConfigOptions> = [];
	constructor(
		functionsTree: FunctionsTree,
		appSailTree: AppSailTree,
		clientTree: ClientTree,
		configTree: ConfigTree
	) {
		super('CATALYST', vs.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'configTreeItem';
		this.iconPath = new vs.ThemeIcon('zcatalyst-logo');
		this.options.push(
			new ServeAll(functionsTree, appSailTree, clientTree, configTree),
			new DeployAll(functionsTree, appSailTree, clientTree, configTree),
			new OpenRemoteView()
		);
	}
}

export class ConfigTree
	implements vs.TreeDataProvider<ConfigTreeItem | ApigTreeItem | ApigDeploy | ConfigOptions>
{
	private readonly catalystRoot: string;
	private _treeItems: Array<ConfigTreeItem | ApigTreeItem> = [];

	public get apig() {
		return this._treeItems.find((item) => item instanceof ApigTreeItem);
	}

	private constructor(
		catalystRoot: string,
		readonly functionsTree: FunctionsTree,
		readonly appSailTree: AppSailTree,
		readonly clientTree: ClientTree
	) {
		this.catalystRoot = catalystRoot;
		vs.commands.registerCommand(
			'zcatalyst.view.config.refreshTree',
			(catalystJson?: ICatalystJson) => this.refreshTree({ config: catalystJson })
		);
		vs.commands.registerCommand('zcatalyst.view.config.refreshView', () =>
			this.refreshTree({ onlyView: true })
		);
	}

	static async init(
		catalystRoot: string,
		functionsTree: FunctionsTree,
		appSailTree: AppSailTree,
		clientTree: ClientTree,
		catalystJson?: ICatalystJson
	): Promise<ConfigTree> {
		const configTreeObject = new ConfigTree(
			catalystRoot,
			functionsTree,
			appSailTree,
			clientTree
		);
		configTreeObject._treeItems.push(
			...(await configTreeObject.constructTreeItems(catalystRoot, catalystJson))
		);
		return configTreeObject;
	}

	private readonly _onDidChangeTreeData = new vs.EventEmitter<void>();
	onDidChangeTreeData?:
		| vs.Event<void | ApigDeploy | ApigTreeItem | ConfigTreeItem | null | undefined>
		| undefined = this._onDidChangeTreeData.event;
	getTreeItem(
		element: vs.TreeItem | ApigTreeItem | ConfigTreeItem
	): vs.TreeItem | Thenable<vs.TreeItem> {
		return element;
	}
	getChildren(
		element?: ApigTreeItem | ConfigTreeItem
	): vs.ProviderResult<Array<ApigDeploy | ApigTreeItem | ConfigTreeItem | ConfigOptions>> {
		if (!element) {
			return this._treeItems;
		}
		return element.options;
	}

	private async constructTreeItems(
		catalystRoot: string,
		catalystJson?: ICatalystJson
	): Promise<Array<ConfigTreeItem | ApigTreeItem>> {
		const treeItemArr: Array<ConfigTreeItem | ApigTreeItem> = [];
		if (catalystJson) {
			treeItemArr.push(
				new ConfigTreeItem(this.functionsTree, this.appSailTree, this.clientTree, this)
			);
			try {
				catalystJson.apig &&
					treeItemArr.push(await ApigTreeItem.init(catalystRoot, catalystJson));
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error(err);
			}
		}
		return treeItemArr;
	}

	public get items() {
		return this._treeItems;
	}

	public clearTree(refreshTree = true) {
		this._treeItems = [];
		refreshTree && this.refreshTree({ onlyView: true });
	}
	public async refreshTree({
		config,
		onlyView = false
	}: { config?: ICatalystJson | vs.TreeItem; onlyView?: boolean } = {}): Promise<void> {
		if (onlyView || config instanceof vs.TreeItem) {
			return this._onDidChangeTreeData.fire();
		}
		setStatusBarMessage(
			'$(sync~spin) Refreshing...',
			new Promise<void>(async (res) => {
				auth();
				if (!this.catalystRoot) {
					await displayNoFolderView();
					res();
					return;
				}
				const catalystJson = await getCatalystJson({
					catalystRoot: this.catalystRoot,
					refresh: true,
					config
				});
				if (!catalystJson) {
					CatalystTreeView.setViewMessage(
						'Please initialize a Catalyst Project to continue.',
						{ clearView: true, refreshTree: false }
					);
					await setContext('viewWelcome.view', 'init');
				} else {
					CatalystTreeView.setViewMessage(undefined, { refreshTree: false });
					await setContext('viewWelcome.view', 'all');
				}

				const treeItems = catalystJson
					? await this.constructTreeItems(this.catalystRoot, catalystJson)
					: [];

				this._treeItems = treeItems.map((item) => {
					if (item instanceof ServeAll) {
						const oldServeAll = this._treeItems.find(
							(_item) => _item instanceof ServeAll
						);

						oldServeAll?.contextValue === 'currentServeAll' && item.showKillBtn();
					}
					return item;
				});
				this._onDidChangeTreeData.fire();
				refreshEvent.fire(catalystJson);
				await timeOut(1000); // 1s timeout for the status bar message
				res();
			})
		);
	}
}
