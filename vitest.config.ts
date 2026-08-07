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
    // Worker threads rather than child processes, and one module graph per
    // worker rather than one per file. Nothing here needs a process of its
    // own, and the 2.4 MB dictionary is the bulk of the run: loading it once
    // per worker instead of once per test file takes the suite's import cost
    // from about 9 s of worker time to about 5 s.
    //
    // The trade is that test files sharing a worker also share module state,
    // so a module-level cache one file warms is warm for the next. Everything
    // here either builds its own fixtures or reads the dictionary read-only;
    // `restoreMocks` below undoes the rest.
    pool: "threads",
    isolate: false,
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
