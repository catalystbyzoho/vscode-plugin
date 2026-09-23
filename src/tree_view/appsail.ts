import * as vscode from 'vscode';
import { isEmpty, readJsonFile, resolveSafePath } from '../utils.js';
import { join } from 'path';
import type {
	IAppSailDetail,
	ICatalystAppConfigJson,
	ICatalystJson,
	ICatalystJsonAppSail
} from '../util_types/config';
import { refreshEvent } from '../events.js';
import { getCatalystJson } from '../catalyst/index.js';
import { setStatusBarMessage } from '../status-bar.js';
import { FILENAMES } from '../constants.js';
import { displayNoFolderView } from './utils.js';
import { LogTerminal } from '../terminal/terminals.js';

export class AppSailOption extends vscode.TreeItem {
	appSailDetail: IAppSailDetail;
	constructor(appSailDetail: IAppSailDetail, label: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.appSailDetail = appSailDetail;
	}
}

export class AppSailServe extends AppSailOption {
	parent: AppSailTreeItem;
	url?: string;

	constructor(parent: AppSailTreeItem, appSailDetail: IAppSailDetail) {
		super(appSailDetail, 'Serve');
		this.parent = parent;
		this.tooltip = `Serve ${appSailDetail.name} AppSail in localhost`;
		this.iconPath = new vscode.ThemeIcon('zcatalyst-serve');
		this.command = {
			command: 'zcatalyst.serve.appSail',
			title: `Serve ${appSailDetail.name} AppSail`,
			arguments: [this]
		};
	}

	showKillBtn(show = true) {
		if (show) {
			this.contextValue = 'currentServe';
			this.description = 'Serving';
		} else {
			this.contextValue = undefined;
			this.description = '';
		}
		vscode.commands.executeCommand('zcatalyst.view.appSail.refreshView');
	}

	copyUrlToClipboard() {
		this.url &&
			vscode.env.clipboard
				.writeText(this.url)
				.then(() => setStatusBarMessage('$(loading~spin) URL Copied', 1000));
	}
}

export class AppSailDeploy extends AppSailOption {
	constructor(appSailDetail: IAppSailDetail) {
		super(appSailDetail, 'Deploy');
		this.tooltip = `Deploy ${appSailDetail.name} AppSail to Catalyst Remote Console`;
		this.iconPath = new vscode.ThemeIcon('zcatalyst-deploy');
		this.contextValue = 'appSailDeploy';
		this.command = {
			command: 'zcatalyst.deploy.appSail',
			title: 'Deploy AppSail',
			arguments: [appSailDetail]
		};
	}
}

// no implementation for AppSail delete from CLI yet
// class FunctionsDelete extends FunctionsOption {
// 	constructor(fnDetail: IFnDetail) {
// 		super(fnDetail, 'Delete');
// 		this.tooltip = `Delete ${fnDetail.name} function and its configurations from local machine`;
// 		this.iconPath = new vscode.ThemeIcon('zcatalyst-delete');
// 		this.command = {
// 			command: 'zcatalyst.delete.function',
// 			title: 'Delete function',
// 			arguments: [fnDetail]
// 		};
// 	}
// }

export class AppSailTreeItem extends vscode.TreeItem {
	appSailDetails: IAppSailDetail;
	appSailOptions: Array<AppSailOption> = [];

	constructor(appSailDetails: IAppSailDetail) {
		super(appSailDetails.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.appSailDetails = appSailDetails;
		this.id = appSailDetails.name;
		// this.description = ' [' + appSailDetails.stack + ']'; // TODO: need to decide on this
		this.tooltip = appSailDetails.stack + ' AppSail';
		this.iconPath = new vscode.ThemeIcon('zcatalyst-appsail');
		this.contextValue = 'appSailTreeItem';
		this.appSailOptions.push(
			new AppSailServe(this, appSailDetails),
			new AppSailDeploy(appSailDetails)
		);
	}

	get appConfigPath(): string {
		return join(this.appSailDetails.source, FILENAMES.APP_CONFIG_JSON);
	}

	isServing() {
		return this.resourceUri && this.resourceUri.path.includes('/servingTreeItem');
	}

	setServing(serving = true) {
		if (serving) {
			this.resourceUri = vscode.Uri.file('servingTreeItem');
		} else {
			this.resourceUri = undefined;
		}
	}
}

class AppSailTreeProvider implements vscode.TreeDataProvider<AppSailTreeItem | AppSailOption> {
	readonly catalystRoot: string;
	private _appSails: Array<AppSailTreeItem> = [];

	constructor(catalystRoot: string) {
		this.catalystRoot = catalystRoot;
		vscode.commands.registerCommand(
			'zcatalyst.view.appSail.refreshTree',
			() => !LogTerminal.curProcess && this.refreshTree()
		);
		vscode.commands.registerCommand('zcatalyst.view.appSail.refreshView', () =>
			this.refreshTree({ onlyView: true })
		);

		refreshEvent.event((catalystJson?: ICatalystJson) => this.refreshTree({ catalystJson }));
	}

