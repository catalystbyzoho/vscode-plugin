/* eslint-disable @typescript-eslint/no-unused-vars */
const vscode = acquireVsCodeApi();

const runtime = {};

const pageLoader = document.querySelector('.page-loader');
const pageContent = document.querySelector('.section-container');

function setCatalystState(obj) {
	const curState = vscode.getState() || {};
	vscode.setState(Object.assign(curState, obj));
}

window.addEventListener('message', (event) => {
	const message = Object.keys(event.data).length === 0 ? vscode.getState() : event.data;
	if (!message) {
		vscode.postMessage({
			action: {
				name: 'reload'
			}
		});
		return;
	}
	if ('userDetails' in message) {
		setCatalystState({
			userDetails: message.userDetails
		});
		handleUserDetails(message.userDetails);
	}
	if ('orgDetails' in message) {
		setCatalystState({
			orgDetails: message.orgDetails
		});
		setActiveOrgDetails(message.orgDetails);
	}
	if ('projectDetails' in message) {
		setCatalystState({
			projectDetails: message.projectDetails
		});
		handleProjectDetails(message.projectDetails);
	}
	if ('compDetails' in message) {
		const _compDetails = vscode.getState();
		const filledDetails = Object.assign(_compDetails.compDetails || {}, message.compDetails);
		setCatalystState({
			compDetails: filledDetails
		});
		handleRemoteComponentDetails(message.compDetails);
	}
	if ('tokenDetails' in message) {
		// The extension host only ever sends masked token values here (see
		// `getMaskedTokens()`), so it is safe to persist and cache as-is.
		setCatalystState({
			tokenDetails: message.tokenDetails
		});
		handleTokenDetails(message.tokenDetails);
	}
	if ('tokenReveal' in message) {
		const { error } = message.tokenReveal || {};
		if (error) {
			// eslint-disable-next-line no-console
			console.error('Unable to reveal token: ' + error); // No I18N
		}
		// The raw token value is never sent to the webview; the extension host
		// displays it in its own UI. Nothing further to handle here.
	}
	if ('avatarImg' in message) {
		setCatalystState({
			avatarImg: message.avatarImg
		});
		setUserPic(message.avatarImg);
	}
	if ('loading' in message) {
		message.loading === true ? displayLoading() : displayLoading(false);
	}
});


function handleUserDetails(userDetails) {
	runtime.userDetails = userDetails;
	if (userDetails) {
		setUserDetails(userDetails);
		displayLoading(false);
		return displayLoading(false);
	}
}

function setUserPic(pic) {
	const avatarImg = document.createElement('img');
	avatarImg.setAttribute('src', 'data:image/png;base64,' + pic);
	const avatarImgEle = document.querySelector('.section-head .avatar-img');
	avatarImgEle.innerHTML = '';
	avatarImgEle.appendChild(avatarImg);
}

function setUserDetails(userDetails) {
	document.querySelector(
		'.section-head #avatarName'
	).innerText = `${userDetails.First_Name} ${userDetails.Last_Name}`;
	document.querySelector('.section-head #avatarEmail').innerText = userDetails.Email;
}

function displayLoading(display = true) {
	if (display === true) {
		pageLoader.style.display = '';
		pageContent.style.display = 'none';
		return;
	}
	pageLoader.style.display = 'none';
	pageContent.style.display = '';
}

function logout() {
	vscode.postMessage({
		action: {
			name: 'logout'
		}
	});
	displayLoading();
}

function handleProjectDetails(projectDetails) {
	displayLoading(false);
	runtime.projectDetails = projectDetails;
	setActiveProjectDetails(projectDetails.active);
	setProjectSwitchOptions(projectDetails.active, projectDetails.remote);
	setDefaultProjectDetails(projectDetails.default);
	setProjectReInitModal(projectDetails.default, projectDetails.remote);
}

function setDefaultProjectDetails(defaultProject) {
	document.querySelector('.section-head #defaultProjectName').innerText = defaultProject.name;
}

