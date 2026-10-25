import { CONFIG } from "../lib/config.js";
import { maskPolicyText } from "../lib/mask.js";
import { sestaviMail } from "../lib/email.js";
import { opozorila, oznakaTipa } from "../lib/validate.js";
import { preveriDatoteko } from "../lib/files.js";
import { SKUPINE, VNOS } from "../lib/fields.js";
import { zdruziPolja } from "../lib/polja.js";
import { narisiPredogled, preberiPdf } from "./pdf.js";

const ZETON_KEY = "dostopniZeton";
const MAX_BYTES = CONFIG.maxPdfMb * 1024 * 1024;

const stanje = {
  file: null,
  pdf: null,
  masked: null,
  polja: null,
  poslano: false,
};

const $ = (id) => document.getElementById(id);

function pokaziNapako(text) {
  const box = $("errorBox");
  box.textContent = text;
  box.hidden = !text;
}

function status(text) {
  $("statusLive").textContent = text || "";
}

function korak(n) {
  $("korak1").hidden = n !== 1;
  $("korak2").hidden = n !== 2;
  $("korak3").hidden = n !== 3;
  for (let i = 1; i <= 3; i += 1) $("step" + i).classList.toggle("on", i === n);
}

function zetonIzPolja() {
  const typed = $("zeton").value.trim();
  if (typed) return typed;
  try {
    return sessionStorage.getItem(ZETON_KEY) || "";
  } catch {
    return "";
  }
}

function osveziZeton() {
  let saved = "";
  try { saved = sessionStorage.getItem(ZETON_KEY) || ""; } catch { /* zasebno okno */ }
  const statusEl = $("zetonStatus");
  if (saved) {
    statusEl.textContent = "Nastavljen za to sejo";
    statusEl.className = "api-status ok";
  } else {
    statusEl.textContent = "Ni vnesen";
    statusEl.className = "api-status missing";
  }
}

function shraniZeton() {
  const value = $("zeton").value.trim();
  if (!value) {
    pokaziNapako("Vnesite dostopni žeton.");
    return;
  }
  try { sessionStorage.setItem(ZETON_KEY, value); } catch { /* ignore */ }
  $("zeton").value = "";
  osveziZeton();
  pokaziNapako("");
}

function pozabiZeton() {
  try { sessionStorage.removeItem(ZETON_KEY); } catch { /* ignore */ }
  $("zeton").value = "";
  osveziZeton();
}

function povzetekZadetkov(zadetki) {
  const imena = [
    ["ime", "ime"], ["naslov", "naslov"], ["emso", "EMŠO"], ["davcna", "davčna"],
    ["telefon", "telefon"], ["email", "e-pošta"], ["iban", "IBAN"],
  ];
  const deli = imena.filter(([key]) => zadetki[key] > 0).map(([key, label]) => `${label} (${zadetki[key]})`);
  if (!deli.length) {
    return "Samodejno ni bilo prepoznanega osebnega podatka. Pred nadaljevanjem preverite zakrito besedilo.";
  }
  return `Zakrito na napravi: ${deli.join(", ")}.`;
}

async function izbranaDatoteka(file) {
  pokaziNapako("");
  const napaka = preveriDatoteko(file, { maxBytes: MAX_BYTES });
  if (napaka) {
    stanje.file = null;
    $("fileSelected").hidden = true;
    $("maskBox").hidden = true;
    $("extractBtn").disabled = true;
    pokaziNapako(napaka);
    return;
  }
  stanje.file = file;
  if (stanje.pdf) {
    try { await stanje.pdf.destroy(); } catch { /* ignore */ }
    stanje.pdf = null;
  }
  $("fileName").textContent = file.name || "polica.pdf";
  $("fileSelected").hidden = false;
  $("maskBox").hidden = true;
  $("extractBtn").disabled = true;
  status("Berem PDF na napravi …");
  $("loading").hidden = false;
  try {
    const prebrano = await preberiPdf(file);
    stanje.pdf = prebrano.pdf;
    const masked = maskPolicyText(prebrano.text);
    stanje.masked = masked;
    const trimmed = masked.text.trim();
    if (trimmed.length < CONFIG.minBesedilo) {
      pokaziNapako("V PDF-ju ni dovolj besedila. Skenirane police ta pripomoček ne prebere.");
      return;
    }
    const stran = prebrano.strani > prebrano.prebranih
      ? `Prebranih je prvih ${prebrano.prebranih} od ${prebrano.strani} strani. `
      : `Prebranih strani: ${prebrano.strani}. `;
    $("maskSummary").textContent = stran + povzetekZadetkov(masked.zadetki);
    $("maskText").textContent = masked.text;
    $("maskBox").hidden = false;
    $("extractBtn").disabled = false;
    status("");
  } catch (err) {
    pokaziNapako(err.message || "PDF-ja ni bilo mogoče prebrati.");
  } finally {
    $("loading").hidden = true;
  }
}

