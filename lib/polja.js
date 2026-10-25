/**
 * Polja, ki jih sme vrniti model. Ime in naslov namerno manjkata:
 * ostaneta na napravi in se v pozdrav vstavita šele pri sestavi maila.
 * Vsi ključi so obvezni (prazen niz, 0 ali false), brez union tipov,
 * da je JSON shema dovolj preprosta za strukturiran izhod.
 */
export const MODEL_SPEC = [
  ["tip", "string", "avto ali dom"],
  ["premija", "number", "Skupna letna premija v EUR. 0 če je ni."],
  ["znamkaModel", "string", "Znamka in model. Prazen niz pri domu."],
  ["registrska", "string", "Registrska oznaka. Prazen niz če je ni."],
  ["aoStvari", "number", "AO vsota za stvari v EUR. 0 če je ni."],
  ["aoOsebe", "number", "AO vsota za osebe v EUR. 0 če je ni."],
  ["aoPlusVsota", "number", "AO+ vsota v EUR. 0 če ni vključen."],
  ["aoZamrznjen", "boolean", "True samo če je na polici AO-ZAMRZNJEN."],
  ["nezgodaSmrt", "number", "Nezgoda, smrt, v EUR. 0 če je ni."],
  ["nezgodaInvalidnost", "number", "Nezgoda, invalidnost, v EUR. 0 če je ni."],
  ["pravnaVsota", "number", "Pravna zaščita v EUR. 0 če je ni."],
  ["asistenca", "string", "L, M, drugo ali prazen niz."],
  ["odkupPrveSkode", "boolean", "True samo če je odkup prve škode."],
  ["kaskoPromet", "boolean", "True če je kasko prometna nesreča."],
  ["kaskoPrometOdstotek", "number", "Franšiza v odstotkih. 0 če je ni."],
  ["kaskoPrometEur", "number", "Okvirna franšiza v EUR. 0 če je ni."],
  ["kaskoPozar", "boolean", "True če je požar vključen."],
  ["kaskoNarava", "boolean", "True če je narava vključena."],
  ["kaskoZlonamerna", "boolean", "True če so zlonamerna dejanja vključena."],
  ["kaskoToca", "boolean", "True če je delni kasko toča."],
  ["kaskoKraja", "boolean", "True če je delni kasko kraja."],
  ["kaskoParkirisce", "boolean", "True če je parkirišče vključeno."],
  ["kaskoParkirisceOdstotek", "number", "Franšiza v odstotkih."],
  ["kaskoParkirisceEur", "number", "Okvirna franšiza v EUR."],
  ["kaskoStekla", "boolean", "True če so stekla vključena."],
  ["kaskoSteklaOdstotek", "number", "Franšiza v odstotkih."],
  ["kaskoSteklaEur", "number", "Okvirna franšiza v EUR."],
  ["kaskoSvetloba", "boolean", "True če so svetlobna telesa in ogledala vključena."],
  ["kaskoSvetlobaOdstotek", "number", "Franšiza v odstotkih."],
  ["kaskoSvetlobaEur", "number", "Okvirna franšiza v EUR."],
  ["kaskoZivali", "boolean", "True če so živali vključene."],
  ["kaskoZivaliOdstotek", "number", "Franšiza v odstotkih."],
  ["kaskoZivaliEur", "number", "Okvirna franšiza v EUR."],
  ["domTip", "string", "Tip stavbe. Prazen niz pri avtu."],
  ["domIzvedba", "string", "Izvedba stanovanja."],
  ["domLeto", "string", "Leto izgradnje."],
  ["domGospodinjstva", "string", "Število gospodinjstev."],
  ["domMaterial", "string", "Material nosilne konstrukcije."],
  ["domKritina", "string", "Strešna kritina."],
  ["domBivalni", "number", "Bivalna površina v m2."],
  ["domTerasa", "number", "Terasa, balkon ali loža v m2. 0 če je ni."],
  ["domKlet", "number", "Klet v m2. 0 če je ni."],
  ["domGaraza", "number", "Garaža v m2. 0 če je ni."],
  ["domKoristna", "number", "Koristna površina v m2."],
  ["domNepremicnina", "boolean", "True če je sklop nepremičnine."],
  ["domNepremicninaNacin", "string", "Način zavarovanja nepremičnine."],
  ["domNepremicninaVsota", "number", "Zavarovalna vsota nepremičnine v EUR."],
  ["domPremicnine", "boolean", "True če je sklop premičnin."],
  ["domPremicnineNacin", "string", "Način zavarovanja premičnin."],
  ["domPremicnineVsota", "number", "Zavarovalna vsota premičnin v EUR."],
  ["domOdgovornost", "boolean", "True če je sklop odgovornosti."],
  ["domOdgovornostVsota", "number", "Zavarovalna vsota odgovornosti v EUR."],
];

export function praznaPolja() {
  const out = { ime: "", naslov: "" };
  for (const [key, type] of MODEL_SPEC) {
    if (type === "number") out[key] = 0;
    else if (type === "boolean") out[key] = false;
    else out[key] = "";
  }
  out.tip = "avto";
  return out;
}

export function samoModel(polja) {
  const out = {};
  for (const [key] of MODEL_SPEC) out[key] = polja[key];
  return out;
}

/** Modelova polja + lokalno ime in naslov. Imena iz odgovora ne prevzame. */
export function zdruziPolja(model, lokalno = {}) {
  const out = praznaPolja();
  const source = model && typeof model === "object" ? model : {};
  for (const [key] of MODEL_SPEC) {
    if (key in source) out[key] = source[key];
  }
  out.ime = String(lokalno.ime || "");
  out.naslov = String(lokalno.naslov || "");
  return out;
}
