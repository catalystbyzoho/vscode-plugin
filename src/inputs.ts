import {
	InputBox,
	QuickPick,
	QuickPickItem,
	EventEmitter,
	QuickInputButton,
	QuickInputButtons,
	ThemeIcon,
	window,
	QuickPickItemKind
} from 'vscode';
import { setStatusBarMessage } from './status-bar';
import { isEmpty } from './utils';
import { CatalystError, ERROR_CODES } from './error';

type TIdxUtil = { curIdx: number; prevIdx: number; nextIdx: number };
type TInputExtra<T = unknown> = {
	name: string;
	idx: TIdxUtil;
	defaultVal?: string | (QuickPickItem & { value: string | T });
	submit: boolean;
	optional: boolean;
	validate?: (val: T) => string | boolean | Promise<string | boolean>;
	postProcess?: (val: T) => T;
	hidden?: boolean;
};
export type TInput<T> =
	| (InputBox & TInputExtra<string>)
	| (QuickPick<QuickPickItem & { value: string | T }> & TInputExtra<string | T>);
export type TInputFn<T> = (idx: number, errorEvent: EventEmitter<Error | void>) => TInput<T>;
export type TOutput<T> = Record<string, string | T | Array<T>>;
export type TPrev<T = string> = string | T | Array<T> | TOutput<T>;
export type TConstructorFn<T, V> = (
	prev?: TPrev<V>
) => Promise<Inputs | TInputFn<T> | void> | TInputFn<T> | Inputs | void;
export type TQuickPickItem<T = string> = [
	label: string | [icon: ThemeIcon, text: string],
	value: T,
	description?: string,
	separator?: boolean
];
export type TOutputTransformer<OT = string, RT = string> = (output: TOutput<OT>) => TOutput<RT>;

/**
 * todo:
 * - display the previously entered value in the place holder on back
 */
export default class Inputs {
	private inputsArr: Array<TConstructorFn<unknown, unknown>> = [];
	private outputMap: Record<string, TInput<unknown>> = {};
	private loadEvent = new EventEmitter<boolean>();
	private completeEvent = new EventEmitter<void>();
	private errorEvent = new EventEmitter<Error | void>();
	private prevInput?: Inputs;
	private objIdx?: number;
	private outputTransformer?: TOutputTransformer<unknown, unknown>;

	push<T = string, V = string>(...constructorFn: Array<TConstructorFn<T, V>>) {
		return (this.inputsArr as Array<TConstructorFn<T, V>>).push(...constructorFn);
	}

