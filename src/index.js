export * from "./graph";
import Graph from "./graph";

const VuePlugin = {
  install(Vue, config) {
    Object.defineProperty(Vue.prototype, "$graph", {
      get() {
        return new Graph(this.$apollo, config);
      },
    });
  },
};

export { VuePlugin };
