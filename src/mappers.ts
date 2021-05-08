// @ts-ignore
import Vue from "vue";
import { get } from "lodash";
import { Mappers } from "./types";

export function mapQueries(input: Mappers.QueryMapperInput) {
  const mapped: Record<string, any> = {};
  let queries: Record<string, any> = {};

  if (typeof input === "string") {
    const { field, data } = fromString(input);
    queries[field] = data;
  } else if (typeof input === "object") {
    for (const field in input) {
      // @ts-ignore
      const i = input[field];
      if (typeof i === "string") {
        const { data } = fromString(i);
        queries[field] = data;
      } else {
        const { data } = fromString(i.query);
        queries[field] = { ...i, ...data };
      }
    }
  } else if (Array.isArray(input)) {
    // @ts-ignore
    input.forEach((input) => {
      // must be string
      const { field, data } = fromString(input);
      queries[field] = data;
    });
  }

  const o: {
    [field: string]: any;
    loading: Record<string, boolean>;
  } = { loading: {} };
  for (const field in queries) {
    const data = queries[field];
    o[field] = data.default || null;
    o.loading[field] = false;
  }
  const state = Vue.observable(o);

  for (const field in queries) {
    mapped[field] = function () {
      const data = queries[field];
      const callable = get(this.$graph, data.query);
      const context = get(this.$graph, data.namespace);

      state.loading[field] = true;
      const args = getArgs(this, data);
      call(callable, context, args)
        .then((data) => (state[field] = data))
        .finally(() => (state.loading[field] = false));

      return state[field];
    };
  }

  mapped["loadingQuery"] = () => state.loading;

  return mapped;
}

function fromString(str: string) {
  const pos = str.indexOf(".");
  const field = pos >= 0 ? str.substring(pos + 1) : str;
  const namespace = pos >= 0 ? str.substr(0, pos) : str;

  return {
    field,
    data: {
      query: str,
      namespace,
    },
  };
}

const getArgs = (context: Record<string, unknown>, data: any) => {
  let args: any[] = [];
  const x: string | string[] = get(data, "params");
  if (x) {
    if (typeof x === "string") {
      args.push(context[x]);
    } else {
      args = args.concat(x.map((x) => context[x]));
    }
  }
  return args;
};

const call = async (
  f: Function,
  context: Record<string, unknown>,
  args: any[]
) => {
  if (!f) return null;
  const callable = await Promise.resolve(f);
  return callable.apply(context, args);
};