function setActiveProjectDetails(activeProject) {
	document.querySelector('.section-body #projectName').innerText = activeProject.name;
	document.querySelector('.section-body #projectId span').innerText = activeProject.id;
}

function setActiveOrgDetails(activeOrg) {
	if (!activeOrg) {
		document.querySelector('#avatarOrdId').innerText = 'Org: Unable to fetch Org details';
	}
	document.querySelector('#avatarOrgId').innerText = `Org: ${activeOrg.name} (${activeOrg.id})`;
}

function setProjectSwitchOptions(activeProject, remote) {
	const customSelect = document.querySelector('.section-head .custom-select');
	customSelect.innerHTML = '';

	const select = document.createElement('select');
	const activeOption = document.createElement('option');
	activeOption.setAttribute('id', 0);
	activeOption.setAttribute('value', activeProject.id);
	activeOption.innerText = activeProject.name;
	select.appendChild(activeOption);

	if (Array.isArray(remote)) {
		remote.forEach((project, idx) => {
			if (project.id === activeProject.id) {
				return;
			}
			const otherProjOption = document.createElement('option');
			otherProjOption.setAttribute('id', idx + 1);
			otherProjOption.setAttribute('value', project.id);
			otherProjOption.innerText = project.project_name;
			select.appendChild(otherProjOption);
		});
	}
	customSelect.appendChild(select);
	prepareSelect();
	tooltip();
}

function createProjectCard(project) {
	const projectCard = document.createElement('div');
	projectCard.classList.add('project-card');

	const projectDetails = document.createElement('div');
	projectDetails.classList.add('w80p');

	const projectName = document.createElement('p');
	projectName.classList.add('f_15_18_R', 'primary-font-color', 'pB5', 'line-ellipsis');
	projectName.innerText = project.name;

	const projectId = document.createElement('p');
	projectId.classList.add('f_13_15_RR', 'secondary-font-color', 'line-ellipsis');
	projectId.innerText = 'PID: ' + project.id;

	projectDetails.appendChild(projectName);
	projectDetails.appendChild(projectId);

	projectCard.appendChild(projectDetails);

	projectCard.addEventListener('click', () => {
		projectReinit(project.id);
		closeReinit();
		displayLoading();
	});
	tooltip();
	return projectCard;
}

function setProjectReInitModal(defaultProject, remote) {
	const projectList = document.querySelector('#reinitPopup .project-list');
	projectList.innerHTML = '';

	const defaultSpan = document.createElement('span');
	defaultSpan.classList.add('center-popup-hover-button', 'default-green-color');
	defaultSpan.innerText = 'Default';

	const defaultProjectCard = createProjectCard(defaultProject);
	defaultProjectCard.appendChild(defaultSpan);
	projectList.appendChild(defaultProjectCard);

	if (Array.isArray(remote)) {
		remote.forEach((project) => {
			if (project.id === defaultProject.id) {
				return;
			}
			const reInitSpan = document.createElement('span');
			reInitSpan.classList.add(
				'center-popup-hover-button',
				'primary-bg-color',
				'theme-font-color'
			);
			reInitSpan.innerText = 'Re-init';

			const reInitProjectCard = createProjectCard({
				id: project.id,
				name: project.project_name
			});
			reInitProjectCard.appendChild(reInitSpan);
			projectList.appendChild(reInitProjectCard);
		});
	}
}

