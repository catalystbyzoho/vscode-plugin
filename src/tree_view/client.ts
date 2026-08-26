import * as vs from 'vscode';
import { join } from 'path';
import {
	ICatalystClientConfigJson,
	ICatalystJson,
	ICatalystJsonClient,
	IClientDetail,
	IPluginConfig
} from '../util_types/config.js';
import { readJsonFile, timeOut } from '../utils.js';
import { refreshEvent } from '../events.js';
import { getCatalystJson } from '../catalyst/index.js';
import { setStatusBarMessage } from '../status-bar.js';
import { FILENAMES } from '../constants.js';
import { displayNoFolderView } from './utils.js';
import { LogTerminal } from '../terminal/terminals.js';
export class ClientOption extends vs.TreeItem {
	clientDetail: IClientDetail;
	url?: string;
	constructor(clientDetail: IClientDetail, label: string) {
		super(label, vs.TreeItemCollapsibleState.None);
		this.clientDetail = clientDetail;
	}
}

export class ClientServe extends ClientOption {
	parent: ClientTreeItem;
	constructor(parent: ClientTreeItem, clientDetail: IClientDetail) {
		super(clientDetail, 'Serve');
		this.parent = parent;
		this.tooltip = `Serve ${clientDetail.name} web client in localhost`;
		this.iconPath = new vs.ThemeIcon('zcatalyst-serve');
		this.contextValue = 'clientServe';
		this.command = {
			command: 'zcatalyst.serve.client',
			title: 'Serve client',
			arguments: [this]
		};
	}

	showKillBtn(show = true) {
		this.description = show ? 'Serving' : undefined;
		this.contextValue = show ? 'currentServe' : undefined;
		vs.commands.executeCommand('zcatalyst.view.client.refreshView');
	}

	copyUrlToClipboard() {
		this.url &&
			vs.env.clipboard
				.writeText(this.url)
				.then(() => setStatusBarMessage('$(loading~spin) URL Copied', 1000));
	}
}

export class ClientDeploy extends ClientOption {
	constructor(clientDetail: IClientDetail) {
		super(clientDetail, 'Deploy');
		this.tooltip = `Deploy ${clientDetail.name} web client to Catalyst Remote Console`;
		this.iconPath = new vs.ThemeIcon('zcatalyst-deploy');
		this.contextValue = 'clientDeploy';
		this.command = {
			command: 'zcatalyst.deploy.client',
			title: 'Deploy Web Client',
			arguments: [clientDetail]
		};
	}
}

class ClientDelete extends ClientOption {
	constructor(clientDetail: IClientDetail) {
		super(clientDetail, 'Delete');
		this.tooltip = `Delete ${clientDetail.name} web client and its configurations from local machine`;
		this.iconPath = new vs.ThemeIcon('zcatalyst-delete');
		this.command = {
			command: 'zcatalyst.delete.client',
			title: 'Delete client',
			arguments: [clientDetail]
		};
	}
}

export class ClientTreeItem extends vs.TreeItem {
	clientDetail: IClientDetail;
	clientOptions: Array<ClientOption> = [];

	constructor(clientDetail: IClientDetail) {
		super(clientDetail.name, vs.TreeItemCollapsibleState.Collapsed);
		this.clientDetail = clientDetail;
		this.description = 'v' + clientDetail.version;
		this.tooltip = 'Catalyst Web Client';
		this.iconPath = new vs.ThemeIcon('zcatalyst-client');
		this.contextValue = 'clientTreeItem';
		this.clientOptions.push(
			new ClientServe(this, clientDetail),
			new ClientDeploy(clientDetail),
			new ClientDelete(clientDetail)
		);
	}

	isServing() {
		return this.resourceUri && this.resourceUri.path.includes('/servingTreeItem');
	}

	setServing(serving = true) {
		if (serving) {
			this.resourceUri = vs.Uri.file('servingTreeItem');
		} else {
			this.resourceUri = undefined;
		}
	}

	get clientPkgPth(): string {
		return join(this.clientDetail.source, FILENAMES.CLIENT_PACKAGE_JSON);
	}
}

