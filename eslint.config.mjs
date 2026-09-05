import js from '@eslint/js';

export default [
  { ignores: ['.next/**', 'node_modules/**'] },
  js.configs.recommended,
];