function setClientDetails(clientDetails) {
	document.querySelector('.section-body #clientTabB #clientName').innerText =
		clientDetails.activeClientName || 'Client';

	const invokeUrlDiv = document.querySelector('.section-body #clientTabB #clientUrl');
	invokeUrlDiv.style.textDecoration = 'underline';
	invokeUrlDiv.innerText = clientDetails.invokeUrl || '';

	clientDetails.invokeUrl &&
		invokeUrlDiv.addEventListener('click', () =>
			vscode.postMessage({
				action: {
					name: 'open_link',
					data: clientDetails.invokeUrl
				}
			})
		);

	if (Array.isArray(clientDetails.remoteClients)) {
		const tbody = document.querySelector('.section-body #clientTabB #tableClient tbody');
		tbody.innerHTML = '';

		if (clientDetails.remoteClients.length === 0) {
			const emptyTr = document.createElement('tr');
			emptyTr.classList.add('no-search-row');
			emptyTr.style = '';
			emptyTr.innerHTML = `<td colspan="5">
                    No Web Client present in Catalyst console.
                </td>`;
			tbody.appendChild(emptyTr);
			return;
		}

		clientDetails.remoteClients.forEach((client) => {
			const tr = document.createElement('tr');
			tr.style = '';

			tr.innerHTML = `
                <td class="w15p line-ellipsis">
                    <div class="dF align-items-center">
                        <span id="search-value">V-${Encoder.encodeForHTML(
							client.app_version
						)}</span>${
				Encoder.encodeForHTML(client.status)
					? '<span class="green-badge">Active</span>'
					: ''
			}
                    </div>
                </td>
                <td class="w25p line-ellipsis">${Encoder.encodeForHTML(
					client.uploaded_by?.email_id || ''
				)}</td>
                <td class="w20p line-ellipsis">${Encoder.encodeForHTML(client.uploaded_time)}</td>
                <td class="w37p ws-normal">${Encoder.encodeForHTML(client.description || '')}</td>
                <td class="pull">
                    <div class="icon-pull" title="Pull" onclick="pullClient('${Encoder.encodeForJavaScript(
						client.app_version
					)}')">
                    </div>
                </td>`;

			tbody.appendChild(tr);
			tooltip();
		});

		const noResTr = document.createElement('tr');
		noResTr.classList.add('no-search-row');
		noResTr.style.display = 'none';
		noResTr.innerHTML = `<td colspan="5">
            No Search Result Found
        </td>`;

		tbody.appendChild(noResTr);
	}

	addClientSearchListener();
}

function formatFnStack(stack) {
	if (!stack) {
		return 'Custom';
	}
	if (stack.includes('java')) {
		return stack.replace(/^java/g, 'Java ');
	}

	if (stack.includes('node')) {
		return stack.replace(/^node/g, 'NodeJS ');
	}

	if (stack.includes('python')) {
		return stack
			.replace(/^python/g, 'Python ')
			.replace(/ _/g, ' ')
			.replace('_', '.');
	}
}

const remoteFnTypeMap = {
	basicio: 'Basic I/O',
	applogic: 'Advanced I/O',
	advancedio: 'Advanced I/O',
	browser_logic: 'Browser Logic',
	event: 'Event',
	cron: 'Cron',
	job: 'Job',
	integration: 'Integration'
};

const nonHttpFns = ['event', 'cron', 'job', 'integration'];

function formatFnType(fnType) {
	return remoteFnTypeMap[fnType] || fnType;
}

