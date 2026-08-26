import { CancellationToken, Progress, ProgressLocation, StatusBarAlignment, window } from 'vscode';
import { timeOut } from './utils';

const STATUS_ICON = '$(zcatalyst-logo) Catalyst';
const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
statusBarItem.show();
statusBarItem.tooltip = 'Catalyst';
statusBarItem.text = STATUS_ICON;
statusBarItem.command = 'zcatalyst.config';

function setStatusText(text?: string) {
	statusBarItem.text = text ? text : STATUS_ICON;
}

async function setMessageWithPromise<T>(message: string, promise: Promise<T>): Promise<T> {
	StatusStack.push(message);
	promise.finally(() => StatusStack.pop(message));
	return promise;
}

async function setMessageWithTimeout(message: string, timeout: number): Promise<void> {
	StatusStack.push(message);
	await timeOut(timeout);
	StatusStack.pop(message);
}

class StatusStack {
	private static stack: Array<string> = [STATUS_ICON];

	static get top() {
		return StatusStack.stack[StatusStack.stack.length - 1];
	}

	static push(msg: string) {
		setStatusText(msg);
		StatusStack.stack.push(msg);
	}

	static pop(msg?: string) {
		if (!msg) {
			return;
		}
		StatusStack.stack = StatusStack.stack.filter((stackMsg) => stackMsg !== msg);
		return setStatusText(StatusStack.top);
	}
}

export function setStatusBarMessage(message: string, timeout: number): Promise<void>;
export function setStatusBarMessage<T = void>(message: string, promise: Promise<T>): Promise<T>;
export function setStatusBarMessage<T = void>(
	message: string,
	hide: number | Promise<T>
): Promise<T | void> {
	if (typeof hide === 'number') {
		return setMessageWithTimeout(message, hide);
	}
	return setMessageWithPromise(message, hide);
}

export async function statusBarWithProgress<T>(
	statusBarMessage: string,
	title: string,
	fn: (
		progress: Progress<{ message?: string; increment?: number }>,
		cancellationToken: CancellationToken
	) => Promise<T>
): Promise<T> {
	return setStatusBarMessage(
		statusBarMessage,
		window.withProgress(
			{
				location: ProgressLocation.Notification,
				cancellable: true,
				title
			},
			fn
		) as Promise<T>
	);
}
