import js from "@eslint/js";
import ts from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-empty-object-type": "off",
      "prefer-const": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.config.*", "*.d.ts"],
  },
  prettier
);
