import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        snake: resolve(__dirname, "games/snake/index.html"),
      },
    },
  },
});
