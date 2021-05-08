import Fields from "gql-query-builder/build/Fields";
import gql from "graphql-tag";
import * as builder from "gql-query-builder";
import { get, upperFirst, isEmpty } from "lodash";
import { singular, plural } from "pluralize";
import { builderHandler } from "./handlers";
import {
  GraphConfig,
  GraphConfigDefaults,
  GraphConfigCrud,
  QueryInput,
  QueryOptions,
  CrudMethodBuilderOption,
  Apollo,
  QueryType,
} from "./types";

const defaultConfig = {
  proxy: true,
  defaults: {
    keyField: "id",
    fetchPolicy: "cache-first", // https://www.apollographql.com/docs/react/data/queries/#supported-fetch-policies
  },
};

export default class Graph {
  private apollo: Apollo;
  private crud: GraphConfigCrud | undefined;
  private defaults: GraphConfigDefaults;
  private $raw: boolean;

  constructor(apollo: Apollo, config: GraphConfig = {}) {
    config.defaults = { ...defaultConfig.defaults, ...(config.defaults || {}) };
    const { proxy, defaults, crud, overrides } = {
      ...defaultConfig,
      ...config,
    };
    this.apollo = apollo;
    this.defaults = defaults;
    this.crud = crud;
    this.$raw = false;

    if (overrides) {
      this.override(overrides);
    }

    if (crud) {
      this.init(crud);
    }

    if (proxy) {
      return this.$proxy();
    }
  }

  /**
   * Initialise the graph instance with crud operations
   * Bypasses Proxy for speed
   *
   * @param {GraphConfigCrud} crud configuration
   */
  init(crud: GraphConfigCrud) {
    const instance = this;
    for (const model in crud) {
      Object.defineProperty(instance, model, {
        get() {
          return instance.$methods(model);
        },
      });
    }
  }

  /**
   * Specify crud methods overrides
   *
   * @param {Record<string, Function>} overrides
   */
  override(overrides: Record<string, Function>) {
    for (const method in overrides) {
      Object.defineProperty(this, method, {
        get() {
          return overrides[method];
        },
      });
    }
  }

  /**
   * Get all crud methods for a model. E.g. `users`
   *
   * @param {string} model the name of the model
   * @returns
   */
  private $methods(model: string) {
    const m: Record<string, Function> = {};

    const queries = this.$queries;
    const mutations = this.$mutations;

    const keyField = get(
      this,
      `crud.${model}.keyField`,
      this.defaults.keyField
    );
    const fetchPolicy = get(this, `crud.${model}.fetchPolicy`);

    const only_methods = get(this, `crud.${model}.methods.only`, []);
    const except_methods = get(this, `crud.${model}.methods.except`, []);

    const allowed_query_methods = Object.keys(queries).filter((method) => {
      return (
        (!only_methods.length || only_methods.includes(method)) &&
        (!except_methods.length || !except_methods.includes(method))
      );
    });
    const allowed_mutation_methods = Object.keys(mutations).filter((method) => {
      return (
        (!only_methods.length || only_methods.includes(method)) &&
        (!except_methods.length || !except_methods.includes(method))
      );
    });

    for (const method of allowed_query_methods) {
      const fp =
        typeof fetchPolicy === "string"
          ? fetchPolicy
          : get(fetchPolicy, method, this.defaults.fetchPolicy);

      const override = `${plural(model)}${upperFirst(method)}`;
      // @ts-ignore
      m[method] = this[override]
        ? // @ts-ignore
          this[override]
        : // @ts-ignore
          queries[method](model, { keyField, fetchPolicy: fp });
    }
    for (const method of allowed_mutation_methods) {
      const fp =
        typeof fetchPolicy === "string"
          ? fetchPolicy
          : get(fetchPolicy, method, this.defaults.fetchPolicy);

      const override = `${singular(model)}${upperFirst(method)}`;
      // @ts-ignore
      m[method] = this[override]
        ? // @ts-ignore
          this[override]
        : // @ts-ignore
          mutations[method](model, { keyField, fetchPolicy: fp });
    }

    return m;
  }

  /**
   * Initialise proxy
   *
   * @returns {Proxy}
   */
  private $proxy() {
    const instance: Graph = this;
    const handler = {
      get(_: any, o: string) {
        // @ts-ignore
        if (instance[o]) {
          // @ts-ignore
          return instance[o];
        }

        return instance.$methods(o);
      },
    };

    return new Proxy(this, handler);
  }

  get raw() {
    this.$raw = true;
    return this;
  }

  get query() {
    return new Proxy(
      { type: "query", apollo: this.apollo, raw: this.$raw },
      builderHandler
    );
  }

  get mutation() {
    return new Proxy(
      { type: "mutation", apollo: this.apollo, raw: this.$raw },
      builderHandler
    );
  }

  get subscription() {
    return new Proxy(
      { type: "subscription", apollo: this.apollo, raw: this.$raw },
      builderHandler
    );
  }

  private async $query({
    type = "query",
    name,
    operation,
    query: fields = [],
    variables = {},
    fetchPolicy,
  }: QueryInput) {
    if (!Array.isArray(fields)) fields = [fields];

    const query = builder[type](
      {
        operation,
        fields: fields as Fields,
        variables: variables || {},
      },
      null,
      name ? { operationName: name } : undefined
    );

    let a: "query" | "mutate" | "subscribe";
    if (type === "mutation") a = "mutate";
    else if (type === "subscription") a = "subscribe";
    else a = type;

    const { data } = await this.apollo[a]({
      [type]: gql`
        ${query.query}
      `,
      variables: query.variables,
      fetchPolicy,
    });

    return Object.values(data)[0];
  }

