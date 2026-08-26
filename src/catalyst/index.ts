import _store from 'zcatalyst-cli/lib/util_modules/config-store';

export const store = _store;
store.changeStore('vscode');

import { dirname, isAbsolute, join } from 'path';
import { Catalyst } from 'zcatalyst-cli/lib/index';
import CatalystError from 'zcatalyst-cli/lib/error/index';
import { LogStreamFactory } from 'zcatalyst-cli/lib/util_modules/logger';
import { serverEvent as _serverEvent } from 'zcatalyst-cli/lib/serve/server/lib/master/utils';
import { DeployEvents as _deployEvent } from 'zcatalyst-cli/lib/deploy/util';
import { getActiveDC } from 'zcatalyst-cli/lib/util_modules/dc';
import { isWindows as _isWin } from 'zcatalyst-cli/lib/util_modules/env';
import _cliRuntime from 'zcatalyst-cli/lib/runtime-store';
import * as _endpoints from 'zcatalyst-cli/lib/endpoints/index';
import { verbose } from 'zcatalyst-cli/lib/util_modules/logger/winston';
import * as CONSTANTS from 'zcatalyst-cli/lib/util_modules/constants/index';
import { runtime, exists, readJsonFile, getWorkSpaceRoot } from '../utils';
import { ICatalystJson } from '../util_types/config';
import login from 'zcatalyst-cli/lib/authentication/login';
import { ensureNodeVersion } from 'zcatalyst-cli/lib/fn-utils/lib/node';
export type { IServerDetails } from 'zcatalyst-cli/lib/serve/server';
export type { TAppSailServerDetails } from 'zcatalyst-cli/lib/serve/features/appsail';
export type { IFnTarget } from 'zcatalyst-cli/lib/fn-utils/lib/common';
export type { IClientTarget } from 'zcatalyst-cli/lib/serve/server/lib/web_client/types';

export type ICatalystResult = {
	exitCode: 0 | 1 | 2;
	error?: CatalystError;
};

export interface ICatalystFnRuntime {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	eol_runtimes?: Record<string, number>;
	runtimes: Array<string>;
}

export const isWindows = _isWin;

export async function findCatalystRoot(fallback: string = getWorkSpaceRoot()): Promise<string> {
	const catalystJsonFile = 'catalyst.json';
	let workspaceRoot = getWorkSpaceRoot();

	do {
		const catalystJsonPath = join(workspaceRoot, catalystJsonFile);
		const isCatalystJson = await exists(catalystJsonPath);
		if (isCatalystJson) {
			return workspaceRoot;
		}
		workspaceRoot = dirname(workspaceRoot);
	} while (workspaceRoot !== dirname(workspaceRoot));

	if (!fallback) {
		throw new Error('Unable to get the Catalyst root: Fallback: ' + fallback);
	}
	return fallback;
}

export function getCatalystRoot(): string {
	return runtime.get('catalyst.root', getWorkSpaceRoot());
}

export async function getCatalystJson({
	catalystRoot = getCatalystRoot(),
	refresh = false,
	config
}: { catalystRoot?: string; refresh?: boolean; config?: ICatalystJson } = {}): Promise<
	ICatalystJson | undefined
> {
	if (!refresh) {
		return runtime.get('context.catalyst_json');
	}
	const catalystJsonFile = join(catalystRoot, 'catalyst.json');
	const catalystJson = config || (await readJsonFile<ICatalystJson>(catalystJsonFile));
	// process catalystJSON entries
	// AppSail - convert source paths to absolute path
	catalystJson?.appsail?.forEach((sail) => {
		sail.source = isAbsolute(sail.source) ? sail.source : join(catalystRoot, sail.source);
	});
	runtime.set('context.catalyst_json', catalystJson);
	return catalystJson;
}

export function getUserDetails(): Record<string, unknown> {
	return store.get(`${getActiveDC()}.user`, undefined) as Record<string, unknown>;
}

export const log = LogStreamFactory.getStream();

export const serverEvent = _serverEvent;
export const deployEvent = _deployEvent;

export const cliRuntime = _cliRuntime;

// export const catalyst = Catalyst;

const executionLock = new Map<string, Promise<unknown>>();

export const catalystExec = (...args: Parameters<typeof Catalyst.exec>) => {
	if (executionLock.size > 0) {
		throw new Error(
			'Another Catalyst operation is currently in progress. Please wait until it is completed.'
		);
	}
	const [command] = args;
	const _promise = Catalyst.exec(...args).finally(() => {
		executionLock.delete(command);
	});
	executionLock.set(command, _promise);
	return _promise;
};

export const endpoints = _endpoints;

export const cliVerbose = verbose;

export const CATALYST_CONSTANTS = CONSTANTS;

export const LOGIN = login;

export const ensureNode = ensureNodeVersion;
