/* eslint-disable @typescript-eslint/no-unused-vars */

const { Encoder } = ZSEC;

function tabSwitch(e) {
	removeActiveTab();
	if (e.getAttribute('id') === 'clientTab') {
		document.getElementById('clientTab').classList.add('active-tab');
		document.getElementById('clientTabB').setAttribute('show', true);
	} else if (e.getAttribute('id') === 'functionTab') {
		document.getElementById('functionTab').classList.add('active-tab');
		document.getElementById('functionTabB').setAttribute('show', true);
	} else if (e.getAttribute('id') === 'appsailTab') {
		document.getElementById('appsailTab').classList.add('active-tab');
		document.getElementById('appsailTabB').setAttribute('show', true);
	} else {
		document.getElementById('apiTab').classList.add('active-tab');
		document.getElementById('apiTabB').setAttribute('show', true);
	}
}

function removeActiveTab() {
	var i, head, body;
	head = document.querySelector('.tab-head').children;
	for (i = 0; i < head.length; i++) {
		if (head[i].classList.value.includes('active-tab')) {
			head[i].classList.remove('active-tab');
			break;
		}
	}
	body = document.querySelector('.tab-body').children;
	for (i = 0; i < body.length; i++) {
		if (body[i].getAttribute('show') === 'true') {
			body[i].setAttribute('show', 'false');
			break;
		}
	}
}

function showMore() {
	var ele = document.getElementById('moreOptions').nextElementSibling;
	if (ele.classList.value.includes('dN')) {
		ele.classList.add('dF');
		ele.classList.remove('dN');
	} else {
		ele.classList.remove('dF');
		ele.classList.add('dN');
	}
}

function getSelectRows(curr) {
	var node,
		i,
		count = 0,
		ele;
	node = curr.closest('tbody').querySelectorAll('tr');
	for (i = 0; i < node.length - 1; i++) {
		if (node[i].querySelector('input').checked) {
			count = count + 1;
		}
	}
	ele = curr.closest('.tab').querySelector('#tabContent');
	if (count > 0) {
		ele.children[0].setAttribute('show-content', 'false');
		ele.children[1].setAttribute('show-content', '');
		ele.children[1].querySelector('#selected-count').innerText = count;
		if (count === node.length - 1) {
			curr.closest('table').querySelector('input').checked = true;
		} else {
			curr.closest('table').querySelector('input').checked = false;
		}
	} else {
		ele.children[0].setAttribute('show-content', '');
		ele.children[1].setAttribute('show-content', 'false');
		curr.closest('table').querySelector('input').checked = false;
	}
}

function selectAllRows(curr) {
	var ele, i;
	ele = curr.closest('thead').nextElementSibling.children;
	for (i = 0; i < ele.length - 1; i++) {
		const curEle = ele[i];
		if (curEle.classList.value.includes('dN')) {
			// do not process
		} else if (curr.checked) {
			curEle.querySelector('input').checked = true;
		} else {
			curEle.querySelector('input').checked = false;
		}
	}
	getSelectRows(curr.closest('thead').nextElementSibling);
}

function clearSelectedRows(fnsTableEle) {
	const fnsTable =
		fnsTableEle || document.querySelector('.section-body #functionTabB #tableFunction');
	const fnsTabHeadInput = fnsTable.querySelector('thead input');
	if (!fnsTabHeadInput) {
		return;
	}
	fnsTabHeadInput.checked = false;
	selectAllRows(fnsTabHeadInput);
}

function addClientSearchListener() {
	var client_search = document.getElementById('clientSearch');
	client_search.addEventListener('keyup', clientSearchFun);
}

function clientSearchFun() {
	var count = 0;
	var a = document.querySelectorAll('table#tableClient tbody')[0].children;
	for (var i = 0; i < a.length - 1; i++) {
		var val = document.getElementById('clientSearch').value.toLowerCase();
		if (a[i].querySelector('#search-value').innerText.toLowerCase().indexOf(val) != -1) {
			a[i].classList.add('dF');
			a[i].classList.remove('dN');
		} else {
			a[i].classList.remove('dF');
			a[i].classList.add('dN');
			count++;
		}
	}
	if (count === a.length - 1) {
		a[a.length - 1].style = '';
	} else {
		a[a.length - 1].style = 'display: none';
	}
}

