import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { praznaPolja, samoModel } from "../lib/polja.js";
import { resetRateLimit } from "../lib/guard.js";

const avto = readFileSync(new URL("./fixtures/avto.txt", import.meta.url), "utf8");
const { default: handler } = await import("../netlify/functions/claude.js");

function envMap(extra = {}) {
  const values = {
    APP_TOKEN: "test-zeton",
    ANTHROPIC_API_KEY: "test-kljuc",
    ALLOWED_ORIGIN: "https://primer.test",
    ANTHROPIC_MODEL: "",
    ANTHROPIC_MAX_TOKENS: "",
    URL: "",
    DEPLOY_PRIME_URL: "",
    ...extra,
  };
  globalThis.Netlify = { env: { get: (name) => values[name] || "" } };
}

function zahteva({ body, token = "test-zeton", origin = "https://primer.test", ip = "203.0.113.10", method = "POST" }) {
  return new Request("https://primer.test/api/claude", {
    method,
    headers: {
      origin,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: method === "GET" || method === "OPTIONS" ? undefined : JSON.stringify(body),
  });
}

test.beforeEach(() => {
  resetRateLimit();
  envMap();
});

test("proxy zavrne tuje poreklo in napačen žeton", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("ne sme"); };
  const origin = await handler(zahteva({ body: { besedilo: avto }, origin: "https://evil.example", ip: "203.0.113.1" }));
  assert.equal(origin.status, 403);
  const token = await handler(zahteva({ body: { besedilo: avto }, token: "narobe", ip: "203.0.113.2" }));
  assert.equal(token.status, 401);
  const data = await token.json();
  assert.match(data.napaka, /žeton/i);
  assert.equal(called, false);
});

test("v model gre zakrito besedilo, ne izbira odjemalca", async () => {
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, headers: init.headers, body: JSON.parse(init.body) };
    const polja = samoModel({ ...praznaPolja(), tip: "avto", premija: 486.5, znamkaModel: "Volkswagen Golf", registrska: "LJ TEST1" });
    return new Response(JSON.stringify({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(polja) }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const response = await handler(zahteva({
    body: { besedilo: avto, model: "claude-evil", messages: [{ type: "document" }] },
    ip: "203.0.113.3",
  }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.polja.tip, "avto");
  assert.equal(data.polja.ime, "");
  assert.equal(data.polja.znamkaModel, "Volkswagen Golf");
  assert.equal(sent.url, "https://api.anthropic.com/v1/messages");
  assert.equal(sent.headers["x-api-key"], "test-kljuc");
  assert.equal(sent.headers["anthropic-dangerous-allow-browser"], undefined);
  assert.equal(sent.body.model, "claude-sonnet-5-5");
  assert.equal(sent.body.max_tokens, 4096);
  assert.equal(JSON.stringify(sent.body).includes("Janez"), false);
  assert.equal(JSON.stringify(sent.body).includes("base64"), false);
  assert.match(sent.body.messages[0].content, /Volkswagen Golf/);
  assert.equal(JSON.stringify(data).includes("0101995500111"), false);
});

test("napaka modela ne vrne besedila police", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { type: "api_error", message: "Janez Testnik 0101995500111" },
  }), { status: 500 });
  const response = await handler(zahteva({ body: { besedilo: avto }, ip: "203.0.113.4" }));
  const raw = await response.text();
  assert.equal(response.status, 502);
  assert.equal(raw.includes("Janez"), false);
  assert.equal(raw.includes("0101995500111"), false);
  assert.match(raw, /ni dosegljiv/);
});

test("nepopoln odgovor ima slovensko sporočilo", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    stop_reason: "max_tokens",
    content: [{ type: "text", text: "Janez Testnik" }],
  }), { status: 200 });
  const response = await handler(zahteva({ body: { besedilo: avto }, ip: "203.0.113.5" }));
  const data = await response.json();
  assert.equal(response.status, 422);
  assert.match(data.napaka, /predolg/);
  assert.equal(JSON.stringify(data).includes("Janez"), false);
});

test("omejitev števila klicev", async () => {
  globalThis.fetch = async () => { throw new Error("ne sme"); };
  let last = 0;
  for (let i = 0; i < 21; i += 1) {
    const response = await handler(zahteva({ body: { besedilo: "kratek" }, ip: "203.0.113.9" }));
    last = response.status;
  }
  assert.equal(last, 429);
});
