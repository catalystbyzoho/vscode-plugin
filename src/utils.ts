import { commands, workspace } from 'vscode';
import { access, lstat, readFile, realpath, rename, rm, stat, unlink, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { randomBytes } from 'crypto';
import { homedir } from 'os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';
import type { ICatalystJson } from './util_types/config';
import _runtime from 'zcatalyst-cli/lib/util_modules/runtime-store';
import { isWindows } from './catalyst';
import { TCatalystTreeViews } from './tree_view';

const _home = homedir();

export const APPROVED_NODE_ROOTS: readonly string[] = isWindows
	? ['C:\\Program Files\\nodejs\\', 'C:\\Program Files (x86)\\nodejs\\']
	: [
			'/usr/local/',
			'/usr/',
			'/opt/homebrew/',
			'/opt/local/',
			'/nix/',
			'/snap/',
			_home + '/.nvm/',
			_home + '/.volta/',
			_home + '/.fnm/',
	  ];

export const APPROVED_PYTHON_ROOTS: readonly string[] = isWindows
	? ['C:\\Python', 'C:\\Program Files\\Python', 'C:\\Program Files (x86)\\Python']
	: [
			'/usr/local/',
			'/usr/',
			'/opt/homebrew/',
			'/opt/local/',
			'/nix/',
			_home + '/.pyenv/',
			_home + '/anaconda3/',
			_home + '/miniconda3/',
	  ];

export const APPROVED_JAVA_ROOTS: readonly string[] = isWindows
	? ['C:\\Program Files\\Java\\', 'C:\\Program Files\\Eclipse Adoptium\\']
	: ['/usr/local/', '/usr/', '/opt/', '/Library/Java/', '/System/Library/Java/'];

export const APPROVED_BROWSER_ROOTS: readonly string[] = isWindows
	? ['C:\\Program Files\\', 'C:\\Program Files (x86)\\']
	: ['/Applications/', '/usr/local/', '/usr/', '/opt/homebrew/', '/opt/'];

/**
 * Walks from dirname(canonical) up to the matching approved-root boundary and
 * throws if any directory has group- or world-writable mode bits (0o022).
 *
 * On Windows, lstat() returns synthetic POSIX-style mode bits (0o666/0o777)
 * that do not reflect ACLs. The check is skipped there; the approved-root
 * allowlist is the primary guard on Windows.
 */
export async function assertSecureOwnership(
	canonical: string,
	approvedRoots: readonly string[],
	label: string
): Promise<void> {
	if (isWindows) {
		return;
	}
	const boundary = approvedRoots.find((r) => canonical === r || canonical.startsWith(r));
	if (!boundary) {
		throw new Error(`${label}: path is not within any approved root`);
	}
	let toCheck = dirname(canonical);
	while (toCheck !== boundary && toCheck.startsWith(boundary)) {
		const stats = await lstat(toCheck);
		if (stats.mode & 0o022) {
			throw new Error(
				`${label}: "${toCheck}" is group- or world-writable — unsafe executable location`
			);
		}
		toCheck = dirname(toCheck);
	}
}

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
 * inside `root`, guarding against both `../` traversal and symlink-based
 * escapes (e.g. a workspace-controlled `catalyst.json` pointing a source
 * folder at a symlink whose target lies outside `root`).
 *
 * Lexical resolution alone (`path.resolve` + `startsWith`) is insufficient:
 * if any intermediate path segment is a symlink, the real filesystem target
 * can be outside `root` even though the lexical path looks contained. To
 * catch this, we canonicalize using `fs.realpath` on the nearest *existing*
 * ancestor of the target (the target itself may not exist yet, e.g. a new
 * function about to be created) and re-verify containment against the
 * canonical root.
 *
 * @throws Error if the resolved path escapes the root
 */
export async function resolveSafePath(root: string, ...segments: Array<string>): Promise<string> {
	const resolvedRoot = resolve(root);
	const target = resolve(resolvedRoot, ...segments);
	if (target !== resolvedRoot && !target.startsWith(resolvedRoot + sep)) {
		throw new Error(
			`Resolved path "${target}" is outside of the expected root "${resolvedRoot}"`
		);
	}

	const canonicalRoot = await realpath(resolvedRoot).catch(() => resolvedRoot);

	// Walk up from `target` to find the nearest existing ancestor, so we can
	// canonicalize through any symlinked intermediate directories even when
	// the leaf itself does not exist yet.
	let ancestor = target;
	while (true) {
		try {
			const canonicalAncestor = await realpath(ancestor);
			const remainder = relative(ancestor, target);
			const canonicalTarget = remainder
				? resolve(canonicalAncestor, remainder)
				: canonicalAncestor;
			if (
				canonicalTarget !== canonicalRoot &&
				!canonicalTarget.startsWith(canonicalRoot + sep)
			) {
				throw new Error(
					`Resolved path "${canonicalTarget}" escapes the expected root "${canonicalRoot}" through a symlink`
				);
			}
			break;
		} catch (err) {
			if (err instanceof Error && err.message.includes('escapes the expected root')) {
				throw err;
			}
			const parent = dirname(ancestor);
			if (parent === ancestor) {
				// Reached the filesystem root without finding an existing
				// path; nothing left to canonicalize/verify.
				break;
			}
			ancestor = parent;
		}
	}

	return target;
}

/**
 * Recursively deletes `target`, but only after verifying — via `realpath`
 * performed immediately before the `rm()` call — that `target` both exists,
 * is not itself a symlink, and canonically resolves inside `root`.
 *
 * This exists because `lstat()` on `target` alone does not detect a
 * symlinked *parent* directory redirecting an otherwise normal-looking
 * target outside the intended root, and does not close the gap between
 * validating a path and deleting it. Re-resolving with `realpath()` right
 * before `rm()` shrinks (it cannot fully eliminate) that race window.
 *
 * @throws Error if `target` does not exist, is a symlink, or escapes `root`
 */
export async function safeRemove(
	root: string,
	target: string,
	{ recursive = true }: { recursive?: boolean } = {}
): Promise<void> {
	const resolvedRoot = resolve(root);
	const resolvedTarget = resolve(target);
	if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + sep)) {
		throw new Error(
			`Refusing to delete "${resolvedTarget}": outside of the expected root "${resolvedRoot}"`
		);
	}

	const stats = await lstat(resolvedTarget).catch(() => undefined);
	if (!stats) {
		return;
	}
	if (stats.isSymbolicLink()) {
		throw new Error(`Refusing to delete "${resolvedTarget}": target is a symbolic link`);
	}

	const canonicalRoot = await realpath(resolvedRoot);
	const canonicalTarget = await realpath(resolvedTarget);
	if (canonicalTarget !== canonicalRoot && !canonicalTarget.startsWith(canonicalRoot + sep)) {
		throw new Error(
			`Refusing to delete "${resolvedTarget}": resolves to "${canonicalTarget}", ` +
				`outside of the expected root "${canonicalRoot}" through a symlinked parent`
		);
	}

	// Reject the operation if any intermediate directory between the canonical
	// root and the target is group- or world-writable. A writable parent makes
	// the TOCTOU race window between realpath() and rm() exploitable by a
	// concurrent local process that can swap the path underneath us.
	let dirToCheck = dirname(canonicalTarget);
	while (dirToCheck !== canonicalRoot && dirToCheck.startsWith(canonicalRoot + sep)) {
		const dirStats = await lstat(dirToCheck);
		// S_IWGRP (0o020) | S_IWOTH (0o002)
		if (dirStats.mode & 0o022) {
			throw new Error(
				`Refusing to delete "${resolvedTarget}": intermediate directory ` +
					`"${dirToCheck}" is group- or world-writable`
			);
		}
		dirToCheck = dirname(dirToCheck);
	}

	// Accepted residual risk: Node.js does not expose descriptor-relative
	// deletion APIs (unlinkat), so the realpath()→rm() sequence cannot be
	// made fully atomic. The parent write-bit check above eliminates the
	// practical attack surface; this window cannot be narrowed further
	// without OS-level APIs unavailable in Node.js.
	await rm(canonicalTarget, { recursive, force: true });
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

