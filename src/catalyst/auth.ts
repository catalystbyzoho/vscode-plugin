import * as DC from 'zcatalyst-cli/lib/util_modules/dc';
import _credential from 'zcatalyst-cli/lib/authentication/credential';
import * as ENV from 'zcatalyst-cli/lib/util_modules/env';
import { list } from 'zcatalyst-cli/lib/authentication/index';

export const dc = DC;
export const credential = _credential;
export const env = ENV;

export type TTokenDetail = [tokenId: string, token: string, createdTime: string];

export function getTokens(): Array<TTokenDetail> {
	try {
		return list() as Array<TTokenDetail>;
	} catch (err) {
		return [];
	}
}

/**
 * Mask a token for display, revealing only the last 4 characters,
 * e.g. "abcd1234efgh" -> "********efgh".
 */
export function maskToken(tk: string): string {
	if (typeof tk !== 'string') {
		return tk;
	}
	const visible = 4;
	if (tk.length <= visible) {
		return '*'.repeat(tk.length);
	}
	return '*'.repeat(tk.length - visible) + tk.slice(-visible);
}

/**
 * Returns the token list with every raw token value replaced by its masked
 * form. This is the only variant that should ever cross the extension-host
 * to webview boundary in bulk (e.g. the initial view payload); raw values
 * are retrieved individually and only for a narrowly scoped, user-approved
 * action (see `getTokenById`).
 */
export function getMaskedTokens(): Array<TTokenDetail> {
	return getTokens().map(([tkId, tk, createdTime]) => [tkId, maskToken(tk), createdTime]);
}

/**
 * Looks up a single token's raw value by its ID. Used to serve narrowly
 * scoped, user-initiated operations (reveal, copy) without ever trusting or
 * requiring a raw token value supplied by the webview.
 */
export function getTokenById(tokenId: string): TTokenDetail | undefined {
	return getTokens().find(([tkId]) => tkId === tokenId);
}

