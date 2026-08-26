/* eslint-disable @typescript-eslint/naming-convention */
import { readJsonFile, runtime } from '../utils';
import { EventEmitter } from 'vscode';
import IRC, { TProject } from '../util_types/rc';
import { join } from 'path';
import { endpoints, getCatalystRoot } from './index.js';
import userAPI from 'zcatalyst-cli/lib/endpoints/lib/user';
import { FILENAMES } from '../constants';
import type { IProjectServerObj as _projectObject } from 'zcatalyst-cli/lib/util_modules/project';
import { ICatalystOrgObj } from 'zcatalyst-cli/lib/endpoints/lib/org';

export const rcEvent = new EventEmitter<IRC>();
rcEvent.event((rc) => getProjectDetails({ inputRc: rc, refresh: true }));

export interface Projects {
	default: TProject;
	active: TProject;
}

export interface ActiveClient {
	app_id: string;
	app_name: string;
	modified_time: string;
	uploaded_time: string;
	url_prefix: string;
	project_details: unknown;
	uploaded_by: unknown;
}

export interface ClientHistory {
	app_id: string;
	app_version: string;
	description?: string;
	history_id: string;
	index_path: string;
	status: boolean;
	uploaded_time: string;
	uploaded_by: {
		email_id: string; // contains more properties but using only email_id as of now
	};
}

export type IProjectServerObj = _projectObject;

export async function getProjectDetails({
	inputRc,
	refresh = false
}: { inputRc?: IRC; refresh?: boolean } = {}): Promise<Projects> {
	const fromRuntime = runtime.get<Projects>('project', undefined);
	if (fromRuntime && !refresh && !inputRc) {
		return fromRuntime;
	}

	const rc = inputRc || (await readJsonFile<IRC>(join(getCatalystRoot(), FILENAMES.CATALYST_RC)));
	if (!rc) {
		throw new Error(`Unable to read the ${FILENAMES.CATALYST_RC} file`);
	}

	const curProject = rc.projects.find((proj) => proj.idx === rc.actives.project);
	if (!curProject) {
		throw new Error('Unable to identify the project');
	}

	const defaultProject = rc.projects.find((proj) => proj.idx === rc.defaults.project);
	if (!defaultProject) {
		throw new Error('Unable to identify the default project');
	}

	const projects = {
		default: defaultProject,
		active: curProject
	};

	runtime.set('project', projects);
	return projects;
}

export function getEnvId(): string | undefined {
	const envArr = runtime.get('project.active.env') as TProject['env'];
	if (Array.isArray(envArr)) {
		return envArr.at(0)?.id;
	}
}

export async function getDetails<T>(comp: string, fnType?: string): Promise<T> {
	return (await endpoints.detailsAPI()).getDetails(comp, fnType);
}

export async function getRemoteFunctions() {
	return (
		await endpoints.functionsAPI({
			projectId: (await getProjectDetails()).active.id,
			org: getEnvId()
		})
	).getAllFunctions() as Promise<Record<string, unknown>>;
}

export async function getRemoteAppsails() {
	return (
		await endpoints.appSailAPI({
			projectId: (await getProjectDetails()).active.id,
			org: getEnvId()
		})
	).getAllAppsails();
}

export async function getRemoteClient(): Promise<Array<ClientHistory>>;
export async function getRemoteClient(active: boolean): Promise<ActiveClient>;
export async function getRemoteClient(active = false) {
	const clientApi = await endpoints.clientAPI({
		projectId: (await getProjectDetails()).active.id,
		org: getEnvId()
	});

	return active
		? (clientApi.getWebappDetails() as Promise<ActiveClient>)
		: (clientApi.getAllHistory() as Promise<Array<ClientHistory>>);
}

export async function getRemoteOrgs(): Promise<Array<ICatalystOrgObj>> {
	const orgApi = await endpoints.orgAPI();
	return orgApi.getAllOrgs();
}

export async function getRemoteProjects(): Promise<Array<_projectObject>>;
export async function getRemoteProjects({
	projectId,
	orgId
}: {
	projectId: string;
	orgId?: string;
}): Promise<_projectObject>;
export async function getRemoteProjects({
	orgId
}: {
	orgId?: string;
}): Promise<Array<_projectObject>>;
export async function getRemoteProjects({
	projectId,
	orgId
}: {
	projectId?: string;
	orgId?: string;
} = {}): Promise<_projectObject | Array<_projectObject>> {
	const projectsApi = await endpoints.projectAPI({ org: orgId || getEnvId() });
	return projectId ? projectsApi.getProject(projectId) : projectsApi.getAllProjects();
}

export async function getUserPic(id: string) {
	return new userAPI().getUserThumb(id);
}

export async function getCurrentOrg(): Promise<ICatalystOrgObj | undefined> {
	const orgId = getEnvId();
	if (!orgId) {
		return;
	}
	const allOrgs = await getRemoteOrgs();
	return allOrgs.find((_org) => _org.id === orgId);
}
