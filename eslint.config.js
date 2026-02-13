import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // ✅ AQUÍ se usa correctamente @eslint/js
      ...js.configs.recommended.rules,
      "no-unused-vars": [
      "error",
      { "varsIgnorePattern": "^_" }
    ]
    },
  },

  // ✅ Desactiva reglas que chocan con Prettier
  prettierConfig,
]);
