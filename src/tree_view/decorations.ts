import { FileDecoration, FileDecorationProvider, ProviderResult, ThemeColor, Uri } from 'vscode';

export class serveDecorationProvider implements FileDecorationProvider {
	// onDidChangeFileDecorations?: Event<Uri | Uri[] | undefined> | undefined;
	provideFileDecoration(uri: Uri): ProviderResult<FileDecoration> {
		if (uri.path === '/servingTreeItem') {
			return {
				color: new ThemeColor('zcatalyst.treeView.serve')
			};
		}
	}
}
