// Lets `node --test` load the app's TypeScript the way Next does: the "@/" alias, extensionless relative imports,
// and packages like "next/server" that have no "exports" map. Node 25 strips the types itself.
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const tryExts = ["", ".ts", ".tsx", ".js", "/index.ts", "/index.js"];

registerHooks({
  resolve(specifier, context, next) {
    const target = specifier.startsWith("@/") ? pathToFileURL(path.join(root, specifier.slice(2))).href : specifier;
    let firstError;
    for (const ext of tryExts) {
      try {
        return next(target + ext, context);
      } catch (e) {
        firstError ??= e;
      }
    }
    throw firstError;
  },
});
