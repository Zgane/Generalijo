import { CONFIG } from "./config.js";

const PH = {
  ime: "[IME]",
  naslov: "[NASLOV]",
  emso: "[EMSO]",
  davcna: "[DAVCNA]",
  telefon: "[TELEFON]",
  email: "[EPOSTA]",
  iban: "[IBAN]",
};

const STOP = new Set([
  "generali", "polica", "premija", "zavarovanje", "zavarovalnica", "avto", "dom",
  "kasko", "eur", "leto", "paket", "osnovni", "skupna", "letna", "registrska",
  "vozilo", "golf", "volkswagen", "ao",
]);

function escapeReg(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isEmso(digits) {
  if (!/^\d{13}$/.test(digits)) return false;
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12;
}

function cleanName(raw) {
  let value = String(raw || "").replace(/\s+/g, " ").trim();
  value = value.split(/\b(?:emšo|emso|davčn\w*|davcn\w*|naslov|telefon|tel\.?|e-?pošta|eposta|email|iban)\b/i)[0] || "";
  value = value.split(/[|,]/)[0].replace(/[.;:]+$/g, "").trim();
  if (value.length < 3 || value.length > 80 || /\d/.test(value)) return "";
  if (/generali|zavarovalnic|zastopnik|d\.\s*d|polica/i.test(value)) return "";
  const tokens = value.split(" ").filter(Boolean);
  if (!tokens.length || tokens.length > 4) return "";
  if (!tokens.every((token) => /^[\p{L}][\p{L}.'’\-]*$/u.test(token))) return "";
  if (value.localeCompare(CONFIG.podpis.ime, "sl", { sensitivity: "accent" }) === 0) return "";
  return value;
}

function cleanAddress(raw) {
  let value = String(raw || "").replace(/\s+/g, " ").trim();
  value = value.split(/\b(?:emšo|emso|davčn\w*|davcn\w*|telefon|tel\.?|e-?pošta|eposta|email|iban)\b/i)[0] || "";
  value = value.replace(/[;]+$/g, "").trim();
  if (value.length < 5 || value.length > 120 || !/\d/.test(value)) return "";
  return value;
}

function replacePhrase(text, phrase, token) {
  if (!phrase || phrase.length < 3) return { text, hits: 0 };
  const re = new RegExp(escapeReg(phrase), "gi");
  let hits = 0;
  const next = text.replace(re, () => {
    hits += 1;
    return token;
  });
  return { text: next, hits };
}

/**
 * Zakrije osebne podatke v besedilu police.
 * Ime in naslov vrne ločeno, da ostaneta na napravi.
 */
export function maskPolicyText(input) {
  const original = String(input || "").replace(/\r\n/g, "\n");
  const zadetki = { ime: 0, naslov: 0, emso: 0, davcna: 0, telefon: 0, email: 0, iban: 0 };

  let ime = "";
  const nameRe = /(?:zavarovalec|zavarovanec|naročnik|narocnik|ime\s+in\s+priimek|stranka)\s*[:\-–]\s*([^\n]+)/gi;
  for (const match of original.matchAll(nameRe)) {
    const cleaned = cleanName(match[1]);
    if (cleaned) {
      ime = cleaned;
      break;
    }
  }

  let naslov = "";
  const addrRe = /(?:naslov|prebivališče|prebivalisce|stalno\s+bivališče|stalno\s+bivalisce)\s*[:\-–]\s*([^\n]+)/gi;
  for (const match of original.matchAll(addrRe)) {
    const cleaned = cleanAddress(match[1]);
    if (cleaned) {
      naslov = cleaned;
      break;
    }
  }
  if (ime && naslov) {
    naslov = naslov.replace(new RegExp(escapeReg(ime), "i"), "").replace(/^[\s,.-]+/, "").trim();
  }

  let text = original;

  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => {
    zadetki.email += 1;
    return PH.email;
  });

  text = text.replace(/\bSI\d{2}(?:\s*\d){15}\b/gi, () => {
    zadetki.iban += 1;
    return PH.iban;
  });
  text = text.replace(/\biban\b\s*[:\-–]?\s*([A-Z]{2}\d{2}(?:\s*[A-Z0-9]){11,30})/gi, (full, iban) => {
    zadetki.iban += 1;
    return full.replace(iban, PH.iban);
  });

  text = text.replace(/(?:davčn\w*|davcn\w*|dš|id\s*za\s*ddv)(?:\s+\p{L}+){0,3}\s*[:\-–]?\s*((?:SI\s*)?\d{8})\b/giu, (full, num) => {
    zadetki.davcna += 1;
    return full.replace(num, PH.davcna);
  });
  text = text.replace(/\bSI\s?\d{8}\b/gi, () => {
    zadetki.davcna += 1;
    return PH.davcna;
  });

  text = text.replace(/(?:emšo|emso)\s*[:\-–]?\s*(\d(?:[ \t]?\d){12})/gi, (full, group) => {
    const digits = group.replace(/\s/g, "");
    if (!isEmso(digits) && digits.length !== 13) return full;
    zadetki.emso += 1;
    return full.replace(group, PH.emso);
  });
  text = text.replace(/\b\d{13}\b/g, (digits) => {
    if (!isEmso(digits)) return digits;
    zadetki.emso += 1;
    return PH.emso;
  });

  text = text.replace(/(?:\+386|00386)[ \t/-]*\d{1,2}[ \t/-]*\d{3}[ \t/-]*\d{3,4}\b/g, () => {
    zadetki.telefon += 1;
    return PH.telefon;
  });
  text = text.replace(/\b0\d{1,2}[ \t/-]\d{3}[ \t/-]\d{3}\b/g, () => {
    zadetki.telefon += 1;
    return PH.telefon;
  });
  text = text.replace(/\b0[3-7]\d{7}\b/g, () => {
    zadetki.telefon += 1;
    return PH.telefon;
  });

  if (naslov) {
    const replaced = replacePhrase(text, naslov, PH.naslov);
    text = replaced.text;
    zadetki.naslov += replaced.hits;
  }
  const street = /[\p{L}][\p{L}.'’\-]*(?:[ \t]+[\p{L}][\p{L}.'’\-]*){0,4}[ \t]+(?:ulica|cesta|pot|trg|naselje|steza|brv)[ \t]+\d{1,4}[A-Za-z]?(?:(?:[ \t]*,[ \t]*|[ \t]+)\d{4}[ \t]+[\p{L}][\p{L}.'’\-]*(?:[ \t]+[\p{L}][\p{L}.'’\-]*){0,2})?/giu;
  text = text.replace(street, () => {
    zadetki.naslov += 1;
    return PH.naslov;
  });

  if (ime) {
    const full = replacePhrase(text, ime, PH.ime);
    text = full.text;
    zadetki.ime += full.hits;
    const swapped = ime.split(" ").length === 2 ? ime.split(" ").reverse().join(" ") : "";
    if (swapped) {
      const back = replacePhrase(text, swapped, PH.ime);
      text = back.text;
      zadetki.ime += back.hits;
    }
    for (const token of ime.split(" ")) {
      if (token.length < 3 || STOP.has(token.toLocaleLowerCase("sl"))) continue;
      const re = new RegExp(`(?<![\\p{L}])${escapeReg(token)}(?![\\p{L}])`, "giu");
      text = text.replace(re, () => {
        zadetki.ime += 1;
        return PH.ime;
      });
    }
  }

  return { text, ime, naslov, zadetki };
}
