/* eslint-disable @typescript-eslint/naming-convention */
import scope from 'zcatalyst-cli/lib/authentication/constants/scopes';
import dc from 'zcatalyst-cli/lib/util_modules/constants/lib/dc-type';

export const FILENAMES = Object.freeze({
	CATALYST_JSON: 'catalyst.json',
	CATALYST_CONFIG_JSON: 'catalyst-config.json',
	APP_CONFIG_JSON: 'app-config.json',
	CLIENT_PACKAGE_JSON: 'client-package.json',
	CATALYST_RC: '.catalystrc'
});

export enum EFnGroup {
	http = 1,
	nonHttp = 2
}

export const FN_TYPES = {
	http: ['advancedio', 'basicio', 'browser_logic'],
	nonHttp: ['event', 'cron', 'integration', 'job']
};

export const FN_STACK = {
	java: {
		java8: 'java8'
	},
	node: {
		node12: 'node12',
		node14: 'node14'
	}
};

export const SCOPE = scope;
export const DC = dc;
