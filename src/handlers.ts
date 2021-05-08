import gql from "graphql-tag";
import * as builder from "gql-query-builder";
import { Apollo, QueryVariable, QueryType } from "./types";
import Fields from "gql-query-builder/build/Fields";

export const builderHandler = {
  get(
    { type, apollo, raw }: { type: QueryType; apollo: Apollo; raw: boolean },
    operation: string
  ) {
    return (
      fields: string | string[],
      variables: QueryVariable,
      options = {}
    ) => {
      if (Array.isArray(fields)) {
        fields = fields
          .map((field) => {
            if (typeof field === "function") {
              const t = new Proxy({}, fHandler);
              // @ts-ignore
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
        fields: fields as Fields,
        variables: variables || {},
      });

      if (raw) return query;

      return new Promise((resolve, reject) => {
        let a: "query" | "mutate" | "subscribe";
        if (type === "mutation") a = "mutate";
        else if (type === "subscription") a = "subscribe";
        else a = type;

        apollo[a]({
          [type]: gql`
            ${query.query}
          `,
          variables: query.variables,
          ...options,
        })
          .then(({ data }: any) => resolve(Object.values(data)[0]))
          .catch(reject);
      });
    };
  },
};

const fHandler = {
  get(target: Record<string, any>, operation: string) {
    if (operation === "get") {
      return () => Object.values(target);
    }

    return (fields: string | string[], variables: QueryVariable) => {
      if (Array.isArray(fields)) {
        fields = fields
          .map((field) => {
            if (typeof field === "function") {
              const t = new Proxy({}, fHandler);
              // @ts-ignore
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
