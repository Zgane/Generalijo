import { isEmso } from "./mask.js";
import { praznaPolja, MODEL_SPEC } from "./polja.js";
import { NAVODILA, jsonSchema } from "./schema.js";

const SLABI_RAZLOGI = {
  max_tokens: "Odgovor je bil predolg in nepopoln. Poskusite znova.",
  refusal: "Model je zavrnil branje tega besedila.",
  model_context_window_exceeded: "Besedilo je predolgo za model.",
  pause_turn: "Odgovor modela je nepopoln. Poskusite znova.",
  tool_use: "Odgovor ni vseboval podatkov. Poskusite znova.",
};

function ocistiNiz(value) {
  let text = String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  if (text.length > 160) text = text.slice(0, 160);
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "";
  if (/\bSI\d{2}(?:\s*\d){15}\b/i.test(text)) return "";
  const digits = text.replace(/\D/g, "");
  if (digits.length === 13 && isEmso(digits) && text.replace(/\s/g, "") === digits) return "";
  return text.replace(/\[[A-ZČŠŽĆĐ]{2,12}\]/g, "").trim();
}

export function normalizePolja(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { napaka: "Odgovor ne ustreza pričakovani obliki." };
  }
  const tip = typeof raw.tip === "string" ? raw.tip.trim().toLowerCase() : "";
  if (tip !== "avto" && tip !== "dom") {
    return { napaka: "Vrsta police ni prepoznana. Poskusite znova." };
  }
  const polja = praznaPolja();
  polja.tip = tip;
  polja.ime = "";
  polja.naslov = "";
  for (const [key, type] of MODEL_SPEC) {
    if (key === "tip") continue;
    if (!(key in raw)) return { napaka: "Odgovor ne vsebuje vseh polj. Poskusite znova." };
    const value = raw[key];
    if (type === "boolean") {
      if (typeof value !== "boolean") return { napaka: "Odgovor ne ustreza pričakovani obliki." };
      polja[key] = value;
    } else if (type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { napaka: "Odgovor ne ustreza pričakovani obliki." };
      }
      polja[key] = Math.min(1e9, Math.max(0, value));
    } else if (typeof value !== "string") {
      return { napaka: "Odgovor ne ustreza pričakovani obliki." };
    } else {
      polja[key] = ocistiNiz(value);
    }
  }
  const asist = polja.asistenca.toUpperCase();
  polja.asistenca = asist === "L" || asist === "M" ? asist : asist ? "drugo" : "";
  polja.registrska = polja.registrska.toUpperCase();
  return { polja };
}

export function readPolja(data) {
  if (!data || typeof data !== "object") return { napaka: "Odgovor modela ni bil berljiv." };
  if (data.stop_reason && SLABI_RAZLOGI[data.stop_reason]) return { napaka: SLABI_RAZLOGI[data.stop_reason] };
  if (data.stop_reason && data.stop_reason !== "end_turn" && data.stop_reason !== "stop_sequence") {
    return { napaka: "Odgovor modela je nepopoln. Poskusite znova." };
  }
  const blocks = Array.isArray(data.content) ? data.content : [];
  const text = blocks
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (!text) return { napaka: "Odgovor ni vseboval podatkov. Poskusite znova." };
  try {
    return normalizePolja(JSON.parse(text));
  } catch {
    return { napaka: "Odgovora ni bilo mogoče prebrati. Poskusite znova." };
  }
}

/**
 * Telo za Anthropic sestavi samo strežnik.
 * Strukturiran JSON (output_config.format) drži polja na shemi.
 * Prisilni tool_choice tipa "tool"/"any" na trenutnem Sonnetu vrne 400,
 * zato ga ne pošiljamo.
 */
export function buildAnthropicBody({ besedilo, model, maxTokens }) {
  return {
    model,
    max_tokens: maxTokens,
    messages: [{
      role: "user",
      content: `${NAVODILA}\n\nBESEDILO POLICE:\n${besedilo}`,
    }],
    output_config: {
      format: {
        type: "json_schema",
        schema: jsonSchema(),
      },
    },
  };
}