function addFunctionSearchListener() {
	var function_search = document.getElementById('functionSearch');
	function_search.addEventListener('keyup', functionSearchFun);
}

function functionSearchFun() {
	var count = 0;
	var a = document.querySelectorAll('table#tableFunction tbody')[0].children;
	for (var i = 0; i < a.length - 1; i++) {
		var val = document.getElementById('functionSearch').value.toLowerCase();
		var ele = document.getElementById('tableFunction').querySelector('td');
		if (a[i].querySelector('#search-value').innerText.toLowerCase().indexOf(val) !== -1) {
			a[i].classList.add('dF');
			a[i].classList.remove('dN');
			getSelectRows(ele);
		} else {
			a[i].classList.remove('dF');
			a[i].classList.add('dN');
			getSelectRows(ele);
			count++;
		}
	}
	if (count === a.length - 1) {
		a[a.length - 1].style = '';
	} else {
		a[a.length - 1].style = 'display: none';
	}
}

function addAppSailSearchListeners() {
	var appsailSearchEle = document.getElementById('appsailSearch');
	appsailSearchEle.addEventListener('keyup', appsailSearch);
}

function getTbody(tableId) {
	const table = document.getElementById(tableId);
	if (!table) {
		throw new Error('Element not a table > ' + tableId);
	}
	return Array.from(table.children)?.find((_) => _.tagName.toLowerCase() === 'tbody');
}

function appsailSearch() {
	var count = 0;
	const rows = getTbody('tableAppsail')?.children;
	var val = document.getElementById('appsailSearch').value.toLowerCase();

	Array.from(rows).forEach((row) => {
		const isMatch = Array.from(
			row.querySelectorAll('.search-value').entries(),
			(e) => e[1]
		).find((ele) => ele.innerHTML.toLowerCase().includes(val));
		if (isMatch) {
			row.classList.add('dF');
			row.classList.remove('dN');
		} else {
			row.classList.remove('dF');
			row.classList.add('dN');
			count++;
		}
	});
	if (count === rows.length) {
		rows[rows.length - 1]?.classList.remove('dN');
	} else {
		rows[rows.length - 1]?.classList.add('dN');
	}
}

function addAPISearchListeners() {
	var api_search = document.getElementById('apiSearch');
	api_search.addEventListener('keyup', apiSearchFun);
}

function apiSearchFun() {
	var count = 0;
	var a = document.querySelectorAll('table#tableApiGateway tbody')[0].children;
	for (var i = 0; i < a.length - 1; i++) {
		var val = document.getElementById('apiSearch').value.toLowerCase();
		if (a[i].querySelector('#search-value').innerText.toLowerCase().indexOf(val) !== -1) {
			a[i].classList.add('dF');
			a[i].classList.remove('dN');
		} else {
			a[i].classList.remove('dF');
			a[i].classList.add('dN');
			count++;
		}
	}
	if (count === a.length - 1) {
		a[a.length - 1].style = '';
	} else {
		a[a.length - 1].style = 'display: none';
	}
}

function openReinit() {
	closeAllRightModal();
	var ele;
	ele = document.getElementById('reinitPopup');
	ele.style = '';
	setTimeout(() => {
		ele.classList.add('centerPopupShow');
	}, 1);
	displayFreezeLayer();
}

function closeReinit(_ele) {
	const ele = _ele || document.getElementById('reinitPopup');
	ele.classList.remove('centerPopupShow');
	setTimeout(() => {
		ele.style.display = 'none';
	}, 100);
	displayFreezeLayer(false);
}

function autoCloseReinit(e) {
	ele = document.getElementById('reinitPopup');
	if (ele.classList.value.includes('centerPopupShow')) {
		closeReinit(ele);
	}
}

