import gql from "graphql-tag";
import { get, upperFirst, isEmpty } from "lodash";
import { singular, plural } from "pluralize";

const defaultConfig = {
  proxy: true,
  defaults: {
    keyField: "id",
    fetchPolicy: "cache-first", // https://www.apollographql.com/docs/react/data/queries/#supported-fetch-policies
  },
};

export default class Graph {
  constructor(apollo, config = {}) {
    config.defaults = { ...defaultConfig.defaults, ...(config.defaults || {}) };
    const { proxy, defaults, crud, overrides } = {
      ...defaultConfig,
      ...config,
    };
    this.apollo = apollo;
    this.defaults = defaults;
    this.crud = crud;

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

  init(crud) {
    const instance = this;
    for (const model in crud) {
      Object.defineProperty(instance, model, {
        get() {
          return instance.$methods(model);
        },
      });
    }
  }

  override(overrides) {
    for (const method in overrides) {
      Object.defineProperty(this, method, {
        get() {
          return overrides[method];
        },
      });
    }
  }

  $methods(model) {
    const m = {};

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
      m[method] = this[override]
        ? this[override]
        : queries[method](model, { keyField, fetchPolicy: fp });
    }
    for (const method of allowed_mutation_methods) {
      const fp =
        typeof fetchPolicy === "string"
          ? fetchPolicy
          : get(fetchPolicy, method, this.defaults.fetchPolicy);

      const override = `${singular(model)}${upperFirst(method)}`;
      m[method] = this[override]
        ? this[override]
        : mutations[method](model, { keyField, fetchPolicy: fp });
    }

    return m;
  }

  $proxy() {
    const instance = this;
    const handler = {
      get(_, model) {
        return instance.$methods(model);
      },
    };

    return new Proxy(this, handler);
  }

  async query({
    type = "query",
    name,
    action,
    query = "",
    variables: vars = [],
    fetchPolicy,
  }) {
    let p1 = "";
    let p2 = "";
    const variables = {};

    vars.forEach((variable) => {
      p1 += `$${variable.name}: ${variable.type}${
        variable.required ? "!" : ""
      },`;
      p2 += `${variable.name}: $${variable.name},`;

      variables[variable.name] = variable.value;
    });

    const is_array = Array.isArray(query);
    const has_query =
      (typeof query === "string" && query) || (is_array && query.length);

    if (is_array) {
      query = query.join(",");
    }

    p1 = p1.replace(/(^,)|(,$)/g, "");
    p2 = p2.replace(/(^,)|(,$)/g, "");

    const { data } = await this.apollo[type === "mutation" ? "mutate" : type]({
      [type]: gql`
        ${type} ${name ? name : ""} ${p1 ? "(" + p1 + ")" : ""} {
          ${action}${p2 ? "(" + p2 + ")" : ""}
          ${has_query ? "{" + query + "}" : ""}
        }
      `,
      variables,
      fetchPolicy,
    });

    return Object.values(data)[0];
  }

  get $queries() {
    return {
      count: (model, { keyField, fetchPolicy }) => async () => {
        const results = await this.query({
          action: plural(model),
          query: keyField,
          fetchPolicy,
        });
        return results.length;
      },
      findUnique: (model, { fetchPolicy }) => (
        where,
        query,
        { name, fetchPolicy: fp } = {}
      ) => {
        const action = singular(model);
        return this.query({
          name,
          action,
          query: this.resolveQuery(model, "findUnique", query),
          fetchPolicy: fp || fetchPolicy,
          variables: [
            {
              name: "where",
              type: `${upperFirst(action)}WhereUniqueInput`,
              required: true,
              value: where,
            },
          ],
        });
      },
      findMany: (model, { fetchPolicy }) => (
        query,
        { name, fetchPolicy: fp } = {}
      ) => {
        return this.query({
          name,
          action: plural(model),
          query: this.resolveQuery(model, "findMany", query),
          fetchPolicy: fp || fetchPolicy,
        });
      },
      findOne: (model, { fetchPolicy }) => (
        where,
        query,
        { name, fetchPolicy: fp } = {}
      ) => {
        return this.query({
          name,
          action: `${plural(model)}FindOne`,
          query: this.resolveQuery(model, "findOne", query),
          fetchPolicy: fp || fetchPolicy,
          variables: [
            {
              name: "where",
              type: `${upperFirst(singular(model))}WhereInput`,
              required: true,
              value: where,
            },
          ],
        });
      },
    };
  }

