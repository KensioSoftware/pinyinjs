import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import eslint from "@eslint/js";
import { smartassPreferSpecificAssertions } from "@kensio/smartass/eslint";
import vitest from "@vitest/eslint-plugin";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import { jsdoc } from "eslint-plugin-jsdoc";
import noSecrets from "eslint-plugin-no-secrets";
import security from "eslint-plugin-security";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));

const securityRecommended = security.configs.recommended as Parameters<
  typeof defineConfig
>[0];

export default defineConfig(
  // ── Global ignores ──────────────────────────────────────
  {
    ignores: [
      "dist/",
      "coverage/",
      "test/.coverage/",
      "node_modules/",
      "scripts/sh/",
      "data/",
      ".cache/",
      "**/*.config.ts",
    ],
  },

  // ── Base ESLint recommended ─────────────────────────────
  eslint.configs.recommended,

  // ── TypeScript (strictest level + type-aware) ───────────
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ── General settings for all TS files ───────────────────
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // ── TypeScript overrides & additions ──────────────
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "no-await-in-loop": "error", // catches sequential awaits that should be Promise.all()
      "no-template-curly-in-string": "error", // catches '${name}' in regular strings (missing backticks)
      "no-promise-executor-return": "error", // catches accidental return in new Promise((resolve) => return ...)
      "no-unreachable-loop": "error", // catches loops that only ever run once
      "no-param-reassign": "error", // prevents mutating function parameters (major bug source)
      "prefer-const": "error", // const over let when never reassigned
      "object-shorthand": ["error", "always"], // { foo: foo } → { foo }
      "prefer-template": "error", // template literals over string concatenation
      "@typescript-eslint/prefer-readonly": "error", // flags private fields that are never reassigned
      "@typescript-eslint/require-array-sort-compare": "error", // prevents [1, 10, 2].sort() (lexicographic surprise)
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: ["property", "objectLiteralProperty", "typeProperty"],
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["PascalCase"],
        },
        {
          // UPPER_CASE reads best for the constant lookup tables this package
          // is full of (syllable inventories, tone diacritics), whether or not
          // they happen to be exported.
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "UPPER_CASE"],
        },
      ],

      // ── General quality ──────────────────────────────
      "no-console": "warn",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "@typescript-eslint/only-throw-error": "error",
    },
  },

  // ── Security (low-cost security checks) ────────────────
  securityRecommended,
  {
    rules: {
      "security/detect-object-injection": "off",
    },
  },

  // ── Unicorn (modern JS best practices) ──────────────────
  // https://github.com/sindresorhus/eslint-plugin-unicorn?tab=readme-ov-file#recommended-config
  unicorn.configs.recommended,
  {
    rules: {
      // These rules ask for methods that do not exist in the ES2023 lib this
      // package targets: `Iterator#toArray`, `Set#difference` and
      // `Array.fromAsync` landed in ES2024/ES2025 and are not in the browser
      // baseline a first-class browser target has to hold to. Revisit when the
      // target moves.
      "unicorn/prefer-iterator-to-array": "off",
      "unicorn/prefer-set-methods": "off",
      "unicorn/prefer-array-from-async": "off",
    },
  },

  // ── Vitest (test files only) ────────────────────────────
  {
    files: ["**/*.test.ts"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/consistent-test-it": ["error", { fn: "it" }],
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/no-duplicate-hooks": "error",
      "vitest/prefer-to-be": "error",
      "vitest/prefer-to-have-length": "error",
      "vitest/prefer-strict-equal": "error",
      "vitest/require-top-level-describe": "error",

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      // Tests construct real-world fixture data (e.g. snake_case frontmatter keys).
      "@typescript-eslint/naming-convention": "off",
      "import-x/no-default-export": "off",
      "unicorn/no-null": "off",
      "unicorn/no-useless-undefined": "off",
      "vitest/expect-expect": "off", // using @kensio/smartass
    },
  },

  // ── CLI entry point (stdout is the interface) ───────────
  {
    files: ["src/cli/**/*.ts"],
    rules: {
      "no-console": "off",
      // A flag's key *is* its spelling on the command line, and --no-grouping
      // is not spelled noGrouping anywhere a user can see.
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "objectLiteralProperty",
          format: null,
          filter: { regex: String.raw`^[a-z]+(-[a-z]+)+$`, match: true },
        },
      ],
    },
  },

  // ── Build scripts (Node-only, and file paths are the job)
  {
    files: ["scripts/**/*.ts"],
    rules: {
      // Reading and writing computed paths is what a build pipeline does; the
      // paths come from this repo's own source table, never from user input.
      "security/detect-non-literal-fs-filename": "off",
      "no-console": "off",
    },
  },

  // ── Config files (allow default exports) ────────────────
  {
    files: ["*.config.ts", "*.config.js"],
    rules: {
      "import-x/no-default-export": "off",
    },
  },

  // ── No Secrets (detect accidental secret inclusion) ────────
  // Skips tests, whose fixtures quote real upstream data — Unihan code point
  // lines, packed dictionary rows — that reads as high entropy without being a
  // secret.
  {
    ignores: ["**/*.test.ts"],
    plugins: { "no-secrets": noSecrets },
    rules: {
      "no-secrets/no-secrets": "error",
    },
  },

  // ── JSDoc (enforce minimal doc commenting) ────────────────
  jsdoc({
    config: "flat/recommended-error",
  }),
  {
    rules: {
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
      "jsdoc/require-yields": "off",
      "jsdoc/require-description": [
        "error",
        {
          descriptionStyle: "body",
          checkConstructors: false,
          checkGetters: false,
          checkSetters: false,
        },
      ],
      "jsdoc/require-jsdoc": [
        "error",
        {
          contexts: [
            "ClassDeclaration",
            "ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[init.type='ObjectExpression']",
            "ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[init.type='ArrayExpression']",
            "ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[init.type='NewExpression']",
            "ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[init.type='CallExpression']",
          ],
          publicOnly: true,
          checkConstructors: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
    },
  },

  // ── Smartass (steer towards the most specific assertion) ──
  // e.g. assertIdentical(foo.length, 2) → assertArrayLength(foo, 2).
  ...smartassPreferSpecificAssertions,

  // ── Prettier (must be last — disables conflicting rules)
  prettier,
);
