import * as vscode from 'vscode';
import { ICatalystJson } from './util_types/config';

export class CatalystJsonCodeLensProvider implements vscode.CodeLensProvider {
	onDidChangeCodeLenses?: vscode.Event<void> | undefined;
	async provideCodeLenses(
		document: vscode.TextDocument
	): Promise<Array<vscode.CodeLens> | null | undefined> {
		if (document.isDirty) {
			return;
		}

		let catalystJson: ICatalystJson;
		// check if the json file is valid
		try {
			catalystJson = JSON.parse(document.getText());
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error('invalid json file');
			return;
		}

		const commands = {
			serve: (catalystJson: ICatalystJson, type?: 'functions' | 'client' | 'appsail') => {
				const serveIcon = new vscode.ThemeIcon('zcatalyst-serve');
				return {
					command: 'zcatalyst.serve.codeLense',
					title: `$(${serveIcon.id}) Serve`,
					tooltip: `Serve ${
						!type
							? 'all the HTTP components'
							: type === 'functions'
							? 'all HTTP functions'
							: type === 'client'
							? 'client'
							: 'AppSail'
					} with ZCatalyst-CLI`,
					arguments: [catalystJson, type]
				};
			},
			deploy: (
				catalystJson: ICatalystJson,
				type?: 'functions' | 'client' | 'apig' | 'appsail'
			) => {
				const deployIcon = new vscode.ThemeIcon('zcatalyst-deploy');
				return {
					command: 'zcatalyst.deploy.codeLense',
					title: `$(${deployIcon.id}) Deploy`,
					tooltip: `Deploy ${
						!type ? 'all the components' : type
					} to Catalyst remote console`,
					arguments: [catalystJson, type]
				};
			}
		};
		const keyPositions = await this.findKeysRange(document);
		const lineZero = this.getRange(new vscode.Position(0, 0));
		const codeLensArray = [
			new vscode.CodeLens(lineZero, commands.serve(catalystJson)),
			new vscode.CodeLens(lineZero, commands.deploy(catalystJson))
		];
		Object.entries(keyPositions).forEach(([key, range]) => {
			switch (key) {
				case 'functions': {
					codeLensArray.push(
						new vscode.CodeLens(range, commands.serve(catalystJson, 'functions')),
						new vscode.CodeLens(range, commands.deploy(catalystJson, 'functions'))
					);
					break;
				}
				case 'client': {
					codeLensArray.push(
						new vscode.CodeLens(range, commands.serve(catalystJson, 'client')),
						new vscode.CodeLens(range, commands.deploy(catalystJson, 'client'))
					);
					break;
				}
				case 'apig': {
					codeLensArray.push(
						new vscode.CodeLens(range, commands.deploy(catalystJson, 'apig'))
					);
				}
				case 'appsail': {
					codeLensArray.push(
						new vscode.CodeLens(range, commands.serve(catalystJson, 'appsail')),
						new vscode.CodeLens(range, commands.deploy(catalystJson, 'appsail'))
					);
				}
			}
		});
		return codeLensArray;
	}

	private getRange(start: vscode.Position, end?: vscode.Position): vscode.Range {
		return new vscode.Range(start, end ? end : start);
	}

	private async findKeysRange(
		document: vscode.TextDocument
	): Promise<Record<string, vscode.Range>> {
		const keys = ['functions', 'client', 'apig', 'appsail'];
		const wordMap: Record<string, vscode.Range> = {};

		for (let line = 0; line < document.lineCount; line++) {
			const lineText = document.lineAt(line);
			lineText.text.match(/"[\S]+"[\s]*:/g)?.forEach((text, idx) => {
				text = text.substring(text.indexOf('"') + 1, text.lastIndexOf('"'));
				if (!keys.includes(text)) {
					return;
				}
				wordMap[text] = this.getRange(new vscode.Position(line, idx));
			});
		}
		return wordMap;
	}
}
