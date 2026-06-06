// Stubs the "server-only" package so we can run server-only modules from
// the test-render-audit script. "server-only" is a Next.js convention that
// throws if loaded outside a server component — fine in production, in the
// way for offline / CLI rendering. The shim intercepts the require for that
// id only and returns an empty object.
const Module = require("node:module");
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "server-only") return {};
  return origRequire.apply(this, arguments);
};

// Also load .env.local — Next.js does this automatically, tsx does not.
const fs = require("node:fs");
const path = require("node:path");
try {
  const envPath = path.join(process.cwd(), ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
} catch {
  // .env.local missing — fine, fall back to current env
}
