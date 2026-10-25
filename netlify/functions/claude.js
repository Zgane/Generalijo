import { CONFIG } from "../../lib/config.js";
import { maskPolicyText } from "../../lib/mask.js";
import { buildAnthropicBody, readPolja } from "../../lib/extract.js";
import {
  apiLimiter,
  bearerToken,
  clientIp,
  corsHeaders,
  maxTokensFromEnv,
  modelFromEnv,
  originAllowed,
  originList,
  parseClientBody,
  sporociloZaStatus,
  tokensMatch,
} from "../../lib/guard.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function setting(name) {
  const env = globalThis.Netlify && Netlify.env;
  if (!env || typeof env.get !== "function") return "";
  return env.get(name) || "";
}

function odgovor(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export default async function handler(request) {
  const allowed = originList({
    ALLOWED_ORIGIN: setting("ALLOWED_ORIGIN"),
    URL: setting("URL"),
    DEPLOY_PRIME_URL: setting("DEPLOY_PRIME_URL"),
  });
  const origin = request.headers.get("origin") || "";
  const headers = corsHeaders(origin, allowed);

  if (request.method === "OPTIONS") {
    if (origin && !originAllowed(origin, allowed)) return new Response(null, { status: 403, headers });
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return odgovor({ napaka: "Dovoljena je samo metoda POST." }, 405, headers);
  if (!originAllowed(origin, allowed)) return odgovor({ napaka: "Zahteva ni dovoljena s tega naslova." }, 403, headers);

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > CONFIG.maxZahteva) return odgovor({ napaka: "Zahteva je predolga." }, 413, headers);
  if (!apiLimiter(clientIp(request.headers))) {
    return odgovor({ napaka: "Preveč zahtev. Počakajte nekaj minut in poskusite znova." }, 429, headers);
  }

  const token = setting("APP_TOKEN");
  const apiKey = setting("ANTHROPIC_API_KEY");
  if (!token || !apiKey) return odgovor({ napaka: "Strežnik še ni nastavljen." }, 500, headers);
  if (!tokensMatch(bearerToken(request.headers.get("authorization")), token)) {
    return odgovor({ napaka: "Dostopni žeton ni pravilen." }, 401, headers);
  }

  let rawText = "";
  try {
    rawText = await request.text();
  } catch {
    return odgovor({ napaka: "Zahteve ni bilo mogoče prebrati." }, 400, headers);
  }
  if (rawText.length > CONFIG.maxZahteva) return odgovor({ napaka: "Zahteva je predolga." }, 413, headers);

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return odgovor({ napaka: "Zahteve ni bilo mogoče prebrati." }, 400, headers);
  }
  const parsed = parseClientBody(payload);
  if (parsed.napaka) return odgovor({ napaka: parsed.napaka }, 400, headers);

  const masked = maskPolicyText(parsed.besedilo).text.trim();
  if (masked.length < CONFIG.minBesedilo) return odgovor({ napaka: "Besedilo police je prekratko." }, 400, headers);
  if (masked.length > CONFIG.maxBesedilo) return odgovor({ napaka: "Besedilo je predolgo." }, 413, headers);

  const body = buildAnthropicBody({
    besedilo: masked,
    model: modelFromEnv(setting("ANTHROPIC_MODEL")),
    maxTokens: maxTokensFromEnv(setting("ANTHROPIC_MAX_TOKENS")),
  });

  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(JSON.stringify({ napaka: err && err.name ? err.name : "FetchError" }));
    return odgovor({ napaka: "Povezava do modela ni uspela." }, 502, headers);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return odgovor({ napaka: "Odgovor modela ni bil berljiv." }, 502, headers);
  }
  if (!upstream.ok) {
    console.error(JSON.stringify({ status: upstream.status, tip: data && data.error && data.error.type }));
    return odgovor({ napaka: sporociloZaStatus(upstream.status) }, 502, headers);
  }

  const result = readPolja(data);
  if (result.napaka) return odgovor({ napaka: result.napaka }, 422, headers);
  return odgovor({ polja: result.polja }, 200, headers);
}

export const config = { path: "/api/claude" };
