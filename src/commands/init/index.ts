import { window, Disposable, EventEmitter, env, Uri } from 'vscode';
import { registerCommands } from '../utils.js';
import Inputs, { TQuickPickItem } from '../../inputs.js';
import { promiseWrapper, refreshTreeView, runtime, setContext } from '../../utils.js';
import auth from '../../auth.js';
import {
	catalystExec,
	findCatalystRoot,
	getCatalystRoot,
	CATALYST_CONSTANTS
} from '../../catalyst/index.js';
import { addHttpFunction, addNonHttpFunction, functionsAdd } from './fn-init.js';
import { clientSetup } from './client-init.js';
import { setStatusBarMessage } from '../../status-bar.js';
import { SCOPE } from '../../constants.js';
import { getProjectDetails, getRemoteOrgs, getRemoteProjects } from '../../catalyst/project.js';
import CatalystTreeView from '../../tree_view/index.js';
import { CatalystError, ERROR_CODES } from '../../error.js';
import { appSailAdd } from './appsail-init.js';

export const projectEvents = new EventEmitter<string>();

const { ORIGIN } = CATALYST_CONSTANTS;

projectEvents.event((event) => {
	if (event === 'init') {
		CatalystTreeView.setViewMessage();
		setContext('viewWelcome.view', 'all');
	}
});

export async function getAllOrgs() {
	const allOrgs = await getRemoteOrgs();
	if (allOrgs.length === 0) {
		window
			.showInformationMessage(
				'No Organizations found. Please create a Catalyst Organization to continue.',
				'Create'
			)
			.then((res) => {
				if (res === 'Create') {
					env.openExternal(Uri.parse(ORIGIN.console));
				}
			});
		throw new Error('No projects found');
	}
	const orgInputs = allOrgs.map<TQuickPickItem<{ name: string; id: string }>>((org) => {
		return [
			org.name,
			{ name: org.name, id: org.id },
			org.id + (org.is_default ? '(default)' : '')
		];
	});
	return orgInputs;
}

export async function getAllProjects(org?: string) {
	const allProjects = await getRemoteProjects({ orgId: org });
	if (allProjects.length === 0) {
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
		throw new Error('No projects found');
	}
	const projectsInput = allProjects.map<TQuickPickItem<{ name: string; id: string }>>(
		(project) => {
			return [
				project.project_name,
				{ name: project.project_name, id: project.id },
				project.id
			];
		}
	);
	return projectsInput;
}

async function projectNamePrompt({ projectId, orgId }: { projectId?: string; orgId?: string }) {
	const init = new Inputs();
	if (orgId) {
		try {
			const allOrgs = await getRemoteOrgs();
			if (!allOrgs.find((_org) => _org.id === orgId)) {
				throw new Error('Catalyst ORG not found ::: ' + orgId);
			}
		} catch (er) {
			// eslint-disable-next-line no-console
			console.error('Error during project init org check: ', er);
			throw new Error(
				'Unable to validate the Catalyst ORG details during Project init/re-init'
			);
		}
	} else {
		init.push(() => {
			const orgsPromise = promiseWrapper(getAllOrgs());
			return Inputs.createQuickPick('org', orgsPromise.promise, {
				title: 'Org setup',
				placeHolder: 'Select a Organization for this directory',
				loadingMsg: {
					load: 'Fetching org details...',
					fail: ''
				}
			});
		});
	}

	if (projectId) {
		try {
			const allProjects = await getRemoteProjects();
			if (
				!allProjects.find(
					(proj) => proj.id === projectId || proj.project_name === projectId
				)
			) {
				throw new Error('Catalyst PROJECT not found ::: ' + projectId);
			}
		} catch (er) {
			// eslint-disable-next-line no-console
			console.error('Error during project init remote project check: ', er);
			throw new Error(
				'Unable to validate the Catalyst Project details during Project init/re-init'
			);
		}
	} else {
		init.push(() => {
			const orgArr = init.getValue<{ name: string; id: string }>('org');
			const _org =
				Array.isArray(orgArr) && orgArr.at(0) ? orgArr.at(0) : { name: orgId, id: orgId };
			if (typeof _org?.id !== 'string') {
				throw new Error('Unable to detect the Org Id');
			}
			const allProjectsPromise = promiseWrapper(getAllProjects(_org.id));
			return Inputs.createQuickPick('project', allProjectsPromise.promise, {
				title: 'Project setup',
				placeHolder: 'Select a default project for this directory',
				loadingMsg: {
					load: 'Fetching project details...',
					fail: ''
				},
				errorMsg: 'Error fetching project details for Org: ' + _org.id
			});
		});
	}

	const initInputs = await init.getInputs<{ name: string; id: string }>();

	const selectedProject =
		typeof projectId === 'string'
			? { id: projectId, name: projectId }
			: Array.isArray(initInputs.project) && initInputs.project.at(0);
	const selectedOrg =
		typeof orgId === 'string'
			? { id: orgId, name: orgId }
			: Array.isArray(initInputs.org) && initInputs.org.at(0);

	if (!selectedOrg || !selectedProject) {
		throw new Error(
			'Unable to retrieve the project and org details ::: ' +
				JSON.stringify(projectId) +
				' ::: ' +
				JSON.stringify(orgId)
		);
	}
	return {
		project: selectedProject,
		org: selectedOrg
	};
}

