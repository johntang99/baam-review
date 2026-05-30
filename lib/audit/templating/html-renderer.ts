import "server-only";
import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import type { AuditViewModel } from "./types";

const TEMPLATES_DIR = path.join(process.cwd(), "lib/audit/templating/templates");

let compiledTemplate: HandlebarsTemplateDelegate | null = null;
let cachedStyles: string | null = null;

export function renderAuditHtml(view: AuditViewModel): string {
  ensureRegistered();

  if (cachedStyles === null) {
    cachedStyles = fs.readFileSync(
      path.join(TEMPLATES_DIR, "styles.css"),
      "utf-8",
    );
  }

  if (compiledTemplate === null) {
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
  if (registered) return;
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
