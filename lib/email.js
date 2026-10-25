import { CONFIG } from "./config.js";
import { formatEur, formatStevilo } from "./money.js";
import { praznaPolja } from "./polja.js";

function pozdrav(ime) {
  const clean = String(ime || "").replace(/[\r\n]+/g, " ").trim();
  return clean ? `Spoštovani ${clean},` : "Spoštovani,";
}

function franšiza(odstotek, eur) {
  const pct = Number(odstotek) || 0;
  const amount = Number(eur) || 0;
  if (pct <= 0 && amount <= 0) return "brez franšize";
  if (pct > 0 && amount > 0) return `franšiza ${formatStevilo(pct)}% (~${formatEur(amount)})`;
  if (pct > 0) return `franšiza ${formatStevilo(pct)}%`;
  return `franšiza ${formatEur(amount)}`;
}

function zakljucek(premija) {
  return [
    "",
    `SKUPNA LETNA PREMIJA: ${formatEur(premija)}`,
    "",
    CONFIG.zakljucek,
    "",
    CONFIG.pozdrav,
    "",
    CONFIG.podpis.ime,
    CONFIG.podpis.vrstica,
  ];
}

function imaKasko(p) {
  return [
    "odkupPrveSkode", "kaskoPromet", "kaskoPozar", "kaskoNarava", "kaskoZlonamerna",
    "kaskoToca", "kaskoKraja", "kaskoParkirisce", "kaskoStekla", "kaskoSvetloba", "kaskoZivali",
  ].some((key) => p[key]);
}

function vrsticeAvto(p) {
  const out = [pozdrav(p.ime), "", "OBVEZNA ZAVAROVANJA"];
  out.push("- AO – avtomobilska odgovornost");
  out.push(`  ↳ stvari do ${formatEur(p.aoStvari)} / osebe do ${formatEur(p.aoOsebe)} + zelena karta`);
  if (Number(p.aoPlusVsota) > 0) {
    out.push("- AO+ – zavarovanje voznika");
    out.push(`  ↳ telesne poškodbe do ${formatEur(p.aoPlusVsota)}`);
  }
  if (p.aoZamrznjen) {
    out.push("- ⚠️ Vključen zamrznjen bonus – prva škoda ne vpliva na vaš premijski razred");
  }
  if (Number(p.nezgodaSmrt) > 0 || Number(p.nezgodaInvalidnost) > 0) {
    out.push("- Nezgoda – nezgodno zavarovanje oseb");
    out.push(`  ↳ smrt ${formatEur(p.nezgodaSmrt)} / invalidnost ${formatEur(p.nezgodaInvalidnost)} po osebi, vsi potniki`);
  }
  if (Number(p.pravnaVsota) > 0) {
    out.push("- Pravna zaščita");
    out.push(`  ↳ do ${formatEur(p.pravnaVsota)}`);
  }
  const asist = String(p.asistenca || "").trim().toUpperCase();
  if (asist) {
    const znana = asist === "L" || asist === "M";
    const km = znana ? CONFIG.asistencaKm[asist] : 0;
    out.push(`- ${znana ? `Asistenca ${asist}` : "Asistenca"}`);
    const razdalja = km
      ? `pomoč na cesti do ${km} km`
      : "pomoč na cesti (razdalja ni določena kot L ali M)";
    out.push(`  ↳ ${razdalja}, nadomestno vozilo do ${CONFIG.nadomestnoVoziloDni} dni pri okvari`);
  }

  if (imaKasko(p)) {
    out.push("", "KASKO ZAVAROVANJE");
    if (p.odkupPrveSkode) {
      out.push("- ⚠️ Vključen odkup prve škode – prva škoda ne vpliva na vaš premijski razred");
    }
    if (p.kaskoPromet) {
      out.push("- Prometna nesreča");
      out.push(`  ↳ ${franšiza(p.kaskoPrometOdstotek, p.kaskoPrometEur)}`);
    }
    const brez = [
      ["kaskoPozar", "Požar"],
      ["kaskoNarava", "Narava (vihar, poplave, potres...)"],
      ["kaskoZlonamerna", "Zlonamerna in objestna dejanja"],
      ["kaskoToca", "Toča (delni kasko)"],
      ["kaskoKraja", "Kraja (delni kasko)"],
    ];
    for (const [key, label] of brez) {
      if (!p[key]) continue;
      out.push(`- ${label}`);
      out.push("  ↳ brez franšize");
    }
    const zFran = [
      ["kaskoParkirisce", "Parkirišče", "kaskoParkirisceOdstotek", "kaskoParkirisceEur"],
      ["kaskoStekla", "Stekla", "kaskoSteklaOdstotek", "kaskoSteklaEur"],
      ["kaskoSvetloba", "Svetlobna telesa in ogledala", "kaskoSvetlobaOdstotek", "kaskoSvetlobaEur"],
      ["kaskoZivali", "Živali", "kaskoZivaliOdstotek", "kaskoZivaliEur"],
    ];
    for (const [flag, label, pct, eur] of zFran) {
      if (!p[flag]) continue;
      out.push(`- ${label}`);
      out.push(`  ↳ ${franšiza(p[pct], p[eur])}`);
    }
  }
  out.push(...zakljucek(p.premija));
  return out;
}