	private readonly _onDidChangeTreeDataEvent: vscode.EventEmitter<AppSailTreeItem | void> =
		new vscode.EventEmitter();
	onDidChangeTreeData?: vscode.Event<void | AppSailTreeItem | null | undefined> | undefined =
		this._onDidChangeTreeDataEvent.event;
	getTreeItem(element: AppSailTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
	async getChildren(element?: AppSailTreeItem): Promise<Array<AppSailTreeItem | AppSailOption>> {
		if (isEmpty(this._appSails)) {
			return [];
		}

		if (!element) {
			return this._appSails;
		}

		return element.appSailOptions;
	}

	public get items(): Array<AppSailTreeItem> {
		return this._appSails;
	}

	public clearTree(refreshTree = true) {
		this._appSails = [];
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

		const filledAppSail = await setStatusBarMessage(
			`$(sync~spin) Refreshing AppSail view...`,
			fillTreeProviderAppSails(this.catalystRoot, catalystJson?.appsail)
		);

		this._appSails = filledAppSail.map((sail) => {
			const oldSail = this._appSails.find((_sail) => _sail.id === sail.id);
			if (oldSail?.isServing()) {
				oldSail.appSailDetails = sail.appSailDetails;
				oldSail.collapsibleState = sail.collapsibleState;
				oldSail.description = sail.description;
				oldSail.id = sail.id;
				oldSail.label = sail.label;
				oldSail.tooltip = sail.tooltip;
				return oldSail;
			}
			return sail;
		});
		this._onDidChangeTreeDataEvent.fire();
	}
}

export class AppSailTree extends AppSailTreeProvider {
	readonly catalystRoot: string;
	appSailTargets: Array<ICatalystJsonAppSail>;

	private constructor(catalystRoot: string, appSailTargets: Array<ICatalystJsonAppSail>) {
		super(catalystRoot);
		this.catalystRoot = catalystRoot;
		this.appSailTargets = appSailTargets;
	}

	public static async init(
		catalystRoot: string,
		appSailConfig?: Array<ICatalystJsonAppSail>
	): Promise<AppSailTree> {
		if (!appSailConfig) {
			return new AppSailTree(catalystRoot, []);
		}
		const appSailTreeObj = new AppSailTree(catalystRoot, appSailConfig);
		const filledAppSails = await fillTreeProviderAppSails(catalystRoot, appSailConfig);
		appSailTreeObj.items.push(...filledAppSails);

		return appSailTreeObj;
	}
}

function constructAppDetails(
	sailTarget: ICatalystJsonAppSail,
	appConfig: ICatalystAppConfigJson
): IAppSailDetail {
	return Object.assign(sailTarget, appConfig);
}

async function fillTreeProviderAppSails(
	catalystRoot: string,
	appSailTargets: Array<ICatalystJsonAppSail> = []
): Promise<Array<AppSailTreeItem>> {
	const filledSails: Array<AppSailTreeItem> = [];

	if (isEmpty(appSailTargets)) {
		const catalystJson = await getCatalystJson();
		if (catalystJson && catalystJson.appsail) {
			appSailTargets.push(...catalystJson.appsail);
		} else {
			return filledSails;
		}
	}

	await Promise.all(
		appSailTargets.map(async (sailTarget) => {
			let appSailSource: string;
			try {
				appSailSource = await resolveSafePath(catalystRoot, sailTarget.source);
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error('Invalid AppSail source path: ' + sailTarget.source, err);
				return;
			}
			const appConfig = await readJsonFile<ICatalystAppConfigJson>(
				join(appSailSource, FILENAMES.APP_CONFIG_JSON)
			);
			if (!appConfig) {
				// eslint-disable-next-line no-console
				console.error('Unable to get the config File for AppSail: ' + sailTarget);
				return;
			}
			// Normalize to the resolved, containment-checked absolute path so
			// downstream consumers (e.g. `appConfigPath`, `view.ts`) operate
			// on the same validated location rather than the raw workspace-
			// configured value.
			sailTarget.source = appSailSource;
			const appSailDetail = constructAppDetails(sailTarget, appConfig);

			filledSails.push(new AppSailTreeItem(appSailDetail));
		})
	);

	const sortFn = (sailA: AppSailTreeItem, sailB: AppSailTreeItem) => {
		if (sailA.appSailDetails.name > sailB.appSailDetails.name) {
			return 1;
		} else if (sailB.appSailDetails.name > sailA.appSailDetails.name) {
			return -1;
		}
		return 0;
	};

	// to maintain a consistent order in the view
	filledSails.sort(sortFn);

	return filledSails;
}
