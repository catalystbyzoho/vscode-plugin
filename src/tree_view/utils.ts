import CatalystTreeView from '.';
import { setContext } from '../utils';

export async function displayNoFolderView() {
	CatalystTreeView.setViewMessage('Unable to find any open folders.', {
		refreshTree: false
	});
	await setContext('viewWelcome.view', 'NoFolder');
}
