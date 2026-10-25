import { timingSafeEqual } from "node:crypto";
import { CONFIG } from "./config.js";

export function splitOrigins(raw) {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter((item) => item && item !== "*");
}

export function originList(env) {
  const explicit = splitOrigins(env.ALLOWED_ORIGIN);
  if (explicit.length) return explicit;
  return splitOrigins([env.URL, env.DEPLOY_PRIME_URL, "http://localhost:8888", "http://127.0.0.1:8888"].filter(Boolean).join(","));
}

export function originAllowed(origin, allowed) {
  if (!origin) return true;
  return allowed.includes(origin);
}

export function corsHeaders(origin, allowed) {
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function bearerToken(header) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(String(header || ""));
  return match ? match[1] : "";
}

export function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export function clientIp(headers) {
  const direct = headers.get("x-nf-client-connection-ip");
  if (direct) return direct.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "neznan";
}

export function createRateLimiter({ limit = CONFIG.rateLimit, windowMs = CONFIG.rateWindowMs, now = Date.now } = {}) {
  const hits = new Map();
  function allow(key) {
    const t = now();
    const fresh = (hits.get(key) || []).filter((stamp) => t - stamp < windowMs);
    if (fresh.length >= limit) {
      hits.set(key, fresh);
      return false;
    }
    fresh.push(t);
    hits.set(key, fresh);
    if (hits.size > 2000) hits.delete(hits.keys().next().value);
    return true;
  }
  allow.reset = () => hits.clear();
  return allow;
}

export const apiLimiter = createRateLimiter();

export function resetRateLimit() {
  apiLimiter.reset();
}

export function modelFromEnv(raw) {
  const model = String(raw || "").trim();
  if (!model) return CONFIG.modelPrivzeto;
  if (!/^claude-[a-z0-9.+\-]{1,80}$/i.test(model)) return CONFIG.modelPrivzeto;
  return model;
}

export function maxTokensFromEnv(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return CONFIG.maxTokensPrivzeto;
  return Math.min(CONFIG.maxTokensMax, Math.max(CONFIG.maxTokensMin, Math.round(n)));
}

export function parseClientBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { napaka: "Manjka besedilo police." };
  }
  if (typeof value.besedilo !== "string") return { napaka: "Manjka besedilo police." };
  return { besedilo: value.besedilo };
}

export function sporociloZaStatus(status) {
  if (status === 401 || status === 403) return "Strežniški ključ ni veljaven.";
  if (status === 429) return "Model je zaseden. Poskusite čez trenutek.";
  if (status === 400 || status === 422) return "Zahteve ni bilo mogoče obdelati.";
  return "Model trenutno ni dosegljiv. Poskusite znova.";
}
