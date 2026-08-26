import { commands, Uri, Disposable, window } from 'vscode';
import { join } from 'path';
import { ClientTreeItem } from '../tree_view/client';
import { registerCommands } from './utils';
import { FunctionsTreeItem } from '../tree_view/functions';
import { ApigTreeItem, ConfigTreeItem } from '../tree_view/configs';
import { FILENAMES } from '../constants';
import { getCatalystRoot } from '../catalyst';
import { exists } from '../utils';
import { AppSailTreeItem } from '../tree_view/appsail';

async function openFile(
	element: ClientTreeItem | FunctionsTreeItem | ApigTreeItem | ConfigTreeItem
) {
	const catalystRoot = getCatalystRoot();
	const vsOpenCmd = async (path: string, type: 'explorer' | 'editor' | 'window' = 'editor') => {
		switch (type) {
			case 'editor': {
				return commands.executeCommand('vscode.open', Uri.file(path));
			}
			case 'explorer': {
				await commands.executeCommand('revealInExplorer', Uri.file(path));
				return commands.executeCommand('list.select');
			}
			case 'window': {
				return commands.executeCommand('vscode.openFolder', Uri.file(path), true);
			}
		}
	};

	if (element instanceof ClientTreeItem) {
		const isClientPath = await exists(element.clientDetail.source);
		if (!isClientPath) {
			throw new Error(`Client path (${element.clientDetail.source}) does not exists`);
		}
		return vsOpenCmd(element.clientDetail.source, 'explorer');
	} else if (element instanceof FunctionsTreeItem) {
		const isFnPath = await exists(element.fnDetails.source);
		if (!isFnPath) {
			throw new Error(`Function path (${element.fnDetails.source}) does not exits`);
		}
		return vsOpenCmd(element.fnDetails.source, 'explorer');
	} else if (element instanceof AppSailTreeItem) {
		const isAppSailPath = await exists(element.appSailDetails.source);
		if (!isAppSailPath) {
			throw new Error(`AppSail path (${element.appSailDetails.source}) does not exists`);
		}

		const isPathWithinWorkSpace = element.appSailDetails.source.startsWith(catalystRoot);
		if (isPathWithinWorkSpace) {
			return vsOpenCmd(element.appSailDetails.source, 'explorer');
		}
		const open = await window.showInformationMessage(
			`The AppSail (${element.appSailDetails.name}) is outside the current workspace. Do you wish to open the AppSail in a new Window.` +
				' Note: the new window may not contain a catalyst project unless initialized within that workspace',
			'Open'
		);

		return open === 'Open'
			? vsOpenCmd(element.appSailDetails.source, 'window')
			: Promise.resolve();
	} else if (element instanceof ApigTreeItem) {
		const isApigPath = await exists(element.apigSource);
		if (!isApigPath) {
			throw new Error(`APIG rules path (${element.apigSource}) does not exits`);
		}
		return vsOpenCmd(element.apigSource);
	}
	return vsOpenCmd(join(catalystRoot, FILENAMES.CATALYST_JSON));
}

export function registerViewCommands(): Array<Disposable> {
	const cmdPrefix = 'view.';
	const functionCommands: Array<[string, (...arg: Array<any>) => unknown]> = [
		[cmdPrefix + 'open', openFile]
	];
	return registerCommands(functionCommands);
}