function setFunctionDetails(functionDetails) {
	if (!Array.isArray(functionDetails)) {
		throw new Error('Unknown data');
	}
	const fnsTable = document.querySelector('.section-body #functionTabB #tableFunction');
	clearSelectedRows(fnsTable);
	const tbody = fnsTable.querySelector('tbody');
	tbody.innerHTML = '';

	if (functionDetails.length === 0) {
		document.querySelector('#tableFunction thead th label').style = 'display:none';
		const emptyTr = document.createElement('tr');
		emptyTr.classList.add('no-search-row');
		emptyTr.innerHTML = `<td colspan="5" style="background-color: transparent;">
                No Catalyst Functions present in Catalyst console.
            </td>`;
		tbody.appendChild(emptyTr);
		return;
	}

	document.querySelector('#tableFunction thead th label').style = '';

	functionDetails.forEach((fn) => {
		const tr = document.createElement('tr');
		tr.style = '';
		tr.addEventListener('click', (e) => {
			if (
				e.target.parentNode.classList.contains('checkbox-container') ||
				e.target.classList.contains('icon-pull')
			) {
				return;
			}
			openFnRightModal(fn, tr);
		});

		tr.innerHTML = `
            <td class="w5p">
            <label class="checkbox-container">
                <input type="checkbox" onchange="getSelectRows(this)" />.
                <span class="checkmark"></span>
            </label>
            </td>
            <td class="w20p line-ellipsis">
            <div class="function-name txt-overflow-ellip overflow-hidden" id="search-value">${Encoder.encodeForHTML(
				fn.name
			)}</div>
            </td>
            <td class="w20p line-ellipsis">${Encoder.encodeForHTML(fn.id)}</td>
            <td class="w23p line-ellipsis">${Encoder.encodeForHTML(
				fn.created_by?.email_id || ''
			)}</td>
            <td class="w15p line-ellipsis">${Encoder.encodeForHTML(formatFnStack(fn.stack))}</td>
            <td class="w15p line-ellipsis">${Encoder.encodeForHTML(formatFnType(fn.type))}</td>
            <td class="pull">
            <div class="icon-pull" title="Pull" onclick="pullFunctions('${Encoder.encodeForJavaScript(
				fn.name
			)}')">
            </div>
            </td>`;

		tbody.appendChild(tr);
		tooltip();
	});

	const noResTr = document.createElement('tr');
	noResTr.classList.add('no-search-row');
	noResTr.style.display = 'none';
	noResTr.innerHTML = `<td colspan="5" style="background-color: transparent;">
        No Search Result Found
    </td>`;

	tbody.appendChild(noResTr);

	addFunctionSearchListener();
}

function setAppsailDetails(appSailDetails) {
	if (!Array.isArray(appSailDetails)) {
		throw new Error('Unknown data');
	}
	const sailTable = document.querySelector('.section-body #appsailTabB #tableAppsail');
	const tbody = sailTable.querySelector('tbody');
	tbody.innerHTML = '';

	if (appSailDetails.length === 0) {
		const emptyTr = document.createElement('tr');
		emptyTr.classList.add('no-search-row');
		emptyTr.innerHTML = `<td colspan="5" style="background-color: transparent;">
                No Catalyst AppSail present in Catalyst console.
            </td>`;
		tbody.appendChild(emptyTr);
		return;
	}

	// eslint-disable-line @zoho/webperf/no-complex-selector
	document.querySelector('#tableFunction th label').style = '';

	appSailDetails.forEach((sail) => {
		const tr = document.createElement('tr');
		tr.style = '';
		tr.addEventListener('click', (e) => {
			// if (
			// 	e.target.parentNode.classList.contains('checkbox-container') ||
			// 	e.target.classList.contains('icon-pull')
			// ) {
			// 	return;
			// }
			openAppSailRightModal(sail, tr);
		});

		tr.innerHTML = `
            <td class="w20p line-ellipsis">
            <div class="function-name txt-overflow-ellip overflow-hidden search-value">${Encoder.encodeForHTML(
				sail.name
			)}</div>
            </td>
            <td class="w20p line-ellipsis search-value">${Encoder.encodeForHTML(sail.id)}</td>
            <td class="w23p line-ellipsis">${Encoder.encodeForHTML(
				sail.created_by?.email_id || ''
			)}</td>
            <td class="w15p line-ellipsis">${Encoder.encodeForHTML(formatFnStack(sail.stack))}</td>
            `;

		tbody.appendChild(tr);
		tooltip();
	});

	const noResTr = document.createElement('tr');
	noResTr.classList.add('no-search-row');
	noResTr.classList.add('dN');
	noResTr.innerHTML = `<td colspan="5" style="background-color: transparent;">
        No Search Result Found
    </td>`;

	tbody.appendChild(noResTr);

	addAppSailSearchListeners();
}