	private async createInput<T>(idx: number, prev?: TPrev<T>): Promise<TInput<T> | void> {
		try {
			const _inputFn = this.inputsArr[idx];
			const inputFn = typeof _inputFn === 'function' ? await _inputFn(prev) : undefined;
			if (!inputFn) {
				if (prev && this.inputsArr[idx + 1]) {
					(await this.createInput<T>(idx + 1, prev))?.show();
					return;
				} else if (this.inputsArr[idx - 1] && !prev) {
					(await this.createInput<T>(idx - 1))?.show();
					return;
				}
				this.completeEvent.fire();
				return;
			}

			if (inputFn instanceof Inputs) {
				const res = await inputFn._getInputs<T>(this, idx);
				Object.assign(this.outputMap, res);
				if (this.inputsArr[idx + 1]) {
					(await this.createInput<T>(idx + 1, res))?.show();
					return;
				}
				this.completeEvent.fire();
				return;
			}
			const input = inputFn(idx, this.errorEvent);
			const buttons =
				idx !== 0 || this.prevInput
					? [Object.assign(QuickInputButtons.Back, { id: 'back' })]
					: [];
			if (input.submit) {
				buttons.push({
					id: 'submit',
					iconPath: new ThemeIcon('check'),
					tooltip: 'Submit'
				});
			}
			// next button ?
			// else if(input.optional && !input.defaultVal) {
			//     buttons.push({
			//         id: 'next',
			//         iconPath: new ThemeIcon('arrow-right'),
			//         tooltip: 'Next'
			//     });
			// }

			input.buttons = buttons;
			this.outputMap[input.name] = input;

			this.loadEvent.event((enable) => {
				input.busy = enable;
			});

			input.onDidAccept(async () => {
				try {
					if (!(await this.processInput(input))) {
						return;
					} else if (this.inputsArr[input.idx.nextIdx]) {
						input.hide();
						(
							await this.createInput<T>(
								input.idx.nextIdx,
								this._getValue<T>(input as TInput<T>)
							)
						)?.show();
					} else if (input.idx.nextIdx === this.inputsArr.length && !input.submit) {
						input.hide();
						this.completeEvent.fire();
					} else if (input.submit) {
						window.showInformationMessage(
							'Please click the submit button(✓) to continue'
						);
					}
				} catch (err) {
					err && this.errorEvent.fire(err as Error);
				}
			});
			input.onDidTriggerButton(async (button) => {
				try {
					const _button = button as QuickInputButton & { id: string };
					switch (_button.id) {
						case 'submit': {
							if (!(await this.processInput(input))) {
								return;
							}
							input.hide();
							return this.completeEvent.fire();
						}
						case 'back': {
							input.hide();
							if (input.idx.prevIdx >= 0) {
								(await this.createInput<T>(input.idx.prevIdx))?.show();
								return;
							}
							if (!this.prevInput || this.objIdx === undefined) {
								throw new Error('Unable to get back to the previous input');
							}
							if (this.prevInput && this.objIdx === 0) {
								(await this.prevInput?.prevInput?.createInput<T>(0))?.show();
							}
							(await this.prevInput?.createInput<T>(this.objIdx - 1))?.show();
						}
					}
				} catch (err) {
					err && this.errorEvent.fire(err as Error);
				}
			});
			input.onDidHide(() => {
				// const val = this._getValue(input);
				// if (((Array.isArray(val) && val.length === 0) || !val) && !input.hidden) {
				if (!input.hidden) {
					this.errorEvent.fire(
						new CatalystError('Input operation aborted by user', {
							code: ERROR_CODES.ABORTED_BY_USER
						})
					); // handling for keypress event
				}
				input.dispose();
			});

			return input as TInput<T>;
		} catch (err) {
			err && this.errorEvent.fire(err as Error);
		}
	}