let _trustedNodeExecutable: Promise<string | undefined> | undefined;

/**
 * Resolve a trusted, absolute path to a real Node.js executable, without ever
 * mutating the global, shared `process.execPath`.
 *
 * In the VS Code desktop extension host, `process.execPath` points at the
 * Code/Electron binary rather than a plain Node runtime, so it cannot be used
 * directly to spawn Node child processes (e.g. the terminal adapter, or CLI
 * function execution). In that case, resolve the real Node binary once via a
 * single explicit, non-shell lookup, validate the result is an absolute,
 * existing file, and cache it for the lifetime of the extension host so
 * every caller shares one vetted path instead of each independently
 * resolving an unqualified `node` command (which is susceptible to `PATH`
 * hijacking).
 */
export function getTrustedNodeExecutable(): Promise<string | undefined> {
	if (_trustedNodeExecutable) {
		return _trustedNodeExecutable;
	}
	_trustedNodeExecutable = (async () => {
		if (!process.versions.electron) {
			// Already a genuine Node process. Canonicalize to satisfy the
			// "return canonical path" requirement even on this fast path.
			return realpath(process.execPath).catch(() => process.execPath);
		}
		// In Electron-hosted VS Code, process.execPath is the Code/Electron binary,
		// not a standalone node. Find node by probing each PATH directory explicitly
		// rather than spawning an unqualified 'node' command (which is resolved by the
		// OS and is susceptible to PATH hijacking). Relative PATH entries are skipped
		// unconditionally so that '.' or '../bin' cannot be used to inject a binary.
		const pathSep = isWindows ? ';' : ':';
		const nodeName = isWindows ? 'node.exe' : 'node';
		for (const dir of (process.env.PATH ?? '').split(pathSep)) {
			if (!dir || !isAbsolute(dir)) continue;
			const candidate = join(dir, nodeName);
			if (!await exists(candidate)) continue;
			const spec = await pathSpec(candidate);
			if (spec !== PATH_TYPE.FILE && spec !== PATH_TYPE.SYMLINK) continue;

			const canonical = await realpath(candidate).catch(() => undefined);
			if (!canonical) continue;
			// Verify the resolved target is a regular file — a symlink pointing to a
			// directory also passes access(X_OK), so we must check after realpath().
			const canonicalSpec = await pathSpec(canonical);
			if (canonicalSpec !== PATH_TYPE.FILE) continue;
			if (!APPROVED_NODE_ROOTS.some((r) => canonical === r || canonical.startsWith(r))) continue;
			try {
				await access(canonical, constants.X_OK);
				await assertSecureOwnership(canonical, APPROVED_NODE_ROOTS, 'Node.js executable');
			} catch {
				continue;
			}
			return canonical;
		}
		return undefined;
	})();
	return _trustedNodeExecutable;
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
		const stats = await lstat(path);
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
export interface ICliLogChunk {
	data: string;
	command: string;
}

/**
 * Safely parses a raw CLI log chunk. The external CLI is not guaranteed to
 * emit exactly one well-formed JSON object per data event (records may be
 * partial, malformed, or plain text), so this must never throw.
 * Returns undefined for anything that is not a valid `{ data, command }` object.
 */
export function parseCliLogChunk(chunk: Buffer | string): ICliLogChunk | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(chunk.toString());
	} catch {
		return undefined;
	}
	if (
		typeof parsed === 'object' &&
		parsed !== null &&
		typeof (parsed as ICliLogChunk).data === 'string' &&
		typeof (parsed as ICliLogChunk).command === 'string'
	) {
		return parsed as ICliLogChunk;
	}
	return undefined;
}

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
		throw err;
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
