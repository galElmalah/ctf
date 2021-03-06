import { Dictionary } from '../configHelpers/config';
import {
	ParameterOptions,
	ScaffolderTransformer,
	ScaffolderFunction,
	Hooks,
} from '../configHelpers/config';
import { ConfigSchema, errorMap } from './Schema';
import * as z from 'zod';
import { warning } from '../cliHelpers/colors';

export interface ConfigGetters {
	parameterOptions(parameter: string): ParameterOptions;
	transformer(transformer: string): ScaffolderTransformer;
	function(aFunction: string): ScaffolderFunction;
	templateDescription(): string,
	hooks(): Hooks;
}

export interface IConfig {
	forTemplate(templateName: string): IConfig;
	get: ConfigGetters;
	validateConfig: () => void;
}

type ScopedProps = 'parametersOptions' | 'transformers' | 'functions' | 'hooks' | 'description';

export class Config implements IConfig {
	private configJson: Dictionary<any>;
	private templateName: string;
	private parsedSchemaResult: { success: boolean; error?: z.ZodError };

	constructor(configJson: Dictionary<any>) {
		this.configJson = configJson;
		this.parsedSchemaResult = ConfigSchema.safeParse(this.configJson, {
			errorMap,
		});
	}

	forTemplate(templateName: string) {
		this.templateName = templateName;
		return this;
	}

	validateConfig() {
		if (!this.parsedSchemaResult.success) {
			const takeActionWarningMessage = warning('\nScaffolder detected some errors in your config file.\nLeft unattended these errors can lead to unexpected behavior.');
			const errorMessage = this.parsedSchemaResult.error?.errors.reduce(
				(acc, error, i) => `${acc}\n(${i + 1}) ${error.message}`,
				takeActionWarningMessage
			);
			throw new Error(`${errorMessage}\n`);
		}
	}

	getSchemaErrors() {
		return (
			this.parsedSchemaResult.error?.errors.map((error) => error.message) || []
		);
	}

	private getFromTemplateScope(prop: ScopedProps, field?: string) {
		if (!this.hasTemplateOptions()) {
			return;
		}
		const propInTemplateScope = this.configJson.templatesOptions[
			this.templateName
		][prop];
		if (propInTemplateScope && field) {
			return this.configJson.templatesOptions[this.templateName][prop][field];
		}
		return propInTemplateScope;
	}

	private hasTemplateOptions() {
		return this.configJson.templatesOptions[this.templateName];
	}

	private getFromFirstLevel(prop: ScopedProps, field: string) {
		if (!this.configJson[prop]) {
			return;
		}
		return this.configJson[prop][field];
	}

	private getFromConfig(prop: ScopedProps, field: string, defaultValue?: any) {
		return (
			this.getFromTemplateScope(prop, field) ||
			this.getFromFirstLevel(prop, field) ||
			defaultValue
		);
	}

	get: ConfigGetters = {
		parameterOptions: (parameter: string) => {
			const defaultOptions = {
				question: `Enter a value for the following parameter "${parameter}"`,
			};
			return this.getFromConfig('parametersOptions', parameter, defaultOptions);
		},
		transformer: (aTransformer: string) => {
			return this.getFromConfig('transformers', aTransformer);
		},
		function: (aFunction: string) => {
			return this.getFromConfig('functions', aFunction);
		},
		hooks: () => {
			return this.getFromTemplateScope('hooks') || {};
		},
		templateDescription: () => {
			return this.getFromTemplateScope('description') || '';
		}
	};
}