	static createQuickPick =
		<T = unknown>(
			name: string,
			items: Array<TQuickPickItem<T> | string> | Promise<Array<TQuickPickItem<T> | string>>,
			{
				title,
				placeHolder,
				defaultAns,
				postProcess,
				validate,
				loadingMsg = {
					load: 'Fetching details...',
					fail: 'Unable to get the details at the moment.'
				},
				errorMsg,
				multiSelect = false,
				submit = false,
				optional = false
			}: {
				title: string;
				placeHolder: string;
				defaultAns?: number;
				postProcess?: (val: T | Array<T>) => T | Array<T>;
				validate?: (val: T | Array<T>) => boolean | Promise<boolean>;
				loadingMsg?: { load: string; fail: string };
				errorMsg?: string;
				multiSelect?: boolean;
				submit?: boolean;
				optional?: boolean;
			}
		) =>
		(idx: number, errorEvent: EventEmitter<Error | void>): TInput<T> => {
			const quickPickBox = window.createQuickPick() as QuickPick<
				QuickPickItem & { value: unknown }
			> &
				TInputExtra<T | Array<T>>;

			const reduceItemsArr = (arr: Array<string | TQuickPickItem<T>>) => {
				return arr.reduce((itemArr, item, idx) => {
					const [label, value, description, separator] =
						typeof item === 'string' ? [item, item] : item;
					const quickPickItem = {
						label: typeof label === 'string' ? label : `$(${label[0]?.id}) ${label[1]}`,
						value,
						alwaysShow: true,
						description: description,
						kind: separator ? QuickPickItemKind.Separator : QuickPickItemKind.Default
					};

					if (idx === defaultAns) {
						quickPickItem.description = description
							? description + ' (Default)'
							: '(Default)';
						itemArr.unshift(quickPickItem);
						quickPickBox.defaultVal = quickPickItem;
					} else {
						itemArr.push(quickPickItem);
					}
					return itemArr;
				}, [] as Array<QuickPickItem & { value: T | string }>);
			};

			if (Array.isArray(items)) {
				if (items.length === 0) {
					quickPickBox.items = [];
					quickPickBox.optional = true;
					window.showInformationMessage(loadingMsg.fail);
				} else {
					quickPickBox.items = reduceItemsArr(items);
				}
			} else {
				quickPickBox.busy = true;
				setStatusBarMessage(`$(loading~spin) ${loadingMsg.load}`, items)
					.then((itemsArr) => {
						if (itemsArr.length === 0) {
							quickPickBox.items = [];
							quickPickBox.optional = true;
							loadingMsg.fail && window.showInformationMessage(loadingMsg.fail);
							quickPickBox.busy = false;
							quickPickBox.hide();
							return;
						}
						quickPickBox.items = reduceItemsArr(itemsArr);
						quickPickBox.busy = false;
					})
					.catch((err) => {
						quickPickBox.hide();
						quickPickBox.busy = false;
						errorEvent.fire(
							new CatalystError(
								errorMsg || 'Error constructing the Quick Pick input',
								{
									code: ERROR_CODES.UNKNOWN_ERROR,
									originalError: err
								}
							)
						);
					});
			}

			quickPickBox.title = title + (optional ? ' (Optional)' : '');
			quickPickBox.placeholder = placeHolder;

			quickPickBox.ignoreFocusOut = true;
			quickPickBox.canSelectMany = multiSelect;

			quickPickBox.name = name;
			quickPickBox.postProcess = postProcess;
			quickPickBox.validate = validate;
			quickPickBox.submit = submit;
			quickPickBox.optional = optional;
			quickPickBox.idx = {
				get curIdx(): number {
					return idx;
				},
				get prevIdx(): number {
					return idx - 1;
				},
				get nextIdx(): number {
					return idx + 1;
				}
			};

			const _hide = quickPickBox.hide;
			// eslint-disable-next-line func-names
			quickPickBox.hide = () => {
				quickPickBox.hidden = true;
				return _hide.call(quickPickBox);
			};

			return quickPickBox as TInput<T>;
		};

	static confirmQuestion(
		name: string,
		title: string,
		placeHolder: string,
		{ optional, defaultAns = true }: { optional?: boolean; defaultAns?: boolean } = {}
	) {
		const confirmInput = new Inputs();
		confirmInput.push(() =>
			Inputs.createQuickPick<boolean>(
				name,
				[
					['Yes', true],
					['No', false]
				],
				{
					title,
					placeHolder,
					optional: optional,
					defaultAns: defaultAns ? 0 : 1
				}
			)
		);
		confirmInput.registerOutputTransformer((output) => {
			if (Array.isArray(output[name])) {
				output[name] = output[name][0];
			}
			return output;
		});
		return confirmInput;
	}

	static createInputBox =
		(
			name: string,
			title: string,
			placeHolder: string,
			{
				defaultVal = '',
				prompt = '',
				postProcess,
				validate,
				submit = false,
				optional = false
			}: {
				defaultVal?: string;
				prompt?: string;
				postProcess?: (val: string) => string;
				validate?: (val: string) => string | boolean | Promise<boolean | string>;
				submit?: boolean;
				optional?: boolean;
			} = {}
		) =>
		(idx: number): TInput<string> => {
			const inputBox = window.createInputBox() as InputBox & TInputExtra<string>;
			inputBox.prompt = prompt;
			inputBox.title = title + (optional ? ' (Optional)' : '');
			inputBox.placeholder = placeHolder + (defaultVal ? `( Default: ${defaultVal} )` : '');
			inputBox.ignoreFocusOut = true;
			inputBox.defaultVal = defaultVal;

			inputBox.name = name;
			inputBox.validate = validate;
			inputBox.postProcess = postProcess;
			inputBox.submit = submit;
			inputBox.optional = optional;
			inputBox.idx = {
				get curIdx(): number {
					return idx;
				},
				get prevIdx(): number {
					return idx - 1;
				},
				get nextIdx(): number {
					return idx + 1;
				}
			};

			const _hide = inputBox.hide;
			inputBox.hide = () => {
				inputBox.hidden = true;
				return _hide.call(inputBox);
			};

			return inputBox;
		};

