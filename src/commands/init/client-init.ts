import { window } from 'vscode';
import { catalystExec, getCatalystRoot, ICatalystResult } from '../../catalyst';
import Inputs, { TOutput } from '../../inputs';
import { setStatusBarMessage } from '../../status-bar';
import { refreshTreeView, resolveSafePath, setContext } from '../../utils';
import { ClientDetails, overwrite } from './utils';
import { ClientTreeItem } from '../../tree_view/client';

function initClient(): Inputs {
	const catalystRoot = getCatalystRoot();
	const clientInit = new Inputs();
	clientInit.push(() =>
		Inputs.createQuickPick(
			'clientType',
			[
				['Angular web app', 'ANGULAR'],
				['React web app', 'REACT'],
				['Basic web app', 'BASIC']
			],
			{
				title: 'Client Type',
				placeHolder: 'Please select the type of client to initialize'
			}
		)
	);
	clientInit.push<string>((prev) => {
		if (!Array.isArray(prev)) {
			throw new Error('Unknown client type');
		}
		const clientNameValidate = async (name: string, folderName: string, relativePath: string) => {
			if (!name.match(/^[a-zA-Z0-9_-]*$/g)) {
				return 'Invalid name for the Web client. Should contain only alphanumeric, underscore and hyphen characters.';
			}
			const path = await resolveSafePath(catalystRoot, relativePath);
			return overwrite(catalystRoot, folderName, path);
		};
		switch (prev[0]) {
			case 'ANGULAR': {
				const angularInput = new Inputs();
				angularInput.push(() =>
					Inputs.createInputBox(
						'clientName',
						'Angular App',
						'Please provide a name for your Angular App',
						{
							defaultVal: 'angular-app',
							validate: (val = 'client') =>
								clientNameValidate(val, 'client', 'client')
						}
					)
				);
				angularInput.push(() =>
					Inputs.confirmQuestion(
						'angularAppRouting',
						'Angular Routing',
						'Would you like to add Angular routing?'
					)
				);
				angularInput.push(() =>
					Inputs.createQuickPick(
						'angularAppStyleSheetFormat',
						[
							'CSS',
							['SCSS', 'SCSS', 'https://sass-lang.com/documentation/syntax#scss'],
							[
								'Sass',
								'Sass',
								'https://sass-lang.com/documentation/syntax#the-indented-syntax'
							],
							['Less', 'Less', 'http://lesscss.org']
						],
						{
							title: 'Stylesheet format',
							placeHolder: 'Which stylesheet format would you like to use?'
						}
					)
				);
				return angularInput;
			}
			case 'REACT': {
				const reactInput = new Inputs();
				reactInput.push(() =>
					Inputs.createQuickPick('reactLang', ['JavaScript', 'TypeScript'], {
						title: 'React',
						placeHolder: 'Choose a programming language to create the react app'
					})
				);
				reactInput.push(() =>
					Inputs.createInputBox(
						'clientName',
						'React App Name',
						'Please enter a name for your React App',
						{
							defaultVal: 'react-app',
							validate: (val: string) =>
								clientNameValidate(val, val, val)
						}
					)
				);

				return reactInput;
			}
			default: {
				return Inputs.createInputBox(
					'clientName',
					'Web Client Name',
					'Please enter a name for your web app',
					{
						defaultVal: 'sample-app',
						prompt: 'A directory client will be created with a webapp pre-configured.',
						validate: (val) =>
							clientNameValidate(val, 'client', 'client')
					}
				);
			}
		}
	});
	return clientInit;
}

let addingClient = false;

export async function clientSetup(details?: TOutput<unknown>): Promise<void | ICatalystResult> {
	if (details instanceof ClientTreeItem) {
		details = undefined;
	}
	if (addingClient === true) {
		window.showWarningMessage('Already adding a client');
		return;
	}
	try {
		addingClient = true;
		await setContext('viewWelcome.client.enable', false); // disable welcome view buttons
		const clientDetails = details || (await initClient().getInputs());
		const catalystRoot = getCatalystRoot();
		const clientInitDetails = new ClientDetails(clientDetails).getDetails();

		const clientInitRes = await setStatusBarMessage(
			'$(loading~spin) Adding client',
			catalystExec('client:setup', catalystRoot, catalystRoot, {
				inputs: clientInitDetails
			})
			// eslint-disable-next-line no-console
		).catch((err) => console.error('Unable to execute the catalyst command', err));

		if (!clientInitRes) {
			return;
		}

		if (clientInitRes.exitCode === 2 || clientInitRes.error) {
			// eslint-disable-next-line no-console
			console.error(clientInitRes.error);
			window.showErrorMessage(
				'Unable to add the client to project: ' + clientInitRes.error?.message ||
					'Unknown Error'
			);
			return clientInitRes as ICatalystResult;
		}

		window.showInformationMessage('Client added to project successfully');
		if (!details) {
			refreshTreeView();
		}
		return clientInitRes as ICatalystResult;
	} catch (e) {
		throw e;
	} finally {
		addingClient = false;
		await setContext('viewWelcome.client.enable', true); // enable welcome view buttons
	}
}