function setFnModal(fnRightModal, fnDetails) {
	fnRightModal.querySelector('#fnName').innerText = fnDetails.name;
	fnRightModal.querySelector('#fnId').innerText = fnDetails.id;
	fnRightModal.querySelector('#fnCreatedBy').innerText = fnDetails.created_by?.email_id;
	fnRightModal.querySelector('#fnCreatedTime').innerText = fnDetails.created_time;
	fnRightModal.querySelector('#fnStack').innerText = formatFnStack(fnDetails.stack);
	fnRightModal.querySelector('#fnType').innerText = formatFnType(fnDetails.type);
	fnRightModal.querySelector('#fnMemory').innerText = fnDetails.configuration?.memory;

	const invocationUrl = fnRightModal.querySelector('#invocationUrl');
	const prevUrl = fnRightModal.querySelector('.preview-url-block');

	if (nonHttpFns.includes(fnDetails.type)) {
		invocationUrl.classList.add('dN');
		prevUrl.classList.add('dN');
		return;
	}

	invocationUrl.classList.remove('dN');
	prevUrl.classList.remove('dN');

	prevUrl.innerHTML = '';
	const fnUrl = document.createElement('div');
	fnUrl.classList.add('f_15_18_RR', 'primary-font-color', 'word-break-all');
	fnUrl.innerText = fnDetails.invoke_url;
	fnUrl.style.textDecoration = 'underline';
	fnUrl.addEventListener('click', () =>
		vscode.postMessage({
			action: {
				name: 'open_link',
				data: fnDetails.invoke_url
			}
		})
	);
	prevUrl.appendChild(fnUrl);
}

function openFnRightModal(fnDetails, tableRow) {
	closeAllRightModal('fnModal');
	tableRow.classList.add('active');
	displayFreezeLayer();
	const fnRightModal = document.getElementById('fnModal');
	if (fnRightModal.classList.contains('closed')) {
		setFnModal(fnRightModal, fnDetails);
		fnRightModal.classList.remove('closed');
		return;
	}

	fnRightModal.classList.add('closed');
	setTimeout(() => {
		setFnModal(fnRightModal, fnDetails);
		fnRightModal.classList.remove('closed');
	}, 100);
}

function setAppSailModal(sailRModal, sailDetails) {
	sailRModal.querySelector('#appSailName').innerText = sailDetails.name;
	sailRModal.querySelector('#appSailId').innerText = sailDetails.id;
	sailRModal.querySelector('#appSailCreatedBy').innerText = sailDetails.created_by?.email_id;
	sailRModal.querySelector('#appSailCreatedTime').innerText = sailDetails.created_time;
	const sailStack = sailRModal.querySelector('#appSailStack');
	if (sailDetails.stack) {
		sailStack.parentNode.classList.remove('dN');
		sailStack.innerText = formatFnStack(sailDetails.stack);
	} else {
		sailStack.parentNode.classList.add('dN');
	}
	const sailPlatform = sailRModal.querySelector('#appSailPlatform');
	if (sailDetails.deployment_type) {
		sailPlatform.parentNode.classList.remove('dN');
		sailPlatform.innerText = sailDetails.deployment_type;
	} else {
		sailPlatform.parentNode.classList.add('dN');
	}
	sailRModal.querySelector('#appSailMemory').innerText = sailDetails.configuration?.memory;

	const command = sailRModal.querySelector('#command');
	const commandLabel = sailRModal.querySelector('#commandLabel');
	if (sailDetails.configuration.startup_command) {
		commandLabel.classList.remove('dN');
		command.classList.remove('dN');
		command.innerHTML = '';
		const pre = document.createElement('pre');
		const code = document.createElement('code');
		code.innerText = sailDetails.configuration.startup_command;
		pre.appendChild(code);
		command.appendChild(pre);
	} else {
		command.classList.add('dN');
		commandLabel.classList.add('dN');
	}

	const prevUrl = sailRModal.querySelector('#url');
	prevUrl.innerHTML = '';
	const sailUrl = document.createElement('div');
	sailUrl.classList.add('f_15_18_RR', 'primary-font-color', 'word-break-all');
	sailUrl.innerText = sailDetails.url;
	sailUrl.style.textDecoration = 'underline';
	sailUrl.addEventListener('click', () =>
		vscode.postMessage({
			action: {
				name: 'open_link',
				data: sailDetails.url
			}
		})
	);
	prevUrl.appendChild(sailUrl);
}