	private async processInput(input: TInput<unknown>): Promise<boolean> {
		try {
			if ('selectedItems' in input) {
				//applying default
				if (
					input.defaultVal &&
					typeof input.defaultVal !== 'string' &&
					isEmpty(this._getValue(input) as Array<unknown>)
				) {
					input.activeItems = [input.defaultVal];
				}
				// post process
				if (input.postProcess) {
					input.selectedItems.forEach((item) => {
						if (typeof input.postProcess !== 'function') {
							return;
						}
						item.value = input.postProcess(item.value);
					});
				}
			} else {
				// applying defaults
				if (typeof input.defaultVal === 'string' && isEmpty(input.value)) {
					input.value = input.defaultVal;
				}
				// post process
				if (typeof input.postProcess === 'function') {
					input.value = input.postProcess(input.value);
				}
			}
			// validate
			const validInput = await this.validateInput(input);
			if (!validInput) {
				return false;
			}
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Error when processing the inputs: ', err);
			return false;
		}
		return true;
	}

	private async validateInput(input: TInput<unknown>): Promise<boolean> {
		if ('validationMessage' in input && input.validationMessage) {
			input.validationMessage = undefined;
		}
		if ('selectedItems' in input) {
			if (
				isEmpty(input.selectedItems as Array<QuickPickItem & { value: string }>) &&
				!input.optional
			) {
				window.showWarningMessage(
					`Please select a value from the ${input.title} to continue`
				);
				return false;
			}
			return !!(typeof input.validate === 'function'
				? await input.validate(this._getValue(input) as Array<string>)
				: true);
		} else if (!input.value && !input.optional) {
			input.validationMessage = `Please enter an input for the ${input.title} to continue`;
			return false;
		} else if (typeof input.validate === 'function') {
			const validationOut = await input.validate(input.value);
			if (typeof validationOut === 'string') {
				input.validationMessage = validationOut;
				return false;
			}
			return validationOut;
		}
		return true;
	}

	private _getValue<T = string>(input: string | TInput<T> | T): T | Array<T> {
		if (typeof input === 'string') {
			input = this.outputMap[input] as TInput<T>;
		}

		if (typeof input === 'object' && input != null) {
			if ('selectedItems' in input) {
				return input.selectedItems.map<T>((item) => item.value as T);
			}

			if ('value' in input) {
				return input.value as T;
			}
		}

		return input as T;
	}

	getValue<T = string>(name: string): T | Array<T> {
		return this._getValue<T>(name);
	}

	async getInputs<T>(): Promise<TOutput<T>> {
		return this._getInputs<T>();
	}

	private async _getInputs<T>(prevInput?: Inputs, idx?: number): Promise<TOutput<T>> {
		this.prevInput = prevInput;
		this.objIdx = idx;
		const outputPromise = new Promise<TOutput<T>>((res, rej) => {
			this.errorEvent.event((err) => {
				if (!err) {
					err = new CatalystError('Unknown error', { code: ERROR_CODES.UNKNOWN_ERROR });
				}
				rej(err);
			});

			this.completeEvent.event(() => {
				try {
					const result: TOutput<T> = {};
					Object.entries(this.outputMap).forEach(([key, input]) => {
						if (
							Array.isArray(input) ||
							typeof input === 'string' ||
							typeof input === 'boolean' ||
							typeof input === 'number'
						) {
							result[key] = input;
							return;
						}
						result[input.name] = this._getValue<T>(input as TInput<T>);
					});
					if (this.outputTransformer) {
						const transformedResult = this.outputTransformer(result) as TOutput<T>;
						res(transformedResult);
						return;
					}
					res(result);
				} catch (err) {
					this.errorEvent.fire(err instanceof Error ? err : undefined);
				}
			});
		});
		(await this.createInput(0))?.show();
		return outputPromise;
	}

	registerOutputTransformer<OT = string, RT = string>(fn: TOutputTransformer<OT, RT>) {
		this.outputTransformer = fn as TOutputTransformer<unknown, unknown>;
	}
}
