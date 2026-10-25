import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("odjemalec ne kliče modela neposredno in nima ključa", () => {
  const client = ["index.html", "js/app.js", "js/pdf.js", "css/app.css"].map(read).join("\n");
  assert.doesNotMatch(client, /api\.anthropic\.com/);
  assert.doesNotMatch(client, /dangerous-allow-browser/);
  assert.doesNotMatch(client, /localStorage\.(get|set)Item/);
  assert.match(client, /localStorage\.removeItem\("generali_api_key"\)/);
  assert.match(client, /\/api\/claude/);
  assert.match(client, /izbranaDatoteka/);
  assert.doesNotMatch(client, /izbranaDataoteka/);
  assert.match(client, /preveriDatoteko/);
  assert.match(client, /Kopiraj/);
  assert.match(client, /Odpri v pošti/);
  assert.match(client, /mailto:/);
  assert.match(read("js/pdf.js"), /vendor\/pdfjs\/pdf\.min\.mjs/);
  assert.doesNotMatch(client, /cdnjs|jsdelivr|unpkg/);
});

test("funkcija ne odmeva telesa odjemalca in nima odprtega CORS", () => {
  const fn = read("netlify/functions/claude.js");
  assert.doesNotMatch(fn, /Allow-Origin":\s*"\*"/);
  assert.doesNotMatch(fn, /dangerous-allow-browser/);
  assert.match(fn, /readPolja/);
  assert.match(read("lib/extract.js"), /output_config/);
  assert.match(read("lib/extract.js"), /stop_reason/);
});

test("manifest in delavec", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.lang, "sl");
  assert.equal(manifest.share_target.method, "POST");
  assert.equal(manifest.share_target.params.files[0].name, "pdf");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  const sw = read("sw.js");
  assert.match(sw, /SHELL_CACHE/);
  assert.match(sw, /\/api\//);
  assert.match(sw, /generali-mail-/);
});
