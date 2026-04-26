import coreWebVitals from 'eslint-config-next/core-web-vitals.js';

const config = [
  ...coreWebVitals,
  {
    rules: {
      'import/order': 'off',
      'import/extensions': 'off',
      'import/prefer-default-export': 'off',
    },
  },
];

export default config;
