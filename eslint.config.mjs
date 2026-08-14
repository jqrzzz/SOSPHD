/* ─── ESLint v9 flat config ────────────────────────────────────────────
 *  Replaces the deprecated `next lint` setup. Runs in CI alongside
 *  typecheck + build + test.
 *
 *  Scope choices:
 *  - Lint app/, components/, lib/ (the code we own)
 *  - Skip .next/, node_modules/, coverage/, build artifacts
 *  - Skip the generated/snapshot SQL files
 *
 *  Rule philosophy: catch real bugs (unused vars, React hooks deps,
 *  Next.js anti-patterns) without bikeshedding style. Style is what
 *  Prettier (if added later) would handle.
 * ────────────────────────────────────────────────────────────────────── */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  // Global ignores
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "supabase/migrations/**",
      "next-env.d.ts",
    ],
  },

  // Baseline: JS + TS recommended
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node scripts (plain .mjs under mcp/) — declare Node globals so no-undef
  // stays accurate. TS files don't need this (typescript-eslint disables
  // no-undef; the compiler handles undefined names there).
  {
    files: ["mcp/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },

  // Project-specific rules
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      // Next.js recommended (subset that catches real bugs)
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // React hooks correctness
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Allow underscore-prefixed unused args + caught errors (common
      // pattern in Supabase callbacks + cleanup handlers)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // We use `any` sparingly + intentionally in store-row mappings;
      // make it a warning so it shows up in CI but doesn't block.
      "@typescript-eslint/no-explicit-any": "warn",

      // empty catch is sometimes legitimate (we re-fall-through to
      // seed data and log via warnDegradedMode separately)
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },

  // Tests get a slightly looser ruleset
  {
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Config files use CommonJS patterns (plugin loaders, etc.)
  {
    files: [
      "*.config.{ts,js,mjs,cjs}",
      "tailwind.config.{ts,js}",
      "postcss.config.{ts,js,mjs}",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
