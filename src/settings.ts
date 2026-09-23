import { Disposable, WorkspaceConfiguration, window, workspace, ConfigurationTarget } from 'vscode';
import { access, lstat, realpath } from 'fs/promises';
import { constants } from 'fs';
import { requireTrustedWorkspace } from './commands/utils.js';
import { store, cliRuntime, isWindows } from './catalyst';
import {
	exists,
	pathSpec,
	PATH_TYPE,
	APPROVED_NODE_ROOTS,
	APPROVED_PYTHON_ROOTS,
	APPROVED_JAVA_ROOTS,
	APPROVED_BROWSER_ROOTS,
	assertSecureOwnership,
} from './utils';
import { basename, dirname, isAbsolute, join, sep } from 'path';

/**
 * Throws if `canonical` (a resolved absolute path) resides inside any open
 * workspace folder. Workspace-local paths are the primary attack vector for
 * a hostile repository injecting an executable through settings.json.
 */
function assertNotInWorkspace(canonical: string, label: string): void {
	const folders = workspace.workspaceFolders ?? [];
	if (folders.some((f) => canonical === f.uri.fsPath || canonical.startsWith(f.uri.fsPath + sep))) {
		throw new Error(
			`${label} must not reside inside the workspace. ` +
				`Configure an absolute path to a system-installed binary.`
		);
	}
}

/**
 * Resolves, validates, and returns the canonical path for a runtime executable.
 * Performs these checks in order:
 *   1. Configured path must be absolute
 *   2. Must resolve via realpath() (no dead symlinks)
 *   3. Resolved target must be a regular file
 *   4. Must have execute permission
 *   5. Must not reside inside an open workspace folder
 *   6. Must be inside an approved installation root for this runtime family
 *   7. File's parent directories must not be group- or world-writable (POSIX only)
 * Returns the canonical path on success; throws a descriptive error on any failure.
 */
async function validateRuntimeExecutable(
	configuredPath: string,
	label: string,
	approvedRoots: readonly string[]
): Promise<string> {
	if (!configuredPath || !isAbsolute(configuredPath)) {
		throw new Error(`${label}: path must be absolute`);
	}
	let canonical: string;
	try {
		canonical = await realpath(configuredPath);
	} catch {
		throw new Error(`${label}: cannot resolve "${configuredPath}"`);
	}
	// realpath() resolves all symlinks; lstat on the result behaves like stat
	const stats = await lstat(canonical);
	if (!stats.isFile()) {
		throw new Error(`${label}: resolved path is not a regular file`);
	}
	await access(canonical, constants.X_OK);
	assertNotInWorkspace(canonical, label);
	if (!approvedRoots.some((r) => canonical === r || canonical.startsWith(r))) {
		throw new Error(`${label}: must be installed in an approved system location`);
	}
	await assertSecureOwnership(canonical, approvedRoots, label);
	return canonical;
}

// browser_logic settings
async function setBrowserLogicConfigs(settings: WorkspaceConfiguration) {
	if (!requireTrustedWorkspace()) {
		return;
	}
	const chromeExecutable = settings.get<string>('chromeExecutable');
	if (chromeExecutable) {
		try {
			const resolved = await validateRuntimeExecutable(
				chromeExecutable,
				'Chrome executable',
				APPROVED_BROWSER_ROOTS
			);
			cliRuntime.set('CHROME_EXECUTABLE', resolved);
		} catch (err) {
			window.showErrorMessage(
				`The path "${chromeExecutable}" is not accessible or not trusted for ` +
					`"zcatalyst.chromeExecutable": ${(err as Error).message}`
			);
			return;
		}
	}
	const chromeDriverExecutable = settings.get<string>('chromeDriverExecutable');
	if (chromeDriverExecutable) {
		try {
			const resolved = await validateRuntimeExecutable(
				chromeDriverExecutable,
				'ChromeDriver executable',
				APPROVED_BROWSER_ROOTS
			);
			cliRuntime.set('CHROME_DRIVER_EXECUTABLE', resolved);
		} catch (err) {
			window.showErrorMessage(
				`The path "${chromeDriverExecutable}" is not accessible or not trusted for ` +
					`"zcatalyst.chromeDriverExecutable": ${(err as Error).message}`
			);
		}
	}
}

async function setJavaRuntimeExeConfigs(settings: WorkspaceConfiguration, javaVersion: string) {
	if (!requireTrustedWorkspace()) {
		return;
	}
	let javaBin = settings.get<string>(javaVersion);
	if (typeof javaBin !== 'string') {
		return;
	}
	if (javaBin === '') {
		cliRuntime.set(`executables.${javaVersion}.bin`, '');
		return;
	}
	const _pathSpec = await pathSpec(javaBin);
	if (_pathSpec === PATH_TYPE.FILE && basename(javaBin) === 'java') {
		javaBin = dirname(javaBin);
	}
	const resolvedJava = await validateRuntimeExecutable(
		join(javaBin, 'java' + (isWindows ? '.exe' : '')),
		'Java runtime (java)',
		APPROVED_JAVA_ROOTS
	);
	await validateRuntimeExecutable(
		join(javaBin, 'javac' + (isWindows ? '.exe' : '')),
		'Java compiler (javac)',
		APPROVED_JAVA_ROOTS
	);
	// Store the canonical bin directory (dirname of canonical binary), not the original path
	cliRuntime.set(`executables.${javaVersion}.bin`, dirname(resolvedJava));
}

