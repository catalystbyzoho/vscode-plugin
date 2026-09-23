import { window, WebviewPanel, commands, env, Uri } from 'vscode';
import {
	catalystExec,
	endpoints,
	getCatalystJson,
	getCatalystRoot,
	getUserDetails,
	LOGIN,
	CATALYST_CONSTANTS
} from '../../catalyst';
import { getMaskedTokens, getTokenById } from '../../catalyst/auth';
import {
	ClientHistory,
	getCurrentOrg,
	getEnvId,
	getProjectDetails,
	getRemoteAppsails,
	getRemoteClient,
	getRemoteFunctions,
	getRemoteProjects,
	getUserPic,
	IProjectServerObj,
	Projects
} from '../../catalyst/project';
import { setStatusBarMessage } from '../../status-bar';
import { TokenTerminal } from '../../terminal/token';
import { exists, getWorkSpaceRoot, resolveSafePath, safeRemove, setContext } from '../../utils';
import { overwrite } from '../init/utils';
import { PullTerminal } from '../../terminal/pull';
import Inputs from '../../inputs';
import { init } from '../init';
import { requireTrustedWorkspace } from '../utils.js';
import { TSAppSailDetails } from 'zcatalyst-cli/lib/endpoints/lib/appsail';

const { ORIGIN } = CATALYST_CONSTANTS;

type TCatalystRemoteDetails = {
	userDetails: Record<string, unknown>;
	projectDetails: Projects & { remote: Array<IProjectServerObj> };
	compDetails: {
		client?: {
			activeClientName?: string;
			invokeUrl?: string;
			clientHistory?: Array<ClientHistory>;
		} | void;
		functions?: Record<string, unknown> | void;
		appsails?: Array<TSAppSailDetails> | void;
		apig?: {
			baseUrl: string;
			rules: Array<unknown>;
			status: boolean;
		} | void;
	};
	tokenDetails: Array<[tokenId: string, token: string, createdTime: string]>;
	avatarImg?: string;
};

async function getCurrentOrgDetails(): Promise<unknown> {
	try {
		const org = await getCurrentOrg();
		return org;
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Unable to fetch the current org: ' + err);
		return {};
	}
}

async function getProjects(): Promise<
	(Projects & { remote: Array<IProjectServerObj> }) | undefined
> {
	// eslint-disable-next-line no-console
	let projectDetails = await getProjectDetails({ refresh: true }).catch((err) =>
		// eslint-disable-next-line no-console
		console.error(err)
	);
	if (!projectDetails) {
		window.showWarningMessage(
			"Couldn't find any active projects for this directory. Please initialize to continue."
		);
		await init({ skipFeature: true });
		projectDetails = await getProjectDetails({ refresh: true });
	}

	const remoteProjects = await getRemoteProjects().catch((er) => {
		if (er.status === 403) {
			const orgUrl = `${CATALYST_CONSTANTS.ORIGIN.admin.replace(
				'api.',
				'console.'
			)}/baas/organization#/`;
			window.showErrorMessage(
				`Unable to fetch the project details associated with the org(${getEnvId()}).` +
					` Either you don't have permission to access the Catalyst ORG or the Catalyst ORG is deleted.` +
					` You can access the [Catalyst Console](${orgUrl}) to get more info of your current Catalyst Orgs`
			);

			// eslint-disable-next-line no-console
			console.error('Error getting remote project data', er);
			return;
		}

		throw er;
	});

	if (!remoteProjects) {
		return;
	}

	if (remoteProjects.length === 0) {
		window
			.showInformationMessage(
				'No projects found. Please create a Catalyst project to continue.',
				'Create'
			)
			.then((res) => {
				if (res === 'Create') {
					env.openExternal(Uri.parse(ORIGIN.console));
				}
				setContext('viewWelcome.enable', true);
			});
		return;
	}
	if (remoteProjects.findIndex((proj) => proj.id === projectDetails?.active.id) === -1) {
		const curUser = getUserDetails();
		window
			.showErrorMessage(
				`Unable to access the Catalyst Project :: ${projectDetails.active.name} (${projectDetails.active.id}) initialized for this workspace.` +
					` Ensure the user ${curUser.Email} have the required permissions to access the project. ` +
					`Alternatively, if you want to continue with a different project please Re-Init`,
				'Re-Init'
			)
			.then((btnVal) => {
				if (btnVal === 'Re-Init') {
					init({ skipFeature: true });
				}
			});
		return;
	}
	return {
		remote: remoteProjects,
		...projectDetails
	};
}

