import { Disposable, window, EventEmitter, commands } from 'vscode';
import { catalystExec, getCatalystRoot, getUserDetails, LOGIN } from '../catalyst';
import { DC } from '../constants';
import Inputs from '../inputs';
import { setStatusBarMessage, statusBarWithProgress } from '../status-bar';
import CatalystTreeView from '../tree_view';
import { displayNoFolderView } from '../tree_view/utils';
import { setContext } from '../utils';
import { registerCommands } from './utils';

export const loginEvents = new EventEmitter<'login' | 'logout'>();

loginEvents.event(async (event) => {
	switch (event) {
		case 'login': {
			CatalystTreeView.setViewMessage();
			try {
				getCatalystRoot();
				await setContext('viewWelcome.view', 'all');
			} catch (err) {
				displayNoFolderView();
			}

			break;
		}
		case 'logout': {
			CatalystTreeView.setViewMessage('Please Login to your Catalyst Account to continue.', {
				clearView: true
			});
			try {
				getCatalystRoot();
				await setContext('viewWelcome.view', 'login');
			} catch (err) {
				displayNoFolderView();
			}
			break;
		}
	}
});

async function login() {
	try {
		const loginInputs = new Inputs();
		loginInputs.push(() =>
			Inputs.createQuickPick(
				'dc',
				Object.entries(DC).map(([dcKey, dc]) => [dcKey.toUpperCase(), dcKey, dc.loc]),
				{
					title: 'Data Centers',
					placeHolder: 'Please select the Data Center to use'
				}
			)
		);
		loginInputs.push(() =>
			Inputs.confirmQuestion(
				'usage',
				'Collect Usage',
				'Allow Catalyst to collect error reporting information?',
				{
					defaultAns: true
				}
			)
		);

		await setContext('viewWelcome.enable', false);

		// eslint-disable-next-line no-console
		const loginAns = await loginInputs.getInputs().catch((err) => console.error(err));

		if (loginAns === undefined) {
			return;
		}

		const loginRes = await statusBarWithProgress<Record<string, unknown>>(
			'$(loading~spin) Logging in...',
			'Logging into your catalyst account',
			(progress, token) => {
				return new Promise(async (res, rej) => {
					try {
						token.onCancellationRequested((e) => {
							if (e) {
								window.showErrorMessage(e);
							}
							// eslint-disable-next-line no-console
							console.error('Login error:', e);
							LOGIN.loginEvents.emit('abort', e);
							rej('Aborted by user');
						});

						const result = await catalystExec('login', '', '', {
							inputs: {
								collectUsage: loginAns.usage,
								dc: Array.isArray(loginAns.dc) ? loginAns.dc?.at(0) : loginAns.dc
							},
							options: {
								force: true
							}
						});

						res(result);
					} catch (err) {
						rej(err);
					}
				});
			}
		);

		if (loginRes.exitCode === 2 || loginRes.error) {
			throw loginRes.error;
		}
		const currentUser = getUserDetails();
		window.showInformationMessage(
			`Log-In successful, Welcome: ${currentUser.First_Name} ${currentUser.Last_Name}`
		);
		loginEvents.fire('login'); // fire login event
		return currentUser;
	} catch (err) {
		window.showErrorMessage(
			'Login Failed' +
				(err instanceof Error
					? ': ' + err.message
					: typeof err === 'string'
					? ': ' + err
					: '')
		);
	} finally {
		setContext('viewWelcome.enable', true);
	}
}

async function logout() {
	try {
		const logoutRes = await setStatusBarMessage(
			'$(loading~spin) Logging out...',
			catalystExec('logout', '', '', {
				inputs: {
					consent: true
				}
			})
		);
		if (logoutRes?.exitCode === 2 || logoutRes.error) {
			throw logoutRes.error;
		}
		window.showInformationMessage('Successfully logged out');
		loginEvents.fire('logout');
		return true;
	} catch (err) {
		window.showErrorMessage(
			'Unable to logout' + (err instanceof Error ? ': ' + err.message : '')
		);
	}
	return false;
}

async function whoami() {
	const userDetails = getUserDetails();
	if (userDetails) {
		window.showInformationMessage('Logged as: ' + userDetails.Email);
		return;
	}
	window.showInformationMessage('Not logged into Catalyst yet', 'Login').then((val) => {
		if (val === 'Login') {
			commands.executeCommand('zcatalyst.auth.login');
		}
	});
}

export default function registerAuthCommands(): Array<Disposable> {
	const cmdPrefix = 'auth.';
	const authCommands: Array<[string, (...arg: Array<unknown>) => unknown]> = [
		[cmdPrefix + 'login', login],
		[cmdPrefix + 'logout', logout],
		[cmdPrefix + 'whoami', whoami]
	];
	return registerCommands(authCommands);
}
