import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG } from "../lib/config.js";
import { sestaviMail } from "../lib/email.js";
import { praznaPolja } from "../lib/polja.js";
import { oznakaTipa, opozorila } from "../lib/validate.js";

function avtoPolja() {
  return {
    ...praznaPolja(),
    tip: "avto",
    ime: "Janez Testnik",
    premija: 486.5,
    znamkaModel: "Volkswagen Golf",
    registrska: "LJ TEST1",
    aoStvari: 5_000_000,
    aoOsebe: 6_000_000,
    aoPlusVsota: 50_000,
    aoZamrznjen: true,
    nezgodaSmrt: 10_000,
    nezgodaInvalidnost: 20_000,
    pravnaVsota: 8_000,
    asistenca: "L",
    odkupPrveSkode: true,
    kaskoPromet: true,
    kaskoPrometOdstotek: 5,
    kaskoPrometEur: 150,
    kaskoPozar: true,
    kaskoNarava: true,
    kaskoZlonamerna: true,
    kaskoParkirisce: true,
    kaskoParkirisceOdstotek: 1,
    kaskoParkirisceEur: 30,
    kaskoStekla: true,
    kaskoSvetloba: true,
    kaskoSvetlobaOdstotek: 10,
    kaskoSvetlobaEur: 40,
    kaskoZivali: true,
    kaskoZivaliOdstotek: 5,
    kaskoZivaliEur: 80,
  };
}

test("avto mail: pozdrav, asistenca L in podpis", () => {
  const { zadeva, mail } = sestaviMail(avtoPolja());
  assert.equal(zadeva, "Obnova avtomobilskega zavarovanja – Volkswagen Golf LJ TEST1");
  assert.match(mail, /^Spoštovani Janez Testnik,/);
  assert.match(mail, /stvari do 5\.000\.000 € \/ osebe do 6\.000\.000 € \+ zelena karta/);
  assert.match(mail, /zamrznjen bonus/);
  assert.match(mail, new RegExp(`Asistenca L\\n  ↳ pomoč na cesti do ${CONFIG.asistencaKm.L} km`));
  assert.doesNotMatch(mail, /300 km/);
  assert.match(mail, /odkup prve škode/);
  assert.match(mail, /franšiza 5% \(~150 €\)/);
  assert.match(mail, /Požar\n  ↳ brez franšize/);
  assert.match(mail, /Stekla\n  ↳ brez franšize/);
  assert.doesNotMatch(mail, /Toča/);
  assert.match(mail, /SKUPNA LETNA PREMIJA: 486,50 €/);
  assert.match(mail, new RegExp(CONFIG.podpis.ime));
  assert.match(mail, new RegExp(CONFIG.podpis.vrstica.replace("|", "\\|")));
  assert.doesNotMatch(mail, /PODATKI O STANOVANJU/);
});

test("asistenca M je 300 km", () => {
  const { mail } = sestaviMail({ ...avtoPolja(), asistenca: "M" });
  assert.match(mail, /Asistenca M/);
  assert.match(mail, new RegExp(`${CONFIG.asistencaKm.M} km`));
  assert.doesNotMatch(mail, /500 km/);
});

test("brez imena je splošen pozdrav, brez kaska ni sekcije", () => {
  const { mail } = sestaviMail({
    ...praznaPolja(),
    tip: "avto",
    premija: 120,
    znamkaModel: "Fiat Punto",
    registrska: "KP VZOREC",
    aoStvari: 1000,
    aoOsebe: 2000,
  });
  assert.match(mail, /^Spoštovani,/);
  assert.doesNotMatch(mail, /KASKO/);
  assert.doesNotMatch(mail, /AO\+/);
});

test("dom mail ne postane avto in izpusti prazne površine", () => {
  const { zadeva, mail, tip } = sestaviMail({
    ...praznaPolja(),
    tip: "dom",
    ime: "Maja Vzorec",
    naslov: "Vzorčna cesta 4, 2000 Maribor",
    premija: 210,
    domTip: "bloku",
    domIzvedba: "etaža",
    domLeto: "1998",
    domGospodinjstva: "1",
    domMaterial: "opeka",
    domKritina: "opeka",
    domBivalni: 65,
    domTerasa: 8.5,
    domKlet: 0,
    domGaraza: 0,
    domKoristna: 73,
    domNepremicnina: true,
    domNepremicninaNacin: "na novo vrednost",
    domNepremicninaVsota: 180000,
    domOdgovornost: true,
    domOdgovornostVsota: 50000,
  });
  assert.equal(tip, "dom");
  assert.equal(zadeva, "Zavarovanje nepremičnine – Vzorčna cesta 4, 2000 Maribor");
  assert.match(mail, /Stanovanje v bloku, etaža/);
  assert.match(mail, /odprta terasa\/balkon\/loža: 8,5 m²/);
  assert.doesNotMatch(mail, /kletni prostori/);
  assert.doesNotMatch(mail, /garaža/);
  assert.match(mail, /Zavarovanje nepremičnine/);
  assert.doesNotMatch(mail, /Zavarovanje premičnin/);
  assert.match(mail, /franšiza: brez/);
  assert.match(mail, /SKUPNA LETNA PREMIJA: 210 €/);
  assert.doesNotMatch(mail, /OBVEZNA ZAVAROVANJA/);
});

test("neznana vrsta ni samodejno Dom", () => {
  assert.equal(oznakaTipa("avto"), "Avtomobilsko");
  assert.equal(oznakaTipa("dom"), "Dom");
  assert.equal(oznakaTipa("nekaj"), "");
  assert.throws(() => sestaviMail({ ...praznaPolja(), tip: "nekaj" }), /avto ali dom/);
});

test("opozorila za premijo 0 in prazno registrsko", () => {
  const text = opozorila({ ...praznaPolja(), tip: "avto", premija: 0, registrska: "", ime: "" }).join("\n");
  assert.match(text, /Premija je 0 €/);
  assert.match(text, /Manjka registrska/);
  assert.match(text, /Pozdrav bo splošen/);
  const dom = opozorila({ ...praznaPolja(), tip: "dom", premija: 10, naslov: "" }).join("\n");
  assert.match(dom, /naslov ni bil poslan/);
  assert.doesNotMatch(dom, /registrska/);
});
