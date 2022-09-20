module.exports = {
  overrides: [
    {
      files: ["*.{ts,tsx}"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",
      extends: ["airbnb-base", "airbnb-typescript/base"],
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  ],
};