const apigReqMethodStyleMap = {
	GET: {
		val: 'Get',
		class: 'get-req-btn'
	},
	ANY: {
		val: 'Any',
		class: 'any-req-btn'
	},
	POST: {
		val: 'Post',
		class: 'post-req-btn'
	},
	PUT: {
		val: 'Put',
		class: 'put-req-btn'
	},
	DELETE: {
		val: 'Delete',
		class: 'delete-req-btn'
	},
	PATCH: {
		val: 'Patch',
		class: 'patch-req-btn'
	},
	OPTIONS: {
		val: 'Options',
		class: 'options-req-btn'
	}
};

const apigTargetTypeMap = {
	advancedio: 'Advanced I/O',
	basicio: 'Basic I/O',
	client: 'Web Client Hosting'
};

function setApigRules(apigDetails) {
	const apigTabB = document.querySelector('.section-body #apiTabB');
	if (apigDetails.status === true) {
		apigTabB.querySelector('.enable-badge').style.display = '';
		apigTabB.querySelector('.disable-badge').style.display = 'none';
	} else {
		apigTabB.querySelector('.enable-badge').style.display = 'none';
		apigTabB.querySelector('.disable-badge').style.display = '';
	}

	const apigRules = apigDetails.rules;
	if (!Array.isArray(apigRules)) {
		throw new Error('Unknown data');
	}

	const tbody = apigTabB.querySelector('#tableApiGateway tbody');
	tbody.innerHTML = '';

	if (apigRules.length === 0) {
		document.getElementById('apigPullBtn').style.display = 'none';

		const emptyTr = document.createElement('tr');
		emptyTr.classList.add('no-search-row');
		emptyTr.style = '';
		emptyTr.innerHTML = `<td colspan="5">
                ${
					apigDetails.status === true
						? 'No APIG rules are present in Catalyst console'
						: 'API Gateway is disabled in Catalyst console'
				}.
            </td>`;
		tbody.appendChild(emptyTr);
		return;
	}
	document.getElementById('apigPullBtn').style.display = '';

	apigRules.forEach((api) => {
		const tr = document.createElement('tr');
		tr.style = '';
		tr.addEventListener('click', () => {
			openApiRightModal(tr, {
				rule: api,
				url: `${apigDetails.baseUrl}${api.source_endpoint}`
			});
		});

		const methodObject = apigReqMethodStyleMap[api.method];

		tr.innerHTML = `
        <td id="search-value" class="api-name w20p line-ellipsis">${Encoder.encodeForHTML(
			api.name
		)}</td>
        <td class="w10p line-ellipsis">
          <div class="${Encoder.encodeForHTML(methodObject.class)} w10p">${Encoder.encodeForHTML(
			methodObject.val
		)}</div>
        </td>
        <td class="w25p line-ellipsis">${Encoder.encodeForHTML(api.source_endpoint)}</td>
        <td class="w15p line-ellipsis">${Encoder.encodeForHTML(
			apigTargetTypeMap[api.target] || 'Unknown'
		)}</td>
        <td class="w30p line-ellipsis">${Encoder.encodeForHTML(api.target_endpoint)}</td>`;

		tbody.appendChild(tr);
		tooltip();
	});

	const noResTr = document.createElement('tr');
	noResTr.classList.add('no-search-row');
	noResTr.style.display = 'none';
	noResTr.innerHTML = `<td colspan="5">
        No Search Result Found
    </td>`;

	tbody.appendChild(noResTr);

	addAPISearchListeners();
}

function handleRemoteComponentDetails(details) {
	displayLoading(false);
	runtime.compDetails = details;

	if (details.client) {
		setClientDetails(details.client);
	}

	if (details.functions) {
		setFunctionDetails(details.functions);
	}

	if (details.appsails) {
		setAppsailDetails(details.appsails);
	}

	if (details.apig) {
		setApigRules(details.apig);
	}
}