function preberiObrazec() {
  const data = { ...stanje.polja };
  for (const el of document.querySelectorAll("[data-polje]")) {
    const key = el.dataset.polje;
    if (el.dataset.tip === "bool") data[key] = el.checked;
    else if (el.dataset.tip === "number") data[key] = el.value === "" ? 0 : Number(String(el.value).replace(",", "."));
    else data[key] = el.value;
  }
  return data;
}

function osveziOpozorila() {
  stanje.polja = preberiObrazec();
  const box = $("opozorila");
  const items = opozorila(stanje.polja);
  box.replaceChildren();
  for (const node of document.querySelectorAll("[data-skupina]")) {
    const when = node.dataset.when;
    node.hidden = Boolean(when && when !== stanje.polja.tip);
  }
  if (!items.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const title = document.createElement("p");
  title.className = "warn-title";
  title.textContent = "Preverite, preden sestavite mail";
  const ul = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.append(li);
  }
  box.append(title, ul);
}

function narediPolje(key) {
  const spec = VNOS[key];
  const wrap = document.createElement("label");
  wrap.className = spec.type === "bool" ? "field check" : "field";
  const span = document.createElement("span");
  span.textContent = spec.label;
  let el;
  if (spec.type === "bool") {
    el = document.createElement("input");
    el.type = "checkbox";
    el.checked = Boolean(stanje.polja[key]);
  } else if (spec.type === "select") {
    el = document.createElement("select");
    for (const [value, label] of spec.options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      el.append(opt);
    }
    el.value = stanje.polja[key] ?? "";
  } else {
    el = document.createElement("input");
    el.type = spec.type === "number" ? "number" : "text";
    el.autocomplete = "off";
    if (spec.step) el.step = spec.step;
    el.value = stanje.polja[key] ?? "";
  }
  el.dataset.polje = key;
  el.dataset.tip = spec.type;
  el.addEventListener("input", osveziOpozorila);
  el.addEventListener("change", osveziOpozorila);
  if (spec.type === "bool") wrap.append(el, span);
  else wrap.append(span, el);
  return wrap;
}

function narisiObrazec() {
  const form = $("obrazec");
  form.replaceChildren();
  for (const skupina of SKUPINE) {
    const box = document.createElement("fieldset");
    box.dataset.skupina = skupina.id;
    if (skupina.when) box.dataset.when = skupina.when;
    const legend = document.createElement("legend");
    legend.textContent = skupina.naslov;
    box.append(legend);
    if (skupina.opomba) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = skupina.opomba;
      box.append(note);
    }
    const grid = document.createElement("div");
    grid.className = "fields";
    for (const key of skupina.keys) grid.append(narediPolje(key));
    box.append(grid);
    form.append(box);
  }
  osveziOpozorila();
}

async function izlusci() {
  if (!stanje.masked || stanje.poslano) return;
  const zeton = zetonIzPolja();
  if (!zeton) {
    pokaziNapako("Vnesite dostopni žeton. To ni ključ za model; ta ostane na strežniku.");
    return;
  }
  try { sessionStorage.setItem(ZETON_KEY, zeton); } catch { /* ignore */ }
  $("zeton").value = "";
  osveziZeton();
  stanje.poslano = true;
  $("extractBtn").disabled = true;
  $("loading").hidden = false;
  pokaziNapako("");
  status("Pošiljam samo zakrito besedilo …");
  try {
    const resp = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zeton}`,
      },
      body: JSON.stringify({ besedilo: stanje.masked.text }),
    });
    let data = {};
    try { data = await resp.json(); } catch { data = {}; }
    if (!resp.ok || data.napaka || !data.polja) {
      throw new Error(data.napaka || "Priprava podatkov ni uspela.");
    }
    stanje.polja = zdruziPolja(data.polja, { ime: stanje.masked.ime, naslov: stanje.masked.naslov });
    narisiObrazec();
    korak(2);
    status("");
    const predogled = $("pdfPredogled");
    try {
      await narisiPredogled(stanje.pdf, predogled);
    } catch {
      predogled.textContent = "Predogled PDF-ja ni uspel. Podatke lahko vseeno preverite.";
    }
  } catch (err) {
    const msg = /failed to fetch|networkerror|load failed/i.test(String(err.message || ""))
      ? "Ni povezave do strežnika. Preverite internet."
      : (err.message || "Priprava podatkov ni uspela.");
    pokaziNapako(msg);
    $("extractBtn").disabled = false;
  } finally {
    stanje.poslano = false;
    $("loading").hidden = true;
  }
}

function sestavi() {
  stanje.polja = preberiObrazec();
  try {
    const mail = sestaviMail(stanje.polja);
    $("tipBadge").textContent = oznakaTipa(mail.tip);
    $("tipBadge").hidden = !oznakaTipa(mail.tip);
    $("zadeva").value = mail.zadeva;
    $("mailBody").value = mail.mail;
    $("mailNote").textContent = "";
    korak(3);
    status("Mail je osnutek. Ni bil poslan.");
  } catch (err) {
    pokaziNapako(err.message || "Maila ni bilo mogoče sestaviti.");
    korak(2);
  }
}

function besediloMaila() {
  return `Zadeva: ${$("zadeva").value.trim()}\n\n${$("mailBody").value}`;
}

async function kopiraj() {
  const text = besediloMaila();
  const btn = $("copyBtn");
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    $("mailBody").focus();
    $("mailBody").select();
  }
  btn.textContent = ok ? "Kopirano" : "Označeno — kopirajte ročno";
  btn.classList.toggle("copied", ok);
  $("mailNote").textContent = ok
    ? "Besedilo je na odložišču. Mail ni bil poslan."
    : "Odložišče ni na voljo. Besedilo je označeno, kopirajte ga ročno. Mail ni bil poslan.";
  setTimeout(() => {
    btn.textContent = "Kopiraj";
    btn.classList.remove("copied");
  }, 2500);
}

function odpriVPosti() {
  const subject = $("zadeva").value.trim();
  const body = $("mailBody").value;
  const full = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (full.length > 1800) {
    kopiraj();
    $("mailNote").textContent = "Besedilo je dolgo, zato je kopirano. V poštnem programu odprem samo zadevo. Sporočilo se ne pošlje samo.";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("Besedilo je na odložišču. Prilepite ga v sporočilo.")}`;
    return;
  }
  $("mailNote").textContent = "Odpre se vaš poštni program. Sporočilo se ne pošlje samo.";
  window.location.href = full;
}