  get $mutations() {
    return {
      create: (model, { fetchPolicy }) => (
        data,
        query,
        { name, fetchPolicy: fp } = {}
      ) => {
        const x = upperFirst(model);
        return this.query({
          type: "mutation",
          name,
          action: `createOne${singular(x)}`,
          query: this.resolveQuery(model, "create", query),
          fetchPolicy: fp || fetchPolicy,
          variables: [
            {
              name: "data",
              type: `${x}CreateInput`,
              required: true,
              value: data,
            },
          ],
        });
      },
      update: (model, { fetchPolicy }) => (
        where,
        data,
        query,
        { name, fetchPolicy: fp } = {}
      ) => {
        const x = upperFirst(model);
        return this.query({
          type: "mutation",
          name,
          action: `updateOne${singular(x)}`,
          query: this.resolveQuery(model, "update", query),
          fetchPolicy: fp || fetchPolicy,
          variables: [
            {
              name: "where",
              type: `${x}WhereUniqueInput`,
              required: true,
              value: where,
            },
            {
              name: "data",
              type: `${x}UpdateInput`,
              required: true,
              value: data,
            },
          ],
        });
      },
      upsert: (model, { fetchPolicy }) => (
        where,
        { create, update },
        query,
        { name, fetchPolicy: fp } = {}
      ) => {
        const x = upperFirst(model);
        return this.query({
          type: "mutation",
          name,
          action: `upsertOne${singular(x)}`,
          query: this.resolveQuery(model, "upsert", query),
          fetchPolicy: fp || fetchPolicy,
          variables: [
            {
              name: "where",
              type: `${x}WhereUniqueInput`,
              required: true,
              value: where,
            },
            {
              name: "create",
              type: `${x}CreateInput`,
              value: create,
            },
            {
              name: "update",
              type: `${x}UpdateInput`,
              value: update,
            },
          ],
        });
      },
      updateMany: (model, { fetchPolicy }) => (
        where,
        data,
        query,
        { name, fetchPolicy: fp } = {}
      ) => {
        const x = upperFirst(model);
        return this.query({
          type: "mutation",
          name,
          action: `updateMany${singular(x)}`,
          query: this.resolveQuery(model, "updateMany", query),
          fetchPolicy: fp || fetchPolicy,
          variables: [
            {
              name: "where",
              type: `${x}WhereInput`,
              required: true,
              value: where,
            },
            {
              name: "data",
              type: `${x}UpdateInput`,
              required: true,
              value: data,
            },
          ],
        });
      },
      delete: (model, { fetchPolicy }) => (where, query) => {
        const x = upperFirst(model);
        return this.query({
          type: "mutation",
          action: `deleteOne${singular(x)}`,
          query: this.resolveQuery(model, "delete", query),
          fetchPolicy,
          variables: [
            {
              name: "where",
              type: `${x}WhereUniqueInput`,
              required: true,
              value: where,
            },
          ],
        });
      },
      deleteMany: (model, { fetchPolicy }) => (where, query) => {
        const x = upperFirst(model);
        return this.query({
          type: "mutation",
          action: `deleteMany${singular(x)}`,
          query: this.resolveQuery(model, "deleteMany", query),
          fetchPolicy,
          variables: [
            {
              name: "where",
              type: `${x}WhereInput`,
              required: true,
              value: where,
            },
          ],
        });
      },
    };
  }

  resolveQuery(model, method, query = null) {
    if (!isEmpty(query)) return query;

    query = get(this.defaults, `query.${method}`);

    if (isEmpty(query)) {
      query = get(this.crud, `${model}.query`);
    }
    if (isEmpty(query)) {
      query = get(this.crud, `${model}.keyField`, this.defaults.keyField);
    }

    return query;
  }
}
