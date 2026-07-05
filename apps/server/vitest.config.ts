import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    // `tsc -b` (check-types) emite los .test.js compilados a dist/; solo corremos
    // las fuentes en src para no duplicar la suite.
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // PGlite es un Postgres en proceso, pero cada archivo comparte una única
    // instancia; correr en serie evita cruces de estado entre suites.
    fileParallelism: false,
  },
});
