module.exports = {
  env: {
    "es6": true
  },
  parserOptions: {
    ecmaVersion: "latest"
  },
  ignorePatterns: ["docs/**"],
  overrides: [
    {
      files: ["*.{ts,tsx}"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",
      extends: ["airbnb-base", "airbnb-typescript/base"],

      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest"
      },

      rules: {
        "import/no-extraneous-dependencies": ["error", {
          devDependencies: [
            "specs.wdio/**/*.ts",
            "specs/**/*.ts",
            "vitest.*.config.ts"
          ],
          optionalDependencies: true
        }]
      }
    },
  ],
};
