import { commands, Disposable, window } from 'vscode';
import Inputs, { TQuickPickItem } from '../inputs.js';
import { IAppSailDetail, ICatalystJson, IClientDetail, IFnDetail } from '../util_types/config.js';
import { registerCommands } from './utils.js';
import { FunctionsTree, FunctionsTreeItem } from '../tree_view/functions.js';
import { ClientTree } from '../tree_view/client.js';
import { DeployTerminal } from '../terminal/deploy.js';
import { FILENAMES } from '../constants.js';
import { ApigTreeItem, ConfigTree } from '../tree_view/configs.js';
import { AppSailTree } from '../tree_view/appsail.js';

const codeLenseDeployTargets = ['client', 'apig', 'functions', 'appsail'] as const;
type TCodeLenseDeployTargets = typeof codeLenseDeployTargets[number];

async function codeLenseDeploy(catalystJson: ICatalystJson, type?: TCodeLenseDeployTargets) {
	const targets: Array<string> = [];

	switch (type) {
		case 'functions': {
			catalystJson.functions &&
				targets.push(...catalystJson.functions.targets.map((fn) => `functions:${fn}`));
			break;
		}
		case 'client': {
			catalystJson.client && targets.push('client');
			break;
		}
		case 'apig': {
			catalystJson.apig && targets.push('apig');
		}
		case 'appsail': {
			catalystJson.appsail && targets.push('appsail');
		}
		default: {
			Object.keys(catalystJson).forEach(
				(key) =>
					codeLenseDeployTargets.includes(key as TCodeLenseDeployTargets) &&
					targets.push(key)
			);
		}
	}

	if (targets.length === 0) {
		window
			.showErrorMessage(
				'No Catalyst components found to deploy, Do you wish to initialize new Catalyst components?',
				'Initialize'
			)
			.then((res) => {
				if (res === 'Initialize') {
					commands.executeCommand('zcatalyst.init.init');
				}
			});
		return;
	}

	const confirmDeployInputs = Inputs.confirmQuestion(
		'deploy',
		'Catalyst Deploy',
		`Do you wish to deploy all the components listed in ${FILENAMES.CATALYST_JSON}?`
	);

	// eslint-disable-next-line no-console
	const confirmDeploy = await confirmDeployInputs.getInputs().catch((err) => console.error(err));

	if (confirmDeploy && confirmDeploy.deploy) {
		try {
			const deployTerminal = await DeployTerminal.initTerminal();

			const res = await deployTerminal.deploy(targets);

			if (res && (res.exitCode === 2 || res.error)) {
				throw res;
			}
		} catch (err) {
			window.showErrorMessage(
				'Unable to deploy' + (err instanceof Error ? ': ' + err.message : '')
			);
		}
	}
}

