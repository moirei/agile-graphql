export type GraphConfigDefaults = {
  keyField?: string;
  fetchPolicy?: string;
};

export type QueryType = "query" | "mutation" | "subscription";
export type Apollo = Record<"query" | "mutate" | "subscribe", Function>;

export type GraphConfigCrud = {
  [model: string]: {
    query: string | string[];
    fetchPolicy?: string | Record<string, string>;
    methods?: {
      except?: string[];
      only?: string[];
    };
  };
};

export type QueryInput = {
  type?: QueryType;
  name?: string;
  operation: string;
  query?: string | Array<string>;
  variables?: Record<string, QueryVariable>;
  fetchPolicy?: string;
};

export type QueryVariable = {
  required?: boolean;
  type: string;
  value: any;
};

export type GraphConfig = {
  proxy?: boolean;
  overrides?: any;
  defaults?: GraphConfigDefaults;
  crud?: GraphConfigCrud;
};

export type QueryOptions = {
  name?: string;
  fetchPolicy?: string;
};

export type CrudMethodBuilderOption = {
  keyField?: string;
  fetchPolicy?: string;
};

export namespace Mappers {
  type QueryMap = {
    [field: string]: string;
  };
  export type QueryMapperInput = string | QueryMap | QueryMap[];
}