async function readClientPackage(clientSource: string): Promise<IClientDetail> {
	const clientPackagePath = join(clientSource, FILENAMES.CLIENT_PACKAGE_JSON);
	const clientPackage = await readJsonFile<ICatalystClientConfigJson>(clientPackagePath);
	if (!clientPackage) {
		throw new Error('Unable to read the ' + FILENAMES.CLIENT_PACKAGE_JSON + ' file.');
	}
	return {
		source: clientSource,
		...clientPackage
	} as IClientDetail;
}

export class ClientTree implements vs.TreeDataProvider<ClientTreeItem | ClientOption> {
	readonly catalystRoot: string;
	clientSource?: string;
	private _client?: ClientTreeItem;
	plugins?: string | IPluginConfig;

	public get items() {
		return this._client ? [this._client] : [];
	}

	private constructor(catalystRoot: string, clientSource: string, client?: ClientTreeItem) {
		this.catalystRoot = catalystRoot;
		this.clientSource = clientSource;
		this._client = client;

		vs.commands.registerCommand(
			'zcatalyst.view.client.refreshTree',
			() => !LogTerminal.curProcess && this.refreshTree()
		);
		vs.commands.registerCommand('zcatalyst.view.client.refreshView', () =>
			this.refreshTree({ onlyView: true })
		);
		refreshEvent.event((catalystJson?: ICatalystJson) => this.refreshTree({ catalystJson }));
	}

	public static async init(
		catalystRoot: string,
		clientConfig?: ICatalystJsonClient
	): Promise<ClientTree> {
		if (!clientConfig) {
			return new ClientTree(catalystRoot, '');
		}
		const clientSource = join(catalystRoot, clientConfig.source);
		// eslint-disable-next-line no-console
		const clientDetail = await readClientPackage(clientSource).catch((err) =>
			// eslint-disable-next-line no-console
			console.error(err)
		);
		return new ClientTree(
			catalystRoot,
			clientSource,
			clientDetail ? new ClientTreeItem(clientDetail) : undefined
		);
	}

	private readonly _onDidChangeTreeData = new vs.EventEmitter<ClientTreeItem | void>();
	onDidChangeTreeData?: vs.Event<void | ClientTreeItem | null | undefined> | undefined =
		this._onDidChangeTreeData.event;
	getTreeItem(element: ClientTreeItem): vs.TreeItem | Thenable<vs.TreeItem> {
		return element;
	}
	getChildren(element?: ClientTreeItem): vs.ProviderResult<Array<ClientTreeItem | ClientOption>> {
		if (!element) {
			return this.items;
		}
		return element.clientOptions;
	}

	public clearTree(refreshTree = true) {
		this._client = undefined;
		this.clientSource = undefined;
		refreshTree && this.refreshTree({ onlyView: true });
	}

	public async refreshTree({
		catalystJson,
		onlyView = false
	}: { catalystJson?: ICatalystJson; onlyView?: boolean } = {}) {
		if (onlyView) {
			return this._onDidChangeTreeData.fire();
		}
		if (!this.catalystRoot) {
			await displayNoFolderView();
			return;
		}
		const refreshPromise = new Promise<void | IClientDetail>(async (res) => {
			const clientJson =
				catalystJson?.client ||
				(await getCatalystJson({ catalystRoot: this.catalystRoot, refresh: true }))
					?.client ||
				({} as ICatalystJsonClient);
			if (!clientJson.source) {
				return res();
			}
			this.clientSource = join(this.catalystRoot, clientJson.source);
			// eslint-disable-next-line no-console
			const clientDetail = await readClientPackage(this.clientSource).catch((err) =>
				// eslint-disable-next-line no-console
				console.error(err)
			);
			await timeOut(500);
			res(clientDetail);
		});
		const clientDetail = await setStatusBarMessage(
			'$(sync~spin) Refreshing client view...',
			refreshPromise
		);
		const newClientTreeItem = clientDetail && new ClientTreeItem(clientDetail);

		if (!newClientTreeItem) {
			this.clearTree(false);
			this._onDidChangeTreeData.fire();
			return;
		}

		if (this._client?.isServing()) {
			this._client.clientDetail = newClientTreeItem.clientDetail;
			this._client.collapsibleState = newClientTreeItem.collapsibleState;
			this._client.description = newClientTreeItem.description;
			this._client.id = newClientTreeItem.id;
			this._client.label = newClientTreeItem.label;
			this._client.tooltip = newClientTreeItem.tooltip;
		} else {
			this._client = newClientTreeItem;
		}

		this._onDidChangeTreeData.fire();
	}
}
