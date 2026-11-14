// Lint rules: the TypeScript basics plus the accessibility rules for JSX (eslint-plugin-jsx-a11y).
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "playwright-report", "test-results"] },
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
);
