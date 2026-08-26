'use strict';
import { commands, window } from 'vscode';
import { credential, dc, env } from './catalyst/auth.js';
import { cliRuntime, store } from './catalyst/index.js';
import { SCOPE } from './constants.js';
import CatalystTreeView from './tree_view/index.js';
import { setContext } from './utils.js';

/**
 * Extension specific authentication
 *
 * By default ZohoCatalyst.projects.ALL will be present
 */
export default (
	inScopes: Array<string> = [],
	{ showError = true }: { showError?: boolean } = {}
): void => {
	const activeDC = dc.getActiveDC();
	const tokenOpts = [
		{
			option: 'signed-in user',
			token: store.get(`${activeDC}.credential`),
			temp: false
		}
	];
	const tokenObj = tokenOpts.find((opts) => typeof opts.token === 'string');
	if (tokenObj === undefined) {
		if (showError) {
			window
				.showInformationMessage(
					'Authentication required. Please login to your Catalyst Account to continue',
					'Login'
				)
				.then((val) => {
					if (val === 'Login') {
						return commands.executeCommand('zcatalyst.auth.login');
					}
					CatalystTreeView.setViewMessage(
						'Please Login to your Catalyst account to continue',
						{
							clearView: true
						}
					);
					setContext('viewWelcome.view', 'login');
				});
		}
		throw new Error('Command requires authentication');
	}

	// eslint-disable-next-line no-console
	console.log(`> authorizing via ${tokenObj.option} option`);
	const existingScopes = store.get(`${activeDC}.scopes`, []) as Array<string>;
	const requiredScopes = [SCOPE.projects, ...inScopes];
	// eslint-disable-next-line no-console
	console.log('> command requires scopes: ' + JSON.stringify(requiredScopes));
	const hasAllScope = requiredScopes.every((scope) => existingScopes.includes(scope));
	if (!tokenObj.temp && !env.isCI && !hasAllScope) {
		showError &&
			window
				.showErrorMessage('Re-login required due to missing scopes!!', 'Login')
				.then((val) => {
					if (val === 'Login') {
						commands.executeCommand('zcatalyst.auth.login');
					}
				});
		// auth is not token based and its not a CI environment but doesn't have all scopes
		throw new Error('Re-login required due to missing scopes!!');
	}
	cliRuntime.set('auth_scopes', requiredScopes);
	cliRuntime.set('user', store.get(`${activeDC}.user`, null));
	cliRuntime.set('credential', credential.init(tokenObj.token as string, tokenObj.temp));
};
