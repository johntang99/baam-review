import "server-only";
import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import type { AuditViewModel } from "./types";

const TEMPLATES_DIR = path.join(process.cwd(), "lib/audit/templating/templates");

let compiledTemplate: HandlebarsTemplateDelegate | null = null;
let cachedStyles: string | null = null;

// In dev, skip the cache so audit.hbs / styles.css edits show up without
// a server restart. Next.js hot-reload only watches .ts/.tsx, so without
// this the cached template persists across template-file edits.
const DEV_NO_CACHE = process.env.NODE_ENV !== "production";

export function renderAuditHtml(view: AuditViewModel): string {
  ensureRegistered();

  if (cachedStyles === null || DEV_NO_CACHE) {
    // Self-hosted fonts are referenced by absolute URL so they resolve both
    // in the served embed and in the headless-PDF render (which has no base
    // URL). In production they come from our own domain; in dev from the
    // local server.
    const fontBase =
      process.env.NODE_ENV === "production"
        ? (process.env.NEXT_PUBLIC_APP_URL ?? "https://baamreview.com")
        : "http://localhost:4001";
    cachedStyles = fs
      .readFileSync(path.join(TEMPLATES_DIR, "styles.css"), "utf-8")
      .replace(/__FONT_BASE__/g, fontBase);
  }

  if (compiledTemplate === null || DEV_NO_CACHE) {
    const source = fs.readFileSync(
      path.join(TEMPLATES_DIR, "audit.hbs"),
      "utf-8",
    );
    compiledTemplate = Handlebars.compile(source);
  }

  return compiledTemplate({ ...view, styles: cachedStyles });
}

let registered = false;
function ensureRegistered() {
  // In dev, re-register partials on every render so edits to .hbs files
  // pick up without a server restart. Previously the `registered` flag
  // was sticky across requests and partials were frozen to whatever the
  // first render saw — a debugging trap because audit.hbs itself was
  // already dev-no-cache, so partial edits looked silently ignored.
  if (registered && process.env.NODE_ENV === "production") return;
  registered = true;

  Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

  const partialsDir = path.join(TEMPLATES_DIR, "partials");
  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith(".hbs")) continue;
    const name = file.replace(/\.hbs$/, "");
    const source = fs.readFileSync(path.join(partialsDir, file), "utf-8");
    Handlebars.registerPartial(name, source);
  }
}