async function deployAll(
	functionsTree: FunctionsTree,
	appSailTree: AppSailTree,
	clientTree: ClientTree,
	configTree: ConfigTree
) {
	const allComponents = {
		httpFns: functionsTree.httpFunctionsTreeProvider.items,
		nonHttpFns: functionsTree.nonHttpFunctionsTreeProvider.items,
		appsail: appSailTree.items,
		client: clientTree.items[0],
		apig: configTree.apig instanceof ApigTreeItem && configTree.apig.apigStatus
	};

	if (
		allComponents.httpFns.length === 0 &&
		allComponents.nonHttpFns.length === 0 &&
		allComponents.appsail.length === 0 &&
		!allComponents.client &&
		!allComponents.apig
	) {
		window
			.showErrorMessage(
				'No Catalyst components found to deploy, Do you wish to initialize new Catalyst components?',
				'Initialize'
			)
			.then((res) => {
				if (res === 'Initialize') {
					commands.executeCommand('zcatalyst.init.init');
				}
			});
		return;
	}

	const deployInputs = new Inputs();

	deployInputs.push(() =>
		Inputs.createQuickPick(
			'deployAll',
			[
				['Yes', true, 'Deploy all components'],
				['No', false, 'Let me pick the components to deploy']
			],
			{
				title: 'Deploy',
				placeHolder: 'Do you wish to deploy all the Catalyst components?'
			}
		)
	);

	const deployComponents = Object.keys(allComponents).reduce(
		(acc, key) => {
			switch (key) {
				case 'httpFns': {
					const component = allComponents[key] as Array<FunctionsTreeItem>;
					component.forEach((comp) => {
						switch (comp.fnDetails.type) {
							case 'advancedio': {
								acc.aio.push([
									comp.fnDetails.name,
									`functions:${comp.fnDetails.name}`
								]);
								break;
							}
							case 'basicio': {
								acc.bio.push([
									comp.fnDetails.name,
									`functions:${comp.fnDetails.name}`
								]);
								break;
							}
							case 'browser_logic': {
								acc.browser_logic.push([
									comp.fnDetails.name,
									`functions:${comp.fnDetails.name}`
								]);
								break;
							}
						}
					});
					break;
				}
				case 'nonHttpFns': {
					const component = allComponents[key] as Array<FunctionsTreeItem>;
					component.forEach((comp) => {
						switch (comp.fnDetails.type) {
							case 'cron': {
								acc.cron.push([
									comp.fnDetails.name,
									`functions:${comp.fnDetails.name}`
								]);
								break;
							}
							case 'job': {
								acc.job.push([
									comp.fnDetails.name,
									`functions:${comp.fnDetails.name}`
								]);
								break;
							}
							case 'event': {
								acc.event.push([
									comp.fnDetails.name,
									`functions:${comp.fnDetails.name}`
								]);
								break;
							}
							case 'integration': {
								acc.integ.push([
									comp.fnDetails.name,
									`functions:${comp.fnDetails.name}`
								]);
								break;
							}
						}
					});
					break;
				}
				case 'appsail': {
					const appSail = allComponents.appsail;
					appSail.forEach((sail) =>
						acc.appsail.push([
							sail.appSailDetails.name,
							`appsail:${sail.appSailDetails.name}`
						])
					);
					break;
				}
				case 'client': {
					const client = allComponents[key];
					client && acc.client.push([client.clientDetail.name || 'client', 'client']);
					break;
				}
				case 'apig': {
					allComponents[key] && acc.apig.push(['APIG', 'apig']);
				}
			}
			return acc;
		},
		{
			client: [] as Array<TQuickPickItem<string>>,
			apig: [] as Array<TQuickPickItem<string>>,
			aio: [] as Array<TQuickPickItem<string>>,
			bio: [] as Array<TQuickPickItem<string>>,
			browser_logic: [] as Array<TQuickPickItem<string>>,
			event: [] as Array<TQuickPickItem<string>>,
			cron: [] as Array<TQuickPickItem<string>>,
			job: [] as Array<TQuickPickItem<string>>,
			integ: [] as Array<TQuickPickItem<string>>,
			appsail: [] as Array<TQuickPickItem<string>>
		}
	);

	const featLabels = {
		aio: 'AdvancedIO Functions',
		bio: 'BasicIO Functions',
		browser_logic: 'Browser Logic Functions',
		event: 'Event Functions',
		cron: 'Cron Functions',
		job: 'Job Functions',
		integ: 'Integration Functions',
		appsail: 'AppSail',
		client: 'Client',
		apig: 'APIG'
	};

	const deploysArr = Object.entries(deployComponents).reduce((acc, [key, val]) => {
		if (val.length > 0) {
			val.unshift([featLabels[key as keyof typeof featLabels], key, undefined, true]);
			acc.push(...val);
		}
		return acc;
	}, [] as Array<TQuickPickItem>);

	deployInputs.push<string, boolean>((prev) => {
		if (Array.isArray(prev) && prev[0] === true) {
			return;
		}
		return Inputs.createQuickPick('components', deploysArr, {
			placeHolder: 'Please select the components to deploy',
			title: 'Deploy to Catalyst Remote Console',
			multiSelect: true
		});
	});

	const res = await deployInputs.getInputs();

	(await DeployTerminal.initTerminal()).deploy(res.components as Array<string>);
}

async function deployFunction(fnDetail: IFnDetail) {
	const fnDeployInput = await Inputs.confirmQuestion(
		'deployFn',
		'Deploy Function',
		`Do you want to deploy the ${fnDetail.name} function ?`
	).getInputs();
	fnDeployInput.deployFn &&
		(await DeployTerminal.initTerminal()).deploy([`functions:${fnDetail.name}`]);
}

async function deployAppSail(appSailDetails: IAppSailDetail) {
	const sailDeployInput = await Inputs.confirmQuestion(
		'deploySail',
		'Deploy AppSail',
		`Do you want to deploy the ${appSailDetails.name} AppSail ?`
	).getInputs();
	sailDeployInput.deploySail &&
		(await DeployTerminal.initTerminal()).deploy([`appsail:${appSailDetails.name}`]);
}

async function deployClient(clientDetail: IClientDetail) {
	const clientDeployInput = await Inputs.confirmQuestion(
		'deployClient',
		'Deploy Web Client',
		`Do you want to deploy the ${clientDetail.name}(v${clientDetail.version}) Web Client ?`
	).getInputs();
	clientDeployInput.deployClient && (await DeployTerminal.initTerminal()).deploy(['client']);
}

async function deployAPIG() {
	const apigDeployInput = await Inputs.confirmQuestion(
		'deployApig',
		'Deploy APIG',
		'Do you want to deploy the API Gateway rules to Catalyst Remote Console ?'
	).getInputs();
	apigDeployInput.deployApig && (await DeployTerminal.initTerminal()).deploy(['apig']);
}
export default function registerDeployCommands(): Array<Disposable> {
	const cmdPrefix = 'deploy.';
	const deployCommands: Array<[string, (...arg: Array<any>) => unknown]> = [
		[cmdPrefix + 'deploy', deployAll],
		[cmdPrefix + 'codeLense', codeLenseDeploy],
		[cmdPrefix + 'function', deployFunction],
		[cmdPrefix + 'appSail', deployAppSail],
		[cmdPrefix + 'client', deployClient],
		[cmdPrefix + 'apig', deployAPIG]
	];
	return registerCommands(deployCommands, { auth: true });
}
