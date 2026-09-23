import { Uri, window } from 'vscode';
import { TOutput } from '../../inputs';
import { exists, safeRemove } from '../../utils';

const keyWords = Object.freeze([
	'abstract',
	'assert',
	'boolean',
	'break',
	'byte',
	'case',
	'catch',
	'char',
	'class',
	'const',
	'continue',
	'default',
	'do',
	'double',
	'else',
	'enum',
	'extends',
	'false',
	'final',
	'finally',
	'float',
	'for',
	'goto',
	'if',
	'implements',
	'import',
	'instanceof',
	'int',
	'interface',
	'long',
	'native',
	'new',
	'null',
	'package',
	'private',
	'protected',
	'public',
	'return',
	'short',
	'static',
	'strictfp',
	'super',
	'switch',
	'synchronized',
	'this',
	'throw',
	'throws',
	'transient',
	'true',
	'try',
	'void',
	'volatile',
	'while'
]);

function containsKeyWord(name: string): boolean {
	return keyWords.some((keyWord) => {
		if (
			name === keyWord ||
			name.endsWith('.' + keyWord) ||
			name.startsWith(keyWord + '.') ||
			name.includes('.' + keyWord + '.')
		) {
			return true;
		}
		return false;
	});
}

export function isValidClassName(name: string): boolean {
	if (!name || !name.trim() || !name.match(/^[A-Z].+$/) || containsKeyWord(name)) {
		return false;
	}
	return true;
}

export async function overwrite(
	root: string,
	name: string,
	path: string,
	{ dir = true } = {}
) {
	const fnExists = await exists(path);
	if (fnExists) {
		const typeName = dir ? 'Folder' : 'File';
		const overwrite = await window.showWarningMessage(
			`${typeName} with the name ${name} already exists.\nDo you want to delete the ${typeName.toLowerCase()}?`,
			'Delete'
		);
		if (overwrite === 'Delete') {
			try {
				await safeRemove(root, path, { recursive: dir });
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error(`Error when deleting the ${typeName}: ` + path, (err as Error).stack);
				window.showErrorMessage(
					`Unable to delete the ${typeName} (${path}).${
						err instanceof Error ? ' Reason: ' + err.message : ''
					}`
				);
			}
			return true;
		}
		return false;
	}
	return true;
}

export class FnDetails {
	constructor(private details: TOutput<unknown>) {}

	private nodeFnDetails() {
		return {
			name: this.details.pkgName as string,
			main: this.details.entry as string,
			author: this.details.author as string,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			NPMinstall: this.details.nodeNpmInstall
		};
	}

	private javaFnDetails() {
		return {
			class: this.details.class as string,
			name: this.details.name as string
		};
	}

	private pythonFnDetails() {
		return {
			name: this.details.name,
			main: this.details.main
		};
	}

	private getLangFnDetails() {
		switch ((this.details.runtime as Array<Record<string, string>>).at(0)?.lang) {
			case 'node': {
				return this.nodeFnDetails();
			}
			case 'java': {
				return this.javaFnDetails();
			}
			case 'python': {
				return this.pythonFnDetails();
			}
		}
	}

	getDetails() {
		const langDetails = this.getLangFnDetails();
		const fnType = (this.details.fnType as Array<string>)[0];
		const _runtime = (this.details.runtime as Array<{ runtime: string; lang: string }>).at(0);
		const framework =
			fnType === 'browser_logic' && _runtime?.lang === 'java'
				? 'Selenium'
				: (this.details.framework as Array<string>)?.at(0);
		return {
			type: fnType,
			runtime: _runtime?.runtime,
			service:
				this.details.integService !== undefined
					? (this.details.integService as Array<string>)[0]
					: undefined,
			selectionAnswer: this.details.cliqHandlers,
			framework,
			...langDetails
		};
	}
}

export class AppSailDetails {
	constructor(private details: TOutput<unknown>, private source: Uri) {}

	getDetails() {
		const stack = Array.isArray(this.details.runtime)
			? this.details.runtime.at(0).runtime
			: this.details.runtime;
		return {
			name: this.details.name,
			source: this.source.fsPath,
			runtime: stack,
			platform: this.details.platform, // for java appSails
			path: '', // build path
			appConfig: true // always overwrite app-config.json
		};
	}
}

export class ClientDetails {
	constructor(private details: TOutput<unknown>) {}

	private angularDetails() {
		return {
			routing: this.details.angularAppRouting,
			stylesheet: (this.details.angularAppStyleSheetFormat as Array<string>)[0]
		};
	}

	private reactDetails() {
		return {
			flavour: (this.details.reactLang as Array<string>)[0]
		};
	}

	getDetails() {
		const clientType = (this.details.clientType as Array<string>)[0];
		const clientDetails =
			clientType === 'ANGULAR'
				? this.angularDetails()
				: clientType === 'REACT'
				? this.reactDetails()
				: {};
		return {
			clientFlavour: clientType,
			name: this.details.clientName as string,
			...clientDetails
		};
	}
}
