import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".next",
      "out",
      "build",
      "dist",
      "node_modules",
      "next-env.d.ts",
      "html/**",
      // Static assets, including vendored minified libraries such as lottie.min.js.
      "public/**",
      // Generated output: Hardhat build files and the backend's compiled Lambda.
      "contracts/artifacts/**",
      "contracts/cache/**",
      "backend/dist/**",
      "infra/artifacts/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
);