async function getClients(): Promise<{
	activeClientName?: string;
	invokeUrl?: string;
	remoteClients?: Array<ClientHistory>;
}> {
	const activeClient = await getRemoteClient(true);
	const invokeUrl = activeClient.url_prefix
		? `${ORIGIN.app.replace('https://', `https://${activeClient.url_prefix}.`)}/app/`
		: undefined;

	const clientHistory = await getRemoteClient();

	return {
		activeClientName: activeClient.app_name,
		invokeUrl,
		remoteClients: clientHistory
	};
}

async function getApigDetails(rules = true) {
	const activeProject = (await getProjectDetails()).active;
	const apigApi = await endpoints.apigAPI({
		projectId: activeProject.id,
		org: getEnvId()
	});
	const apigStatus = (await apigApi.getAPIGStatus()) as { status: boolean; scheduled: boolean };
	// eslint-disable-next-line no-console
	const apigRules = rules
		? // eslint-disable-next-line no-console
		  (((await apigApi.getAllRules().catch((err) => console.error(err))) ||
				[]) as Array<unknown>)
		: [];

	return {
		baseUrl: ORIGIN.app.replace('https://', `https://${activeProject.domain.name}.`),
		rules: apigRules,
		status: apigStatus.status
	};
}

function formatErrorMessage(message: string, error?: unknown) {
	return message + (error instanceof Error ? '. Reason: ' + error.message : '');
}

/**
 * Get all Remote details
 * @returns Promise that resolves to Catalyst remote details
 */
export async function getAllViewDetails(): Promise<TCatalystRemoteDetails>;
/**
 * Send the remote details to Webview panel asynchronously
 * @param panel The Web view panel to send the message to
 * @returns Promise that resolves to void when all the data is sent to the panel
 */
export async function getAllViewDetails(panel: WebviewPanel): Promise<void>;
export async function getAllViewDetails(
	panel?: WebviewPanel
): Promise<TCatalystRemoteDetails | void> {
	const currentUser = getUserDetails();
	const projectDetails = await getProjects();
	if (!projectDetails) {
		panel?.dispose();
		return;
	}
	const orgDetails = await getCurrentOrgDetails();
	// eslint-disable-next-line no-console
	const clientPromise = getClients().catch((err) => console.error(err));
	// eslint-disable-next-line no-console
	const fnPromise = getRemoteFunctions().catch((err) => console.error(err));
	// eslint-disable-next-line no-console
	const appsailPromise = getRemoteAppsails().catch((err) => console.error(err));
	// eslint-disable-next-line no-console
	const apigPromise = getApigDetails().catch((err) => console.error(err));
	// eslint-disable-next-line no-console
	const userPicPromise = getUserPic(currentUser.ZUID as string).catch((err) =>
		// eslint-disable-next-line no-console
		console.error(err)
	);

	if (panel) {
		panel.webview.postMessage({
			userDetails: currentUser || null,
			projectDetails,
			orgDetails,
			compDetails: {
				client: await clientPromise
			}
		});

		fnPromise.then((fns) =>
			panel.webview.postMessage({
				compDetails: {
					functions: fns
				}
			})
		);

		appsailPromise.then((sails) => {
			panel.webview.postMessage({
				compDetails: {
					appsails: sails
				}
			});
		});

		apigPromise.then((apis) =>
			panel.webview.postMessage({
				compDetails: {
					apig: apis
				}
			})
		);

		userPicPromise.then((pic) => {
			pic && panel.webview.postMessage({ avatarImg: pic.toString('base64') });
		});

		panel.webview.postMessage({ tokenDetails: getMaskedTokens() });
		return;
	}

	const userPic = await userPicPromise;

	return {
		userDetails: currentUser || null,
		projectDetails,
		compDetails: {
			client: await clientPromise,
			functions: await fnPromise,
			appsails: await appsailPromise,
			apig: await apigPromise
		},
		tokenDetails: getMaskedTokens(),
		avatarImg: userPic ? userPic.toString('base64') : undefined
	};
}