function openAppSailRightModal(appsailDetails, tableRow) {
	closeAllRightModal('appsailModal');
	tableRow.classList.add('active');
	displayFreezeLayer();
	const sailRModal = document.getElementById('appsailModal');
	if (sailRModal.classList.contains('closed')) {
		setAppSailModal(sailRModal, appsailDetails);
		sailRModal.classList.remove('closed');
		return;
	}

	sailRModal.classList.add('closed');
	setTimeout(() => {
		setAppSailModal(sailRModal, fnDetails);
		sailRModal.classList.remove('closed');
	}, 100);
}

function convertDuration(e) {
	var t,
		n = {
			units: { days: 'days', hours: 'hours', minutes: 'minutes', seconds: 'secs' },
			pojo: {
				seconds: 'seconds',
				minutes: 'minutes',
				hours: 'hours',
				days: 'days'
			}
		},
		a =
			0 !== e[n.pojo.seconds]
				? n.units.seconds
				: 0 !== e[n.pojo.minutes]
				? n.units.minutes
				: 0 !== e[n.pojo.hours]
				? n.units.hours
				: n.units.days;
	switch (a) {
		case n.units.seconds:
			t =
				e[n.pojo.seconds] +
				60 * e[n.pojo.minutes] +
				3600 * e[n.pojo.hours] +
				86400 * e[n.pojo.days];
			break;
		case n.units.minutes:
			t = e[n.pojo.minutes] + 60 * e[n.pojo.hours] + 1440 * e[n.pojo.days];
			break;
		case n.units.hours:
			t = e[n.pojo.hours] + 24 * e[n.pojo.days];
			break;
		case n.units.days:
			t = e[n.pojo.days];
	}
	return {
		value: t,
		unit: a
	};
}

function setApiModal(modal, apig) {
	modal.querySelector('#apigRuleAuth').innerText =
		apig.rule?.authentication?.reduce((allAuth, auth, idx, arr) => {
			const sep = idx === arr.length - 1 ? '.' : ',\n';
			allAuth +=
				auth === 'CatalystUserManagement' ? 'CatalystAuthentication' + sep : auth + sep;
			return allAuth;
		}, '') || 'No Authentication';
	const genThrottling = apig.rule?.throttling?.overall;

	if (Object.keys(genThrottling).length > 0) {
		const duration = convertDuration(genThrottling.duration);
		modal.querySelector('#apigRuleGenThrottling').innerText = duration
			? `${genThrottling.limit} request(s) per ${duration.value} ${duration.unit}`
			: 'Not Configured';
	} else {
		modal.querySelector('#apigRuleGenThrottling').innerText = 'Not Configured';
	}

	const ipThrottling = apig.rule?.throttling?.ip;
	if (Object.keys(ipThrottling).length > 0) {
		const duration = convertDuration(ipThrottling.duration);
		modal.querySelector('#apigRuleIpThrottling').innerText = duration
			? `${ipThrottling.limit} request(s) per ${duration.value} ${duration.unit}`
			: 'Not Configured';
	} else {
		modal.querySelector('#apigRuleIpThrottling').innerText = 'Not Configured';
	}

	modal.querySelector('#apigRulePrevUrl').innerText = apig.url;
}

