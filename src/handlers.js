import gql from "graphql-tag";
import * as builder from "gql-query-builder";

export const builderHandler = {
  get({ type, apollo, raw }, operation) {
    return (fields, variables, options = {}) => {
      if (Array.isArray(fields)) {
        fields = fields
          .map((field) => {
            if (typeof field === "function") {
              const t = new Proxy({}, fHandler);
              field(t);
              field = t.get();
            }
            return field;
          })
          .flat();
      } else {
        fields = [fields];
      }

      const query = builder[type]({
        operation,
        fields,
        variables: variables || {},
      });

      if (raw) return query;

      return new Promise((resolve, reject) => {
        apollo[type === "mutation" ? "mutate" : type]({
          [type]: gql`
            ${query.query}
          `,
          variables: query.variables,
          ...options,
        })
          .then(({ data }) => resolve(Object.values(data)[0]))
          .catch(reject);
      });
    };
  },
};

const fHandler = {
  get(target, operation) {
    if (operation === "get") {
      return () => Object.values(target);
    }

    return (fields, variables) => {
      if (Array.isArray(fields)) {
        fields = fields
          .map((field) => {
            if (typeof field === "function") {
              const t = new Proxy({}, fHandler);
              field(t);
              field = t.get();
            }
            return field;
          })
          .flat();
        target[operation] = {
          operation,
          fields,
          variables: variables || {},
        };
      } else {
        target[fields] = {
          operation,
          fields: [fields],
          variables: variables || {},
        };
      }
    };
  },
};
