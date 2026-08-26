interface IPluginConfig {
    start: string;
    validate: string;
    build: string;
}

type TFnType = 'advancedio' | 'basicio' | 'event' | 'cron' | 'job' | 'integration' | 'browser_logic';

export interface ICatalystJsonFunctions {
    targets: Array<string>;
    source: string;
    ignore?: Array<string>;
    plugin?: string | IPluginConfig;
}

export interface ICatalystJsonClient {
    source: string;
    plugin?: string | IPluginConfig
}

export interface ICatalystJsonApig {
    rules: string;
    enabled: boolean;
}

export interface ICatalystJsonAppSail {
    name: string;
    source: string;
}

export interface ICatalystJson {
    functions?: ICatalystJsonFunctions;
    client?: ICatalystJsonClient;
    apig?: ICatalystJsonApig;  
    appsail?: Array<ICatalystJsonAppSail>; 
}

export interface ICatalystFnConfigJson {
    deployment: {
        name: string;
        stack: string;
        type: TFnType;
        service?: 'ZohoCliq';
    },
    execution: {
        main: string;
    }
}

export interface ICatalystAppConfigJson {
    command: string;
	build_path: string;
	stack: string;
	env_variables?: Record<string, string>;
	memory?: number;
	scripts?: Record<string, string>;
	platform?: string;
}

export interface ICatalystClientConfigJson {
    name: string;
    version: string;
    homepage: string;
}

export interface IFnDetail {
    name: string;
    type: TFnType;
    source: string;
    stack: string;
    main: string;
    service?: 'ZohoCliq',
    test_inputs: string
}

export interface IAppSailDetail {
    name: string;
    source: string;
    command: string;
    build_path: string;
    stack: string;
    platform?: string;
}

export interface IClientDetail {
    name: string;
    source: string;
    homepage: string;
    version: string;
}