function openApiRightModal(tableRow, apigRule) {
	closeAllRightModal('apiModal');
	tableRow.classList.add('active');
	displayFreezeLayer();
	const apigRightModal = document.getElementById('apiModal');
	if (apigRightModal.classList.contains('closed')) {
		setApiModal(apigRightModal, apigRule);
		apigRightModal.classList.remove('closed');
		return;
	}

	apigRightModal.classList.add('closed');
	setTimeout(() => {
		setApiModal(apigRightModal, apigRule);
		apigRightModal.classList.remove('closed');
	}, 100);
}
function openManageTokenRightModal() {
	closeAllRightModal('manageTokenModal');
	document.getElementById('manageTokenModal').classList.remove('closed');
	displayFreezeLayer();
}

function closeAllRightModal(except) {
	const rightModals = document.querySelectorAll('.right-panel');
	rightModals.forEach((modal) => modal.id !== except && closeRightModal(modal));
	displayFreezeLayer(false);
}
function closeRightModal(e) {
	e.closest('.right-panel').classList.add('closed');
	if (document.querySelector('table tr.active')) {
		document.querySelector('table tr.active').classList.remove('active');
	}
	displayFreezeLayer(false);
}
function autoCloseRightModal(e) {
	if (
		!e.target.closest('table') &&
		!e.target.classList.contains('manage-token-btn') &&
		!e.target.closest('#manageToken')
	) {
		var ele, i;
		if (document.querySelector('table tr.active')) {
			document.querySelector('table tr.active').classList.remove('active');
		}
		ele = document.querySelectorAll('.right-panel');
		for (i = 0; i < ele.length; i++) {
			!ele[i].classList.contains('closed') && ele[i].classList.add('closed');
		}
	}
	displayFreezeLayer(false);
}

function closeAllModal() {
	autoCloseReinit();
	closeAllRightModal();
}

function addFreezeLayerEscListener() {
	const freezeLayer = document.getElementById('freezeLayer');
	freezeLayer.addEventListener('click', closeAllModal);

	// eslint-disable-line @zoho/zstandard/no-body-events
	document.addEventListener('keyup', (key) => {
		if (!isFreezeLayerDisplayed()) {
			return;
		}

		if (key.code === 'Escape') {
			closeAllModal();
			closeAllSelect();
		}
	});
}

/**
 * Display the freeze layer
 * @param {*} display false if don't wan to display the layer
 */
function displayFreezeLayer(display = true) {
	const freezeLayer = document.getElementById('freezeLayer');
	if (display) {
		freezeLayer.classList.remove('dN');
		freezeLayer.classList.add('dB');
		return;
	}
	freezeLayer.classList.remove('dB');
	freezeLayer.classList.add('dN');
}

function isFreezeLayerDisplayed() {
	return document.getElementById('freezeLayer')?.classList.contains('dB');
}

function autoCloseHeaderMoreOptions(e) {
	if (!e.target.classList.value.includes('header-icon-btn', 'icon-more')) {
		var ele = document.querySelector('.logout-btn');
		ele.classList.remove('dF');
		ele.classList.add('dN');
	}
}

function addHeaderOptionsAutoCloseListener() {
	document.addEventListener('click', autoCloseHeaderMoreOptions);
}

// ToolTip
function tooltip() {
	var cells = document.getElementsByClassName('line-ellipsis');
	for (const cell of cells) {
		if (cell.offsetWidth < cell.scrollWidth) {
			cell.setAttribute('title', Encoder.encodeForHTML(cell.innerText));
		}
	}
	tippy('[title]', {
		arrow: true,
		flipBehavior: ['top', 'right', 'bottom', 'left'],
		delay: 10,
		distance: 14,
		maxWidth: 300,

		allowHTML: true,
		theme: 'custom',
		ignoreAttributes: true,
		content(reference) {
			const title = reference.getAttribute('title');
			reference.removeAttribute('title');
			return title;
		}
	});
}
Window.onload = tooltip();

// eslint-disable-line @zoho/zstandard/no-body-events
document.addEventListener('DOMContentLoaded', () => {
	addFreezeLayerEscListener();
	addHeaderOptionsAutoCloseListener();
});