async function novaPolica() {
  if (stanje.pdf) {
    try { await stanje.pdf.destroy(); } catch { /* ignore */ }
  }
  stanje.file = null;
  stanje.pdf = null;
  stanje.masked = null;
  stanje.polja = null;
  $("fileInput").value = "";
  $("fileSelected").hidden = true;
  $("maskBox").hidden = true;
  $("extractBtn").disabled = true;
  $("pdfPredogled").replaceChildren();
  pokaziNapako("");
  status("");
  korak(1);
}

function povezi() {
  $("shraniZeton").addEventListener("click", shraniZeton);
  $("pozabiZeton").addEventListener("click", pozabiZeton);
  $("fileInput").addEventListener("change", () => {
    const file = $("fileInput").files && $("fileInput").files[0];
    if (file) izbranaDatoteka(file);
  });
  const zone = $("uploadZone");
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  });
  zone.addEventListener("dragleave", (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag");
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) izbranaDatoteka(file);
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
  $("extractBtn").addEventListener("click", izlusci);
  $("sestaviBtn").addEventListener("click", sestavi);
  $("nazajBtn").addEventListener("click", () => { pokaziNapako(""); korak(1); });
  $("copyBtn").addEventListener("click", kopiraj);
  $("mailBtn").addEventListener("click", odpriVPosti);
  $("novaBtn").addEventListener("click", novaPolica);
  $("nazajNaPolja").addEventListener("click", () => { pokaziNapako(""); korak(2); });
  $("namestiBtn").addEventListener("click", async () => {
    const event = stanje.install;
    if (!event) return;
    $("namestiBtn").hidden = true;
    await event.prompt();
  });
}

async function naloziDeljeno() {
  const params = new URLSearchParams(location.search);
  if (!params.has("shared")) return;
  const shared = params.get("shared");
  history.replaceState({}, "", "./");
  if (shared === "0") {
    pokaziNapako("Deljenje ni vsebovalo PDF datoteke.");
    return;
  }
  try {
    const [fileResp, nameResp] = await Promise.all([
      fetch(new URL("shared-pdf", document.baseURI)),
      fetch(new URL("shared-pdf-name", document.baseURI)),
    ]);
    if (!fileResp.ok) throw new Error("fail");
    const blob = await fileResp.blob();
    let name = "polica.pdf";
    if (nameResp.ok) name = (await nameResp.text()).trim() || name;
    const type = blob.type || "application/pdf";
    await izbranaDatoteka(new File([blob], name, { type }));
  } catch {
    pokaziNapako("Deljene datoteke ni bilo mogoče prebrati. Izberite PDF še enkrat.");
  }
}

function registrirajDelavca() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
    /* namestitev PWA ni nujna za uporabo v brskalniku */
  });
}

try { localStorage.removeItem("generali_api_key"); } catch { /* ignore */ }

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  stanje.install = event;
  $("namestiBtn").hidden = false;
});

povezi();
osveziZeton();
korak(1);
registrirajDelavca();
naloziDeljeno();
