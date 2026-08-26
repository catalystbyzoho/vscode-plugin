import { commands, workspace } from 'vscode';
import { access, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';
import { resolve, sep } from 'path';
import type { ICatalystJson } from './util_types/config';
import _runtime from 'zcatalyst-cli/lib/util_modules/runtime-store';
import { isWindows } from './catalyst';
import { TCatalystTreeViews } from './tree_view';

export function getWorkSpaceRoot(): string {
	if (!workspace.workspaceFolders) {
		throw new Error('Unable to find the workspace root');
	}
	const workspaceRoot = workspace.workspaceFolders[0].uri.fsPath;
	if (isWindows) {
		const workspaceRootArr = workspaceRoot.split(':');
		return workspaceRootArr[0].toUpperCase() + ':' + workspaceRootArr[1];
	}
	return workspaceRoot;
}
/**
 * Resolve `segments` relative to `root` and verify the resulting path stays
 * inside `root`. Prevents path traversal (e.g. via `../`) when segments are
 * sourced from untrusted/workspace-controlled configuration such as
 * `catalyst.json`.
 *
 * @throws Error if the resolved path escapes the root
 */
export function resolveSafePath(root: string, ...segments: Array<string>): string {
	const resolvedRoot = resolve(root);
	const target = resolve(resolvedRoot, ...segments);
	if (target !== resolvedRoot && !target.startsWith(resolvedRoot + sep)) {
		throw new Error(
			`Resolved path "${target}" is outside of the expected root "${resolvedRoot}"`
		);
	}
	return target;
}

// if possible replace with vscode apis
export async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
	} catch (e) {
		return false;
	}
	return true;
}

export enum PATH_TYPE {
	FILE = 'file',
	SYMLINK = 'symlink',
	DIRECTORY = 'directory',
	SOCKET = 'socket',
	NOT_EXISTS = 'not a file'
}
export async function pathSpec(path: string): Promise<PATH_TYPE> {
	try {
		const stats = await stat(path);
		switch (true) {
			case stats.isDirectory(): {
				return PATH_TYPE.DIRECTORY;
			}
			case stats.isFile(): {
				return PATH_TYPE.FILE;
			}
			case stats.isSymbolicLink(): {
				return PATH_TYPE.SYMLINK;
			}
			case stats.isSocket(): {
				return PATH_TYPE.SOCKET;
			}
		}
		return PATH_TYPE.NOT_EXISTS;
	} catch (er) {
		return PATH_TYPE.NOT_EXISTS;
	}
}

// if possible replace with vscode apis
export async function readJsonFile<T>(path: string, throwErr = false): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(path, 'utf-8')) as T;
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Error reading file: ' + err);
		if (throwErr) {
			throw err;
		}
	}
}

// if possible replace with vscode apis
/**
 * Writes JSON atomically by writing to a temporary sibling file and
 * renaming it over the destination, so readers never observe a partially
 * written (truncated/corrupt) configuration file.
 */
export async function writeJsonFile(path: string, jsonObject: unknown) {
	const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
	try {
		await writeFile(tmpPath, JSON.stringify(jsonObject, undefined, 2) + '\n');
		await rename(tmpPath, path);
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Error writing file: ' + err);
		await unlink(tmpPath).catch(() => undefined);
	}
}

export async function refreshTreeView({
	catalystJson,
	view = 'config'
}: {
	catalystJson?: ICatalystJson;
	view?: TCatalystTreeViews;
} = {}): Promise<unknown> {
	switch (view) {
		case 'httpFn': {
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

export async function timeOut(ms: number) {
	return new Promise((res) => {
		setTimeout(res, ms);
	});
}

/**
 * Evaluate whether the given element is empty
 * -
 * - string: empty string or empty string with trim
 * - array: length based check
 * - object: keys length check
 *
 * @param ele element to check if its empty
 * @returns whether the given element is empty
 */
export function isEmpty(ele: object | string | Array<unknown>): boolean {
	if (typeof ele === 'string') {
		if (!ele || !ele.trim()) {
			return true;
		}
		return false;
	}
	if (Array.isArray(ele) && ele.length === 0) {
		return true;
	}
	if (Object.keys(ele).length === 0) {
		return true;
	}
	return false;
}

export const runtime = new _runtime('zcatalyst-vscode');

export type WrappedPromise<T> = {
	promise: Promise<T>;
	isFulfilled: boolean;
	isResolved: boolean;
	isRejected: boolean;
};

/**
 * A wrapper around a promise to track its state
 * @param promise
 * @returns
 */
export function promiseWrapper<T>(promise: Promise<T>): WrappedPromise<T> {
	let _isFulfilled = false;
	let _isResolved = false;
	let _isRejected = false;

	promise.then(
		() => {
			_isFulfilled = true;
			_isResolved = true;
		},
		() => {
			_isFulfilled = true;
			_isRejected = true;
		}
	);

	return {
		promise,
		get isResolved() {
			return _isResolved;
		},
		get isRejected() {
			return _isRejected;
		},
		get isFulfilled() {
			return _isFulfilled;
		}
	};
}

export const compIconMap = Object.freeze({
	basicio: '$(zcatalyst-bio)',
	advancedio: '$(zcatalyst-aio)',
	integration: '$(zcatalyst-integ)',
	browser_logic: '$(zcatalyst-browserlogic)',
	cron: '$(zcatalyst-cron)',
	event: '$(zcatalyst-event)',
	apig: '$(zcatalyst-apig)',
	client: '$(zcatalyst-client)'
});

export async function setContext(key: string, value: unknown) {
	return commands.executeCommand('setContext', 'zcatalyst.' + key, value);
}

export function isNumber(numStr: string): boolean {
	try {
		const num = Number.parseInt(numStr);
		if (num + '' !== numStr) {
			return false;
		}
		return Number.isInteger(num);
	} catch (er) {
		return false;
	}
}