export default async function actionHandler(
	panel: WebviewPanel,
	action: { name: string; data: unknown }
) {
	switch (action.name) {
		case 'reload': {
			getAllViewDetails(panel);
			break;
		}
		case 'logout': {
			const logoutRes = await commands.executeCommand<boolean>('zcatalyst.auth.logout');
			if (logoutRes) {
				panel.dispose();
				return;
			}

			panel.webview.postMessage({
				loading: false
			});
			break;
		}
		case 'project_switch': {
			try {
				if (!requireTrustedWorkspace()) {
					panel.webview.postMessage({ loading: false });
					break;
				}
				const catalystRoot = getCatalystRoot();
				const switchRes = await setStatusBarMessage(
					'$(loading~spin) Switching project...',
					catalystExec('project:use', catalystRoot, catalystRoot, {
						inputs: {
							project: action.data
						}
					})
				);

				if (switchRes.exitCode === 2 || switchRes.error) {
					throw switchRes.error;
				}

				await getAllViewDetails(panel);
				window.showInformationMessage('Project successfully switched');
			} catch (err) {
				window.showErrorMessage(formatErrorMessage('Unable to switch project', err));
				panel.webview.postMessage({
					loading: false
				});
			}
			break;
		}
		case 'project_reset': {
			try {
				if (!requireTrustedWorkspace()) {
					panel.webview.postMessage({ loading: false });
					break;
				}
				const catalystRoot = getCatalystRoot();
				const resetRes = await setStatusBarMessage(
					'$(loading~spin) Resetting project...',
					catalystExec('project:reset', catalystRoot, catalystRoot)
				);

				if (resetRes.exitCode === 2 || resetRes.error) {
					throw resetRes.error;
				}

				await getAllViewDetails(panel);
				window.showInformationMessage('Project reset successful');
			} catch (err) {
				window.showErrorMessage(formatErrorMessage('Unable to reset project', err));
				panel.webview.postMessage({
					loading: false
				});
			}
			break;
		}
		case 'project_reinit': {
			try {
				if (!requireTrustedWorkspace()) {
					panel.webview.postMessage({ loading: false });
					break;
				}
				await init({
					skipFeature: true,
					projectId: action.data as string
				});
				await getAllViewDetails(panel);
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error('PROJECT RE-INIT ERROR: ', err);
				panel.dispose();
				window.showErrorMessage(formatErrorMessage('Unable to reinit project', err));
			}
			break;
		}
		case 'token_reveal': {
			// Show the raw token value inside a VS Code InputBox on the
			// extension host — the raw value never enters the webview's
			// JavaScript context or DOM.
			const tokenId = action.data as string;
			const tokenEntry = getTokenById(tokenId);
			if (!tokenEntry) {
				panel.webview.postMessage({
					tokenReveal: { tokenId, error: 'Token not found' }
				});
				break;
			}
			await window.showInputBox({
				value: tokenEntry[1],
				prompt: 'Catalyst token — select all and copy. This dialog does not persist the value.',
				ignoreFocusOut: false
			});
			// Notify the webview that the reveal completed, without sending
			// the raw token value.
			panel.webview.postMessage({
				tokenReveal: { tokenId, revealed: true }
			});
			break;
		}
		case 'token_copy': {
			// Identify the token by ID and look up the raw value on the host
			// side; never trust/accept a raw token string from the webview.
			const tokenId = action.data as string;
			const tokenEntry = getTokenById(tokenId);
			if (!tokenEntry) {
				window.showErrorMessage('Unable to copy token: token not found');
				break;
			}
			const choice = await window.showWarningMessage(
				'Copy this Catalyst token to the clipboard? Tokens grant full account access — only copy it if you trust the destination and the current clipboard is not shared/synced.',
				{ modal: true },
				'Copy'
			);
			if (choice === 'Copy') {
				await env.clipboard.writeText(tokenEntry[1]);
				window.showInformationMessage(
					'Token copied to clipboard. It will be cleared automatically in 30 seconds.'
				);
				// Accepted residual risk: any OS clipboard write is accessible to
				// other local processes, clipboard managers, and sync services
				// before the auto-clear fires. This is an inherent OS-level
				// property; the 30-second bounded window is the maximum
				// mitigation available within the VS Code extension API.
				setTimeout(async () => {
					const current = await env.clipboard.readText();
					if (current === tokenEntry[1]) {
						await env.clipboard.writeText('');
					}
				}, 30_000);
			}
			break;
		}
		case 'token_revoke': {
			try {
				const workspaceRoot = getWorkSpaceRoot();
				const tkRevokeRes = await setStatusBarMessage(
					'$(loading~spin) Revoking token',
					catalystExec('token:revoke', workspaceRoot, workspaceRoot, {
						args: [action.data as string]
					})
				);

				if (tkRevokeRes.exitCode === 2 || tkRevokeRes.error) {
					throw tkRevokeRes.error;
				}
				window.showInformationMessage('Token revoked successfully');
			} catch (err) {
				window.showErrorMessage(formatErrorMessage('Unable to revoke the token', err));
			}

			panel.webview.postMessage({
				tokenDetails: getMaskedTokens()
			});
			break;
		}
		case 'token_generate': {
			try {
				await setStatusBarMessage(
					'$(loading~spin) Generating token',
					TokenTerminal.generateToken()
				).then(() => {
					LOGIN.loginEvents.emit('exit');
				}); // terminate the retry
			} catch (err) {
				window.showErrorMessage(formatErrorMessage('Unable to generate new token', err));
			}

			panel.webview.postMessage({
				tokenDetails: getMaskedTokens()
			});
			break;
		}
		case 'apig_pull': {
			try {
				if (!requireTrustedWorkspace()) {
					panel.webview.postMessage({ loading: false });
					break;
				}
				const catalystJson = await getCatalystJson();
				const catalystRoot = getCatalystRoot();
				const apigRulesPath = await resolveSafePath(
					catalystRoot,
					catalystJson?.apig?.rules || 'catalyst-user-rules.json'
				);
				const overwriteRes = await overwrite(
					catalystRoot,
					catalystJson?.apig?.rules || 'catalyst-user-rules.json',
					apigRulesPath,
					{
						dir: false
					}
				);
				if (!overwriteRes) {
					throw new Error(
						`Unable to Overwrite file(${
							catalystJson?.apig?.rules || 'catalyst-user-rules.json'
						})`
					);
				}

				const apigDetails = await getApigDetails(false);
				if (!apigDetails.status) {
					panel.webview.postMessage({
						component: {
							apig: false
						}
					});
					const apigEnable = await window.showWarningMessage(
						'The APIG is disable in Catalyst console, Do you want to enable it and pull the APIG rules now ?',
						'Enable'
					);
					if (apigEnable !== 'Enable') {
						throw new Error('APIG is disabled in Catalyst console');
					}
				}

				const apigPullRes = await setStatusBarMessage(
					'$(loading~spin) Pulling APIG',
					PullTerminal.pull('APIG', {
						enable: true
					})
				);

				if (apigPullRes?.exitCode === 2 || apigPullRes?.error) {
					throw apigPullRes.error;
				}
				commands.executeCommand('zcatalyst.view.config.refreshTree');
				window.showInformationMessage('APIG Pull completed');
			} catch (err) {
				window.showErrorMessage(
					formatErrorMessage('Unable to pull APIG rules to local', err)
				);
			}

			panel.webview.postMessage({
				pull: 'apig'
			});
			break;
		}
		case 'functions_pull': {
			try {
				if (!requireTrustedWorkspace()) {
					panel.webview.postMessage({ loading: false });
					break;
				}
				if (!Array.isArray(action.data)) {
					throw new Error('Unknown data');
				}

				const catalystRoot = getCatalystRoot();
				const fns = {
					needOverWrites: [] as Array<{
						fnName: string;
						path: string;
					}>,
					newFns: [] as Array<string>
				};

				const catalystJson = await getCatalystJson();
				const fnRoot = catalystJson?.functions?.source || 'functions';

				await Promise.all(
					(action.data as Array<string>).map(async (fn) => {
						return new Promise<void>(async (res) => {
							try {
								const fnPath = await resolveSafePath(catalystRoot, fnRoot, fn);
								const pathExists = await exists(fnPath);
								pathExists
									? fns.needOverWrites.push({ fnName: fn, path: fnPath })
									: fns.newFns.push(fn);
							} catch (err) {
								// eslint-disable-next-line no-console
								console.error(err);
							}
							res();
						});
					})
				);

				const fnsInputs = new Inputs();
				fnsInputs.push(() => {
					return fns.needOverWrites.length > 0
						? Inputs.createQuickPick(
								'functions',
								fns.needOverWrites.map((fn) => [fn.fnName, fn]),
								{
									title: 'Functions Pull',
									placeHolder: 'Select the functions to overwrite',
									multiSelect: true,
									optional: true
								}
						  )
						: undefined;
				});

				const fnsRes = await fnsInputs.getInputs();

				fnsRes.functions &&
					(await Promise.all(
						(fnsRes.functions as Array<{ fnName: string; path: string }>).map(
							async (fn) => {
								fns.newFns.push(fn.fnName);
								return safeRemove(catalystRoot, fn.path).catch((err) => {
									// eslint-disable-next-line no-console
									console.error(
										`Error when deleting the function folder: ${fn.path}`,
										err
									);
								});
							}
						)
					));

				const fnPullRes = await setStatusBarMessage(
					'$(loading~spin) Pulling Function',
					PullTerminal.pull('Functions', {
						functions: fns.newFns
					})
				);

				if (fnPullRes?.exitCode === 2 || fnPullRes?.error) {
					throw fnPullRes.error;
				}

				commands.executeCommand('zcatalyst.view.httpFunctions.refreshTree');
				commands.executeCommand('zcatalyst.view.nonHttpFunctions.refreshTree');
				window.showInformationMessage('Functions Pull completed');
			} catch (err) {
				window.showErrorMessage(
					formatErrorMessage('Unable to pull Functions to local', err)
				);
			}

			panel.webview.postMessage({
				pull: 'functions'
			});
			break;
		}
		case 'client_pull': {
			try {
				if (!requireTrustedWorkspace()) {
					panel.webview.postMessage({ loading: false });
					break;
				}
				const catalystRoot = getCatalystRoot();
				const catalystJson = await getCatalystJson();
				const clientSource = catalystJson?.client?.source || 'client';
				const overwriteRes = await overwrite(
					catalystRoot,
					clientSource,
					await resolveSafePath(catalystRoot, clientSource)
				);
				if (!overwriteRes) {
					throw new Error(`Unable to Overwrite Folder(${clientSource})`);
				}

				const clientPullRes = await setStatusBarMessage(
					'$(loading~spin) Pulling Client',
					PullTerminal.pull('Client', {
						history: action.data
					})
				);

				if (clientPullRes?.exitCode === 2 || clientPullRes?.error) {
					throw clientPullRes.error;
				}
				commands.executeCommand('zcatalyst.view.client.refreshTree');
				window.showInformationMessage('Client Pull completed');
			} catch (err) {
				window.showErrorMessage(formatErrorMessage('Unable to pull Client to local', err));
			}

			panel.webview.postMessage({
				pull: 'client'
			});
			break;
		}
		case 'open_link': {
			try {
				const uri = Uri.parse((action.data || '') as string);
				if (uri.scheme !== 'https' && uri.scheme !== 'http') {
					throw new Error('Unsupported link scheme: ' + uri.scheme);
				}
				env.openExternal(uri);
			} catch (err) {
				window.showErrorMessage(
					formatErrorMessage('Unable to open the link in browser', err)
				);
			}
			break;
		}
	}
}
