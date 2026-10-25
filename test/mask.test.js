import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { maskPolicyText } from "../lib/mask.js";

const avto = readFileSync(new URL("./fixtures/avto.txt", import.meta.url), "utf8");
const dom = readFileSync(new URL("./fixtures/dom.txt", import.meta.url), "utf8");

test("avto vzorec: osebni podatki se zakrijejo, zneski ostanejo", () => {
  const out = maskPolicyText(avto);
  assert.equal(out.ime, "Janez Testnik");
  assert.equal(out.naslov, "Testna ulica 12, 1000 Ljubljana");
  for (const secret of [
    "Janez", "Testnik", "janez.testnik@example.com", "0101995500111", "12345678",
    "+386 41 000 000", "SI56", "Testna ulica", "Ljubljana", "1502199509999",
  ]) {
    assert.equal(out.text.includes(secret), false, secret);
  }
  assert.match(out.text, /\[IME\]/);
  assert.match(out.text, /\[NASLOV\]/);
  assert.match(out.text, /\[EMSO\]/);
  assert.match(out.text, /\[DAVCNA\]/);
  assert.match(out.text, /\[TELEFON\]/);
  assert.match(out.text, /\[EPOSTA\]/);
  assert.match(out.text, /\[IBAN\]/);
  assert.match(out.text, /Volkswagen Golf/);
  assert.match(out.text, /LJ TEST1/);
  assert.match(out.text, /5\.000\.000/);
  assert.match(out.text, /6\.000\.000/);
  assert.match(out.text, /486,50/);
  assert.match(out.text, /Asistenca L/);
  assert.match(out.text, /Žan Mažgon/);
  assert.match(out.text, /3210999500111/);
});

test("dom vzorec: ime je zavarovalec, ne zastopnik", () => {
  const out = maskPolicyText(dom);
  assert.equal(out.ime, "Maja Vzorec");
  assert.equal(out.naslov, "Vzorčna cesta 4, 2000 Maribor");
  for (const secret of ["Maja", "Vzorec", "maja.vzorec@example.com", "1502199501234", "87654321", "031 555 019", "Vzorčna", "Maribor"]) {
    assert.equal(out.text.includes(secret), false, secret);
  }
  assert.match(out.text, /Žan Mažgon/);
  assert.match(out.text, /180000/);
  assert.match(out.text, /210 EUR/);
});

test("samo zastopnik ni ime stranke", () => {
  const out = maskPolicyText("Zavarovalni zastopnik: Žan Mažgon\nZavarovalec: Žan Mažgon\nPremija 100 EUR in dovolj besedila za vzorec.");
  assert.equal(out.ime, "");
  assert.match(out.text, /Žan Mažgon/);
});

test("prazno besedilo ne vrže", () => {
  const out = maskPolicyText("");
  assert.equal(out.ime, "");
  assert.equal(out.naslov, "");
  assert.equal(out.text, "");
});
