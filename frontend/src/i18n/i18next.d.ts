// Tells TypeScript which translation keys exist, so a wrong key is a compile error.
import type { en } from "./en";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
