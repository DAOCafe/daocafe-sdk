import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", server: "src/server/index.ts" },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["react", "@tanstack/react-query", "viem"],
  minify: false,
  target: "es2022",
  platform: "neutral",
});