async function initProject(
	refresh = true,
	{ projectId, orgId }: { projectId?: string; orgId?: string } = {}
) {
	auth([SCOPE.projects, SCOPE.project_import_create]);

	const catalystRoot = getCatalystRoot();

	const projectObj = await projectNamePrompt({ projectId, orgId });
	if (!projectObj || !projectObj.project.id) {
		return;
	}
	const initRes = await setStatusBarMessage(
		'$(loading~spin) Initializing project',
		catalystExec('init', catalystRoot, catalystRoot, {
			inputs: {
				confirmation: true,
				project: projectObj.project.id,
				org: projectObj.org.id
			},
			options: {
				force: true
			}
		})
	);

	if (initRes?.exitCode === 2) {
		// eslint-disable-next-line no-console
		console.error(initRes?.error);
		window.showErrorMessage('Unable to initialize the project');
		return;
	}

	projectEvents.fire('init');
	refresh && refreshTreeView();
	window.showInformationMessage('Project successfully initialized');
	return projectObj.project.name;
}

// to be used only with vscode commands - force init
async function forceInitProject(): Promise<void> {
	return init({ force: true, skipFeature: true });
}

export async function init({
	force = false,
	skipFeature = false,
	projectId
}: {
	/** Force Org Init */
	force?: boolean;
	/** Skip feature init */
	skipFeature?: boolean;
	/** Providing the projectName skips the project name prompt. Note: if force option is used, this option is absolute */
	projectId?: string;
} = {}): Promise<void> {
	try {
		await setContext('viewWelcome.enable', false); // disable viewWelcome button
		// eslint-disable-next-line no-console
		const curProject = await getProjectDetails({ refresh: true }).catch((err) =>
			// eslint-disable-next-line no-console
			console.error(err)
		);
		if (!curProject || projectId || force) {
			const org = curProject && !force ? curProject.active.env.at(0)?.id : undefined;
			const _projectId = force ? undefined : projectId;
			const initProjectRes = await initProject(false, {
				projectId: _projectId,
				orgId: org
			});
			if (!initProjectRes) {
				return;
			}
		}

		if (skipFeature) {
			return;
		}

		try {
			const featInit = new Inputs();
			featInit.push(() =>
				Inputs.createQuickPick(
					'feature',
					[
						['Functions', 'functions', 'Configure and deploy http/non-http functions'],
						['Client', 'client', 'Configure and deploy client files']
					],
					{
						title: 'Features Initialization',
						placeHolder: 'Which are the features you want to setup for this folder?',
						optional: true,
						multiSelect: true
					}
				)
			);

			// featInit.push((features) => {
			//     const featInputs = new Inputs();
			//     if (Array.isArray(features)) {
			//         features.forEach((feat) => {
			//             switch(feat) {
			//                 case 'functions': {
			//                     featInputs.push(() => {
			//                         return initFunctions(features.length === 1);
			//                     });
			//                     break;
			//                 }
			//                 case 'client': {
			//                     featInputs.push(initClient);
			//                 }
			//             }
			//         });
			//     }
			//     return featInputs;
			// });

			const featInitRes = await featInit.getInputs();

			if (Array.isArray(featInitRes.feature) && featInitRes.feature.length > 0) {
				if (featInitRes.feature.includes('functions')) {
					await functionsAdd();
				}
				if (featInitRes.feature.includes('client')) {
					await clientSetup();
				}
			}
		} catch (err) {
			if (!(err instanceof CatalystError) || err.code !== ERROR_CODES.ABORTED_BY_USER) {
				window.showErrorMessage('Unable to initialize the features');
			}
			// eslint-disable-next-line no-console
			console.error('Unable to initialize the features: ', err);
		}

		const catalystRoot = await findCatalystRoot();
		runtime.set('catalyst.root', catalystRoot);
		refreshTreeView();
	} catch (e) {
		if (e instanceof CatalystError) {
			switch (e.code) {
				case ERROR_CODES.UNKNOWN_ERROR: {
					const _err = e.originalError || e;
					window.showErrorMessage('Error during project initialization: ' + _err.message);
					break;
				}
			}
		} else {
			window.showErrorMessage('Error during project initialization: ' + e?.toString());
		}
		throw e;
	} finally {
		await setContext('viewWelcome.enable', true); // enable viewWelcome button
	}
}

export function registerInitCommands(): Array<Disposable> {
	const cmdPrefix = 'init.';
	const initCommands: Array<[string, (...arg: Array<any>) => unknown]> = [
		[cmdPrefix + 'init', init],
		[cmdPrefix + 'project.force', forceInitProject],
		[cmdPrefix + 'http_function', addHttpFunction],
		[cmdPrefix + 'non_http_function', addNonHttpFunction],
		[cmdPrefix + 'appSail', appSailAdd],
		[cmdPrefix + 'client', clientSetup]
	];
	return registerCommands(initCommands, { auth: true, trusted: true });
}
