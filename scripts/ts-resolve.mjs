// Lets Node run unit tests against app modules that import siblings without
// extensions ("./dates"), as Next.js expects. Test-only; the app build ignores it.
// Usage: node --import ./scripts/ts-resolve.mjs scripts/test-agenda.ts
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
