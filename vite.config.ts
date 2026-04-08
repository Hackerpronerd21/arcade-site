import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        snake: resolve(__dirname, "games/snake/index.html"),
        flappy: resolve(__dirname, "games/flappy/index.html"),
        "dine-n-dash": resolve(__dirname, "games/dine-n-dash/index.html"),
        "emoji-neon-tris": resolve(__dirname, "games/emoji-neon-tris/index.html"),
        "breakout":        resolve(__dirname, "games/breakout/index.html"),
        "fractal-swarm":   resolve(__dirname, "games/fractal-swarm/index.html"),
        "pixel-smash":     resolve(__dirname, "games/pixel-smash/index.html"),
        "rts":             resolve(__dirname, "games/rts/index.html"),
        "ironblood-gothic": resolve(__dirname, "games/ironblood-gothic/index.html"),
      },
    },
  },
});