  get $queries() {
    return {
      count: (
        model: string,
        { keyField, fetchPolicy }: CrudMethodBuilderOption
      ) => async () => {
        const results = await this.$query({
          operation: plural(model),
          query: keyField,
          fetchPolicy,
        });

        // @ts-ignore
        return results.length;
      },
      findUnique: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        where: any,
        query: string | string[],
        { name, fetchPolicy: fp }: QueryOptions = {}
      ) => {
        const operation = singular(model);
        return this.$query({
          name,
          operation,
          query: this.resolveQuery(model, "findUnique", query),
          fetchPolicy: fp || fetchPolicy,
          variables: {
            where: {
              type: `${upperFirst(operation)}WhereUniqueInput`,
              required: true,
              value: where,
            },
          },
        });
      },
      findMany: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        query: string | string[],
        { name, fetchPolicy: fp }: QueryOptions = {}
      ) => {
        return this.$query({
          name,
          operation: plural(model),
          query: this.resolveQuery(model, "findMany", query),
          fetchPolicy: fp || fetchPolicy,
        });
      },
      findFirst: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        where: any,
        query: string | string[],
        { name, fetchPolicy: fp }: QueryOptions = {}
      ) => {
        return this.$query({
          name,
          operation: `${plural(model)}findFirst`,
          query: this.resolveQuery(model, "findFirst", query),
          fetchPolicy: fp || fetchPolicy,
          variables: {
            where: {
              type: `${upperFirst(singular(model))}WhereInput`,
              required: true,
              value: where,
            },
          },
        });
      },
    };
  }

  get $mutations() {
    return {
      create: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        data: any,
        query: string | string[],
        { name, fetchPolicy: fp }: QueryOptions = {}
      ) => {
        const x = upperFirst(model);
        return this.$query({
          type: "mutation",
          name,
          operation: `createOne${singular(x)}`,
          query: this.resolveQuery(model, "create", query),
          fetchPolicy: fp || fetchPolicy,
          variables: {
            data: {
              type: `${x}CreateInput`,
              required: true,
              value: data,
            },
          },
        });
      },
      update: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        where: any,
        data: any,
        query: string | string[],
        { name, fetchPolicy: fp }: QueryOptions = {}
      ) => {
        const x = upperFirst(model);
        return this.$query({
          type: "mutation",
          name,
          operation: `updateOne${singular(x)}`,
          query: this.resolveQuery(model, "update", query),
          fetchPolicy: fp || fetchPolicy,
          variables: {
            where: {
              type: `${x}WhereUniqueInput`,
              required: true,
              value: where,
            },
            data: {
              type: `${x}UpdateInput`,
              required: true,
              value: data,
            },
          },
        });
      },
      upsert: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        where: any,
        { create, update }: { create: any; update: any },
        query: string | string[],
        { name, fetchPolicy: fp }: QueryOptions = {}
      ) => {
        const x = upperFirst(model);
        return this.$query({
          type: "mutation",
          name,
          operation: `upsertOne${singular(x)}`,
          query: this.resolveQuery(model, "upsert", query),
          fetchPolicy: fp || fetchPolicy,
          variables: {
            where: {
              type: `${x}WhereUniqueInput`,
              required: true,
              value: where,
            },
            create: {
              type: `${x}CreateInput`,
              value: create,
            },
            update: {
              type: `${x}UpdateInput`,
              value: update,
            },
          },
        });
      },
      updateMany: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        where: any,
        data: any,
        query: string | string[],
        { name, fetchPolicy: fp }: QueryOptions = {}
      ) => {
        const x = upperFirst(model);
        return this.$query({
          type: "mutation",
          name,
          operation: `updateMany${singular(x)}`,
          query: this.resolveQuery(model, "updateMany", query),
          fetchPolicy: fp || fetchPolicy,
          variables: {
            where: {
              type: `${x}WhereInput`,
              required: true,
              value: where,
            },
            data: {
              type: `${x}UpdateInput`,
              required: true,
              value: data,
            },
          },
        });
      },
      delete: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        where: any,
        query: string | string[]
      ) => {
        const x = upperFirst(model);
        return this.$query({
          type: "mutation",
          operation: `deleteOne${singular(x)}`,
          query: this.resolveQuery(model, "delete", query),
          fetchPolicy,
          variables: {
            where: {
              type: `${x}WhereUniqueInput`,
              required: true,
              value: where,
            },
          },
        });
      },
      deleteMany: (model: string, { fetchPolicy }: CrudMethodBuilderOption) => (
        where: any,
        query: string | string[]
      ) => {
        const x = upperFirst(model);
        return this.$query({
          type: "mutation",
          operation: `deleteMany${singular(x)}`,
          query: this.resolveQuery(model, "deleteMany", query),
          fetchPolicy,
          variables: {
            where: {
              type: `${x}WhereInput`,
              required: true,
              value: where,
            },
          },
        });
      },
    };
  }

  resolveQuery(
    model: string,
    method: string,
    query?: string | string[]
  ): undefined | string | string[] {
    if (!isEmpty(query)) return query;

    query = get(this.defaults, `query.${method}`);

    if (isEmpty(query)) {
      // @ts-ignore
      query = get(this.crud, `${model}.query`);
    }
    if (isEmpty(query)) {
      // @ts-ignore
      query = get(this.crud, `${model}.keyField`, this.defaults.keyField);
    }

    return query;
  }
}
