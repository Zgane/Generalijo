import assert from "node:assert/strict";
import test from "node:test";
import { praznaPolja, samoModel } from "../lib/polja.js";
import { jsonSchema } from "../lib/schema.js";
import { buildAnthropicBody, readPolja } from "../lib/extract.js";
import {
  corsHeaders,
  createRateLimiter,
  maxTokensFromEnv,
  modelFromEnv,
  originAllowed,
  originList,
  parseClientBody,
  tokensMatch,
} from "../lib/guard.js";
import { preveriDatoteko } from "../lib/files.js";

test("izvor ni nikoli zvezdica", () => {
  const list = originList({ ALLOWED_ORIGIN: "https://polica.example/, *", URL: "https://drugo.example" });
  assert.deepEqual(list, ["https://polica.example"]);
  assert.equal(originAllowed("https://polica.example", list), true);
  assert.equal(originAllowed("https://evil.example", list), false);
  assert.equal(originAllowed("", list), true);
  const headers = corsHeaders("https://polica.example", list);
  assert.equal(headers["Access-Control-Allow-Origin"], "https://polica.example");
  assert.equal(JSON.stringify(headers).includes("*"), false);
  const blocked = corsHeaders("https://evil.example", list);
  assert.equal(blocked["Access-Control-Allow-Origin"], undefined);
});

test("brez ALLOWED_ORIGIN se uporabi naslov strani", () => {
  const list = originList({ URL: "https://ime.netlify.app/", DEPLOY_PRIME_URL: "https://preview.netlify.app" });
  assert.ok(list.includes("https://ime.netlify.app"));
  assert.ok(list.includes("https://preview.netlify.app"));
  assert.ok(list.includes("http://localhost:8888"));
});

test("žeton in omejitev", () => {
  assert.equal(tokensMatch("abc", "abc"), true);
  assert.equal(tokensMatch("abc", "abd"), false);
  assert.equal(tokensMatch("abc", "abcd"), false);
  assert.equal(tokensMatch("", "abc"), false);
  let now = 0;
  const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
  assert.equal(allow("1.1.1.1"), true);
  assert.equal(allow("1.1.1.1"), true);
  assert.equal(allow("1.1.1.1"), false);
  assert.equal(allow("2.2.2.2"), true);
  now = 1001;
  assert.equal(allow("1.1.1.1"), true);
});

test("model in dolžina ostaneta na strežniku", () => {
  assert.equal(modelFromEnv(""), "claude-sonnet-5-5");
  assert.equal(modelFromEnv("claude-haiku-5-5"), "claude-haiku-5-5");
  assert.equal(modelFromEnv("gpt-evil"), "claude-sonnet-5-5");
  assert.equal(maxTokensFromEnv(""), 4096);
  assert.equal(maxTokensFromEnv("100"), 256);
  assert.equal(maxTokensFromEnv("99999"), 8192);
  const parsed = parseClientBody({
    besedilo: "samo besedilo",
    model: "claude-evil",
    messages: [{ role: "user", content: "pdf" }],
  });
  assert.equal(parsed.besedilo, "samo besedilo");
  assert.equal(parsed.model, undefined);
});

test("shema nima osebnih polj in zahteva vsa polja", () => {
  const schema = jsonSchema();
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.ime, undefined);
  assert.equal(schema.properties.naslov, undefined);
  assert.ok(schema.required.includes("premija"));
  assert.ok(schema.required.includes("registrska"));
  assert.deepEqual(schema.required, Object.keys(schema.properties));
});

test("telo proti modelu je samo zakrito besedilo", () => {
  const body = buildAnthropicBody({
    besedilo: "Volkswagen Golf premija 100 [IME] [EMSO]",
    model: "claude-sonnet-5-5",
    maxTokens: 4096,
  });
  assert.equal(body.model, "claude-sonnet-5-5");
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.tool_choice, undefined);
  assert.equal(body.output_config.format.type, "json_schema");
  const packed = JSON.stringify(body);
  assert.equal(packed.includes("base64"), false);
  assert.equal(packed.includes("Janez"), false);
  assert.match(body.messages[0].content, /Volkswagen Golf/);
});

test("stop_reason in oblika odgovora", () => {
  assert.match(readPolja({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] }).napaka, /predolg/);
  assert.match(readPolja({ stop_reason: "refusal", content: [] }).napaka, /zavrnil/);
  const ok = readPolja({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(samoModel(praznaPolja())) }],
  });
  assert.equal(ok.polja.tip, "avto");
  assert.equal(ok.polja.ime, "");
  const dirty = samoModel({ ...praznaPolja(), znamkaModel: "test@example.com", registrska: "lj vzorec" });
  const cleaned = readPolja({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(dirty) }] });
  assert.equal(cleaned.polja.znamkaModel, "");
  assert.equal(cleaned.polja.registrska, "LJ VZOREC");
});

test("datoteka: tip in velikost", () => {
  const maxBytes = 10;
  assert.match(preveriDatoteko({ name: "slika.png", type: "image/png", size: 4 }, { maxBytes }), /samo PDF/);
  assert.match(preveriDatoteko({ name: "a.pdf", type: "application/pdf", size: 50 }, { maxBytes }), /prevelika/);
  assert.equal(preveriDatoteko({ name: "a.pdf", type: "application/pdf", size: 0 }, { maxBytes }), "Datoteka je prazna.");
  assert.equal(preveriDatoteko({ name: "Polica.PDF", type: "application/octet-stream", size: 4 }, { maxBytes }), "");
  assert.equal(preveriDatoteko({ name: "polica.pdf", type: "", size: 4 }, { maxBytes }), "");
});
