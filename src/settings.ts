import { Disposable, WorkspaceConfiguration, window, workspace, ConfigurationTarget } from 'vscode';
import { store, cliRuntime, isWindows } from './catalyst';
import { exists, pathSpec, PATH_TYPE } from './utils';
import { basename, dirname, join } from 'path';

// browser_logic settings
async function setBrowserLogicConfigs(settings: WorkspaceConfiguration) {
	const chromeExecutable = settings.get<string>('chromeExecutable');
	if (chromeExecutable) {
		if (await exists(chromeExecutable)) {
			cliRuntime.set('CHROME_EXECUTABLE', chromeExecutable);
		} else {
			window.showErrorMessage(
				`The path "${chromeExecutable}" is not accessible. Please provide a valid path for "zcatalyst.chromeExecutable"`
			);
			return;
		}
	}
	const chromeDriverExecutable = settings.get<string>('chromeDriverExecutable');
	if (chromeDriverExecutable) {
		if (await exists(chromeDriverExecutable)) {
			cliRuntime.set('CHROME_DRIVER_EXECUTABLE', chromeDriverExecutable);
		} else {
			window.showErrorMessage(
				`The path "${chromeDriverExecutable}" is not accessible. Please provide a valid path for "zcatalyst.chromeDriverExecutable"`
			);
		}
	}
}

async function setJavaRuntimeExeConfigs(settings: WorkspaceConfiguration, javaVersion: string) {
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
	const isJavaExe = await exists(join(javaBin, 'java' + (isWindows ? '.exe' : '')));
	if (!isJavaExe) {
		throw new Error(
			'Unable to identify the java executable file in the provided path for ' +
				javaVersion +
				' config'
		);
	}
	const isJavacExe = await exists(join(javaBin, 'javac' + (isWindows ? '.exe' : '')));
	if (!isJavacExe) {
		throw new Error(
			'Unable to identify the javac executable file in the provided path for ' +
				javaVersion +
				' config'
		);
	}
	cliRuntime.set(`executables.${javaVersion}.bin`, javaBin);
}

async function setPythonRuntimeConfig(settings: WorkspaceConfiguration) {
	const pythonBin = settings.get<string>('python_3_9');
	if (typeof pythonBin !== 'string') {
		return;
	}
	if (pythonBin === '') {
		cliRuntime.set('executables.python3_9.bin', '');
		return;
	}
	const _pathSpec = await pathSpec(pythonBin);
	if (_pathSpec !== PATH_TYPE.FILE && _pathSpec !== PATH_TYPE.SYMLINK) {
		throw new Error('Invalid Python executable path');
	}
	cliRuntime.set('executables.python3_9.bin', pythonBin);
}

async function setNodeRuntimeConfig(settings: WorkspaceConfiguration, nodeVersion: string) {
	const nodeBin = settings.get<string>(nodeVersion);
	if (typeof nodeBin !== 'string') {
		return;
	}
	if (nodeBin === '') {
		cliRuntime.set(`executables.${nodeVersion}.bin`, '');
		return;
	}
	const _pathSpec = await pathSpec(nodeBin);
	if (_pathSpec !== PATH_TYPE.FILE && _pathSpec !== PATH_TYPE.SYMLINK) {
		throw new Error('Invalid NodeJS executable path');
	}
	cliRuntime.set(`executables.${nodeVersion}.bin`, nodeBin);
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
