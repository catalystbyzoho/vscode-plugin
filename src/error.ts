export enum ERROR_CODES {
	ABORTED_BY_USER = 'aborted by user',
	UNKNOWN_ERROR = 'unknown error'
}

export interface CatalystErrorOptions {
	code?: ERROR_CODES;
	originalError?: Error;
}

export class CatalystError extends Error {
	code?: ERROR_CODES;
	originalError?: Error;

	constructor(message: string, options?: CatalystErrorOptions) {
		super(message);
		this.code = options?.code;
		this.originalError = options?.originalError;
	}
}