function handleTokenDetails(tkDetails) {
	displayLoading(false);
	// Values here are always masked by the extension host; safe to keep.
	runtime.tokenDetails = tkDetails;
	if (!Array.isArray(tkDetails)) {
		return;
	}
	const manageTokens = document.querySelector('#manageTokenModal .project-list');
	manageTokens.innerHTML = '';

	tkDetails.forEach(([tkId, maskedTk, createdTime]) => {
		const tokenCard = document.createElement('div');
		tokenCard.classList.add('project-card');

		const detailsDiv = document.createElement('div');

		const tokenDetails = document.createElement('div');
		tokenDetails.classList.add('dF');

		const tokenId = document.createElement('div');
		tokenId.classList.add('manage-token-id', 'line-ellipsis');
		tokenId.innerText = maskedTk;
		tokenId.setAttribute('title', 'Click to reveal token in editor');
		tokenId.style.cursor = 'pointer';
		tokenId.addEventListener('click', () => {
			// The host shows the raw token in a VS Code InputBox so it never
			// enters the webview's JavaScript context or DOM.
			vscode.postMessage({
				action: {
					name: 'token_reveal', // No I18N
					data: tkId
				}
			});
		});
		tokenDetails.appendChild(tokenId);

		const copyTkSpan = document.createElement('span');
		copyTkSpan.classList.add('icon-copyic', 'cP');
		copyTkSpan.addEventListener('click', () => copyToken(tkId));
		copyTkSpan.setAttribute('title', 'Copy');
		tokenDetails.appendChild(copyTkSpan);
		detailsDiv.appendChild(tokenDetails);

		const tokenTime = document.createElement('p');
		tokenTime.classList.add('f_13_15_RR', 'secondary-font-color');
		tokenTime.innerText = createdTime;
		detailsDiv.appendChild(tokenTime);

		tokenCard.appendChild(detailsDiv);

		const revoke = document.createElement('span');
		revoke.classList.add('center-popup-hover-button', 'primary-bg-color', 'theme-font-color');
		revoke.innerText = 'Revoke';
		revoke.addEventListener('click', () => revokeToken(tkId));

		tokenCard.appendChild(revoke);
		manageTokens.appendChild(tokenCard);
		tooltip();
	});
}

function clearSearch() {
	const searchInputs = document.querySelectorAll('.search-box input');
	searchInputs.forEach((ips) => {
		ips.value = '';
	});
}

function projectSwitch(projectId) {
	clearSearch();
	vscode.postMessage({
		action: {
			name: 'project_switch',
			data: projectId
		}
	});
	displayLoading();
}

function projectReset() {
	clearSearch();
	vscode.postMessage({
		action: {
			name: 'project_reset'
		}
	});
	displayLoading();
}

function projectReinit(project) {
	clearSearch();
	vscode.postMessage({
		action: {
			name: 'project_reinit',
			data: project
		}
	});
	displayLoading();
}

function pullClient(version) {
	vscode.postMessage({
		action: {
			name: 'client_pull',
			data: version
		}
	});
}

function fnModalPull() {
	const fnName = document.querySelector('#fnModal #fnName').innerText;
	pullFunctions(fnName);
}

function pullFunctions(fnName) {
	const functions = [];
	if (!fnName) {
		const fns = document.querySelectorAll('#tableFunction tbody tr');
		fns.forEach((val) => {
			val.querySelector('input')?.checked &&
				functions.push(val.querySelector('td .function-name').innerText);
		});
	} else {
		functions.push(fnName);
	}

	vscode.postMessage({
		action: {
			name: 'functions_pull',
			data: functions
		}
	});
}

function pullAPIG() {
	vscode.postMessage({
		action: {
			name: 'apig_pull'
		}
	});
}

function copyToken(tokenId) {
	vscode.postMessage({
		action: {
			name: 'token_copy',
			data: tokenId
		}
	});
}

function generateToken() {
	vscode.postMessage({
		action: {
			name: 'token_generate'
		}
	});
	displayLoading();
}

function revokeToken(tkId) {
	vscode.postMessage({
		action: {
			name: 'token_revoke',
			data: tkId
		}
	});
	displayLoading();
}

function refreshWebView() {
	displayLoading();
	vscode.postMessage({
		action: {
			name: 'reload'
		}
	});
}
