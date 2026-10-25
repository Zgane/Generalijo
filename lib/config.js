/** Nastavitve, ki jih mail sestavi lokalno. Model jih ne določa. */
export const CONFIG = {
  modelPrivzeto: "claude-sonnet-5-5",
  maxTokensPrivzeto: 4096,
  maxTokensMin: 256,
  maxTokensMax: 8192,
  maxBesedilo: 50_000,
  maxZahteva: 100_000,
  minBesedilo: 40,
  rateLimit: 20,
  rateWindowMs: 10 * 60 * 1000,
  maxPdfMb: 15,
  maxStrani: 40,
  asistencaKm: { L: 500, M: 300 },
  nadomestnoVoziloDni: 3,
  podpis: {
    ime: "Žan Mažgon",
    vrstica: "Zavarovalni zastopnik | Generali zavarovalnica d.d.",
  },
  zakljucek: "Sem vam na voljo za vsa vprašanja.",
  pozdrav: "Lep pozdrav,",
};
