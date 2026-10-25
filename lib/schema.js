import { MODEL_SPEC } from "./polja.js";

export const NAVODILA = `Iz zakritega besedila zavarovalne police izlušči samo podatke o zavarovanju.
Besedilo je že očiščeno. Oznake [IME], [NASLOV], [EMSO], [DAVCNA], [TELEFON], [EPOSTA] in [IBAN] niso podatki. Ne prepisuj jih v polja in ne ugibaj, kaj je bilo za njimi.
Ne izmišljaj zneskov. Če podatka ni, vrni prazen niz, 0 ali false, kot zahteva shema.
tip je "avto" za avtomobilsko polico. tip je "dom" za nepremičnino ali Paket Dom. Druge vrednosti niso dovoljene.
premija je skupna letna premija v evrih kot število. Slovenski zapis 1.234,50 pomeni 1234.5. Tisočice so pike, decimalke vejica.
registrska je registrska oznaka vozila. Če je ni, prazen niz.
asistenca je "L" ali "M" samo če je na polici tako napisano, "drugo" če je asistenca brez črke L ali M, sicer prazen niz.
aoZamrznjen je true samo če piše AO-ZAMRZNJEN ali zamrznjen bonus pri AO.
odkupPrveSkode je true samo če piše odkup prve škode.
Franšiza 0 pomeni brez franšize. Odstotek in znesek zapiši ločeno.
Za polja, ki ne spadajo k tej vrsti police, vrni prazen niz, 0 ali false.
Odgovori samo v zahtevani JSON obliki, brez razlage.`;

export function jsonSchema() {
  const properties = {};
  const required = [];
  for (const [key, type, description] of MODEL_SPEC) {
    required.push(key);
    if (key === "tip") {
      properties[key] = { type: "string", enum: ["avto", "dom"], description };
    } else if (key === "asistenca") {
      properties[key] = { type: "string", enum: ["", "L", "M", "drugo"], description };
    } else {
      properties[key] = { type, description };
    }
  }
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties,
  };
}
