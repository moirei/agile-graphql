export * from "./graph";
export * from "./mappers";
import Graph from "./graph";
import { GraphConfig } from "./types";

const VuePlugin = {
  install(Vue: any, config: GraphConfig) {
    Object.defineProperty(Vue.prototype, "$graph", {
      get() {
        return new Graph(this.$apollo, config);
      },
    });
  },
};

export { VuePlugin };