function vrsticeDom(p) {
  const tip = String(p.domTip || "").trim();
  const izvedba = String(p.domIzvedba || "").trim();
  const stavba = [tip, izvedba].filter(Boolean).join(", ");
  const out = [
    pozdrav(p.ime),
    "",
    "PODATKI O STANOVANJU",
    `- Stanovanje v ${stavba || "—"}`,
    `  ↳ leto izgradnje: ${String(p.domLeto || "").trim() || "—"}`,
    `- Število gospodinjstev: ${String(p.domGospodinjstva || "").trim() || "—"}`,
    `- Material nosilne konstrukcije: ${String(p.domMaterial || "").trim() || "—"}`,
    `  ↳ strešna kritina: ${String(p.domKritina || "").trim() || "—"}`,
    "- Površine:",
    `  ↳ bivalni prostor: ${formatStevilo(p.domBivalni)} m²`,
  ];
  if (Number(p.domTerasa) > 0) out.push(`  ↳ odprta terasa/balkon/loža: ${formatStevilo(p.domTerasa)} m²`);
  if (Number(p.domKlet) > 0) out.push(`  ↳ kletni prostori: ${formatStevilo(p.domKlet)} m²`);
  if (Number(p.domGaraza) > 0) out.push(`  ↳ garaža: ${formatStevilo(p.domGaraza)} m²`);
  out.push(`  ↳ koristna površina skupaj: ${formatStevilo(p.domKoristna)} m²`, "", "PONUDBA");
  if (p.domNepremicnina) {
    out.push("- Zavarovanje nepremičnine");
    out.push(`  ↳ način zavarovanja: ${String(p.domNepremicninaNacin || "").trim() || "—"}`);
    out.push(`  ↳ zavarovalna vsota: ${formatEur(p.domNepremicninaVsota)}`);
    out.push("  ↳ kritja: osnovni paket – podrobnosti v priloženi brošuri");
  }
  if (p.domPremicnine) {
    out.push("- Zavarovanje premičnin");
    out.push(`  ↳ način zavarovanja: ${String(p.domPremicnineNacin || "").trim() || "—"}`);
    out.push(`  ↳ zavarovalna vsota: ${formatEur(p.domPremicnineVsota)}`);
    out.push("  ↳ kritja: osnovni paket – podrobnosti v priloženi brošuri");
  }
  if (p.domOdgovornost) {
    out.push("- Zavarovanje odgovornosti zasebnika in hišne odgovornosti");
    out.push(`  ↳ zavarovalna vsota: ${formatEur(p.domOdgovornostVsota)}`);
    out.push("  ↳ franšiza: brez");
  }
  out.push(...zakljucek(p.premija));
  return out;
}

export function zadevaZa(polja) {
  const tip = String(polja.tip || "").trim().toLowerCase();
  if (tip === "avto") {
    const deli = [polja.znamkaModel, polja.registrska].map((s) => String(s || "").trim()).filter(Boolean);
    return deli.length
      ? `Obnova avtomobilskega zavarovanja – ${deli.join(" ")}`
      : "Obnova avtomobilskega zavarovanja";
  }
  if (tip === "dom") {
    const naslov = String(polja.naslov || "").trim();
    return naslov ? `Zavarovanje nepremičnine – ${naslov}` : "Zavarovanje nepremičnine";
  }
  throw new Error("Neznana vrsta police. Izberite avto ali dom.");
}

export function sestaviMail(vhod) {
  const p = { ...praznaPolja(), ...vhod };
  p.tip = String(p.tip || "").trim().toLowerCase();
  p.asistenca = String(p.asistenca || "").trim();
  if (p.asistenca.toUpperCase() === "L" || p.asistenca.toUpperCase() === "M") {
    p.asistenca = p.asistenca.toUpperCase();
  }
  const vrstice = p.tip === "avto" ? vrsticeAvto(p) : p.tip === "dom" ? vrsticeDom(p) : null;
  if (!vrstice) throw new Error("Neznana vrsta police. Izberite avto ali dom.");
  return {
    tip: p.tip,
    zadeva: zadevaZa(p),
    mail: vrstice.join("\n"),
  };
}
