import * as DC from 'zcatalyst-cli/lib/util_modules/dc';
import _credential from 'zcatalyst-cli/lib/authentication/credential';
import * as ENV from 'zcatalyst-cli/lib/util_modules/env';
import { list } from 'zcatalyst-cli/lib/authentication/index';

export const dc = DC;
export const credential = _credential;
export const env = ENV;

export function getTokens(): Array<[tokenId: string, token: string, createdTime: string]> {
	try {
		return list() as Array<[string, string, string]>;
	} catch (err) {
		return [];
	}
}