async function setPythonRuntimeConfig(settings: WorkspaceConfiguration) {
	if (!requireTrustedWorkspace()) {
		return;
	}
	const pythonBin = settings.get<string>('python_3_9');
	if (typeof pythonBin !== 'string') {
		return;
	}
	if (pythonBin === '') {
		cliRuntime.set('executables.python3_9.bin', '');
		return;
	}
	const resolved = await validateRuntimeExecutable(
		pythonBin,
		'Python runtime path',
		APPROVED_PYTHON_ROOTS
	);
	cliRuntime.set('executables.python3_9.bin', resolved);
}

async function setNodeRuntimeConfig(settings: WorkspaceConfiguration, nodeVersion: string) {
	if (!requireTrustedWorkspace()) {
		return;
	}
	const nodeBin = settings.get<string>(nodeVersion);
	if (typeof nodeBin !== 'string') {
		return;
	}
	if (nodeBin === '') {
		cliRuntime.set(`executables.${nodeVersion}.bin`, '');
		return;
	}
	const resolved = await validateRuntimeExecutable(
		nodeBin,
		'NodeJS runtime path',
		APPROVED_NODE_ROOTS
	);
	cliRuntime.set(`executables.${nodeVersion}.bin`, resolved);
}

async function setRuntimeExecutablesConfigs(settings: WorkspaceConfiguration) {
	try {
		await Promise.all(
			['java8', 'java11', 'java17'].map((javaRuntime) =>
				setJavaRuntimeExeConfigs(settings, javaRuntime)
			)
		);
	} catch (er) {
		window.showErrorMessage(
			'Unable to set the java runtime configs: ' + (er as Error)?.message
		);
	}

	try {
		await Promise.all(
			['node12', 'node14', 'node16', 'node18', 'node20'].map((nodeRuntime) =>
				setNodeRuntimeConfig(settings, nodeRuntime)
			)
		);
	} catch (er) {
		window.showErrorMessage(
			'Unable to set the nodejs runtime configs: ' + (er as Error)?.message
		);
	}

	// continue setting python config
	setPythonRuntimeConfig(settings);
}

const FILES_TO_EXCLUDE = { '.build/**': true, '**/.output/**': true };

export default function initializeSettings() {
	// add files to exclude settings
	const _ = workspace.getConfiguration();
	_.update('files.exclude', FILES_TO_EXCLUDE, ConfigurationTarget.Workspace);

	const settings = workspace.getConfiguration('zcatalyst');

	// credential settings
	const path = settings.get<Array<string>>('credentialsPath');
	if (!path) {
		settings.update('credentialsPath', store.path, true);
	} else if (path[0] !== store.path) {
		store.changeStore('vscode', path[0]);
	}

	setBrowserLogicConfigs(settings);

	setRuntimeExecutablesConfigs(settings);

	const disposables = [] as Array<Disposable>;

	disposables.push(
		workspace.onDidChangeConfiguration(async (e) => {
			const _settings = workspace.getConfiguration('zcatalyst');
			const isCredPathAffected = e.affectsConfiguration('zcatalyst.credentialsPath');
			if (isCredPathAffected) {
				const path = _settings.get<Array<string>>('credentialsPath');
				if (!path || !path[0]) {
					window.showInformationMessage('Credentials storage path changed to default');
					store.changeStore('vscode');
					_settings.update('credentialsPath', [store.path], true);
					return;
				}
				if (path[0] === store.path) {
					return;
				}
				const isPath = await exists(path[0]);
				if (!isPath) {
					window.showErrorMessage(
						`The path ${path} is not accessible. Please provide a valid path.`
					);
					_settings.update('credentialsPath', '', true);
					return;
				}
				store.changeStore('vscode', path[0]);
				window.showInformationMessage('Credentials storage path successfully changed');
			}
		}),
		workspace.onDidChangeConfiguration(async (e) => {
			const _settings = workspace.getConfiguration('zcatalyst');
			(e.affectsConfiguration('zcatalyst.chromeExecutable') ||
				e.affectsConfiguration('zcatalyst.chromeDriverExecutable')) &&
				setBrowserLogicConfigs(_settings);
		}),
		workspace.onDidChangeConfiguration(async (e) => {
			const _settings = workspace.getConfiguration('zcatalyst');
			try {
				await Promise.all(
					['java8', 'java11', 'java17'].map(
						(java) =>
							e.affectsConfiguration('zcatalyst.' + java) &&
							setJavaRuntimeExeConfigs(_settings, java)
					)
				);
				await Promise.all(
					['node12', 'node14', 'node16', 'node18', 'node20'].map(
						(node) =>
							e.affectsConfiguration('zcatalyst.' + node) &&
							setNodeRuntimeConfig(_settings, node)
					)
				);
				e.affectsConfiguration('zcatalyst.python_3_9') &&
					(await setPythonRuntimeConfig(_settings));
			} catch (er) {
				window.showErrorMessage(
					'Unable to set the java runtime configs: ' + (er as Error)?.message
				);
			}
		})
	);
	return disposables;
}
