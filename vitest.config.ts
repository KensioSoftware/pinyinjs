import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#test": fileURLToPath(new URL("./test", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    typecheck: {
      tsconfig: "./tsconfig.json",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // The bin shim is three lines of wiring: it reads argv, calls runCli
      // against the Node environment, and writes what comes back. Everything
      // it wires is covered, and importing it would run the CLI.
      exclude: [...configDefaults.exclude, "src/cli/main.ts"],
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./test/.coverage",
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
    restoreMocks: true,
    // Long enough that a heavy import is not mistaken for a hanging test, and
    // short enough to still catch one. At 100 ms it flaked on roughly one test
    // per run at random: vitest charges a file's import cost to the first test
    // in it, and loading the 2.4 MB dictionary costs more than that on its own.
    testTimeout: 1000,
  },
});
