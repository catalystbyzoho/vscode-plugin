import { commands, Disposable, TreeView, window } from 'vscode';
import { registerViewCommands } from '../commands/view';
import type { ICatalystJson } from '../util_types/config';
import { ClientOption, ClientTree, ClientTreeItem } from './client';
import { ApigTreeItem, ConfigOptions, ConfigTree, ConfigTreeItem } from './configs';
import { FunctionsOption, FunctionsTree, FunctionsTreeItem } from './functions';
import { AppSailOption, AppSailTree, AppSailTreeItem } from './appsail';
import { serveDecorationProvider } from './decorations';

export type TCatalystTreeViews = 'httpFn' | 'nonHttpFn' | 'appSail' | 'client' | 'config';

// register the file decoration provider to use served component highlighting
window.registerFileDecorationProvider(new serveDecorationProvider());

export default class CatalystTreeView {
	private static httpFnView: TreeView<FunctionsTreeItem | FunctionsOption>;
	private static nonHttpFnView: TreeView<FunctionsTreeItem | FunctionsOption>;
	private static appSailView: TreeView<AppSailTreeItem | AppSailOption>;
	private static clientView: TreeView<ClientTreeItem | ClientOption>;
	private static configView: TreeView<ConfigTreeItem | ApigTreeItem | ConfigOptions>;

	private static configTreeProvider: ConfigTree;

	private static getTreeProvider(tree: TCatalystTreeViews) {
		switch (tree) {
			case 'httpFn': {
				return CatalystTreeView.configTreeProvider.functionsTree.httpFunctionsTreeProvider;
			}
			case 'nonHttpFn': {
				return CatalystTreeView.configTreeProvider.functionsTree
					.nonHttpFunctionsTreeProvider;
			}
			case 'appSail': {
				return CatalystTreeView.configTreeProvider.appSailTree;
			}
			case 'client': {
				return CatalystTreeView.configTreeProvider.clientTree;
			}
			case 'config': {
				return CatalystTreeView.configTreeProvider;
			}
		}
	}

	public static setViewMessage(
		message?: string,
		{
			clearView = false,
			views = ['httpFn', 'nonHttpFn', 'appSail', 'client', 'config'],
			refreshTree = true
		}: { clearView?: boolean; views?: Array<TCatalystTreeViews>; refreshTree?: boolean } = {}
	) {
		views.forEach((_view) => {
			const view =
				CatalystTreeView[
					(_view + 'View') as
						| 'httpFnView'
						| 'nonHttpFnView'
						| 'appSailView'
						| 'clientView'
						| 'configView'
				];
			if (view) {
				if (message && _view !== 'config') {
					view.message = message;
				} else if (!message) {
					view.message = undefined;
					refreshTree && this.getTreeProvider(_view).refreshTree();
					return;
				}
			}
			clearView && this.getTreeProvider(_view).clearTree(refreshTree);
		});
	}

	public static async refreshTreeView({
		catalystJson,
		view = 'config'
	}: {
		catalystJson?: ICatalystJson;
		view?: TCatalystTreeViews;
	} = {}): Promise<unknown> {
		switch (view) {
			case 'httpFn': {
				this.getTreeProvider(view).refreshTree();
				return commands.executeCommand(
					'zcatalyst.view.httpFunctions.refreshTree',
					catalystJson
				);
			}
			case 'nonHttpFn': {
				return commands.executeCommand(
					'zcatalyst.view.nonHttpFunctions.refreshTree',
					catalystJson
				);
			}
			case 'appSail': {
				return commands.executeCommand('zcatalyst.view.appSail.refreshTree', catalystJson);
			}
			case 'client': {
				return commands.executeCommand('zcatalyst.view.client.refreshTree', catalystJson);
			}
			case 'config':
			default: {
				return commands.executeCommand('zcatalyst.view.config.refreshTree', catalystJson); // refreshing configs will refresh the entire tree view
			}
		}
	}

	public static async constructTreeViews(catalystRoot: string, catalystJson?: ICatalystJson) {
		const viewDisposables: Array<Disposable> = [...registerViewCommands()];

		const fnTreeProvider = await FunctionsTree.init(catalystRoot, catalystJson?.functions);
		const httpFnView = window.createTreeView('zcatalyst.http_functions', {
			canSelectMany: true,
			treeDataProvider: fnTreeProvider.httpFunctionsTreeProvider,
			showCollapseAll: true
		});
		CatalystTreeView.httpFnView = httpFnView;

		const nonHttpFnView = window.createTreeView('zcatalyst.non_http_functions', {
			treeDataProvider: fnTreeProvider.nonHttpFunctionsTreeProvider,
			canSelectMany: true,
			showCollapseAll: true
		});
		CatalystTreeView.nonHttpFnView = nonHttpFnView;

		const appSailTreeProvider = await AppSailTree.init(catalystRoot, catalystJson?.appsail);
		const appSailView = window.createTreeView('zcatalyst.appSail', {
			treeDataProvider: appSailTreeProvider,
			canSelectMany: true,
			showCollapseAll: true
		});
		CatalystTreeView.appSailView = appSailView;

		const clientTreeProvider = await ClientTree.init(catalystRoot, catalystJson?.client);
		const clientView = window.createTreeView('zcatalyst.client', {
			treeDataProvider: clientTreeProvider
		});
		CatalystTreeView.clientView = clientView;

		const configTreeProvider = await ConfigTree.init(
			catalystRoot,
			fnTreeProvider,
			appSailTreeProvider,
			clientTreeProvider,
			catalystJson
		);
		CatalystTreeView.configTreeProvider = configTreeProvider;
		const configView = window.createTreeView('zcatalyst.configs', {
			treeDataProvider: configTreeProvider,
			showCollapseAll: true
		});
		CatalystTreeView.configView = configView;

		viewDisposables.push(httpFnView, nonHttpFnView, appSailView, clientView, configView);

		return viewDisposables;
	}
}
