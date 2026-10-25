export function oznakaTipa(tip) {
  if (tip === "avto") return "Avtomobilsko";
  if (tip === "dom") return "Dom";
  return "";
}

export function opozorila(p) {
  const out = [];
  const tip = String(p?.tip || "").trim().toLowerCase();
  if (tip !== "avto" && tip !== "dom") {
    out.push("Vrsta police ni prepoznana. Izberite avto ali dom.");
  }
  const premija = Number(p?.premija);
  if (!Number.isFinite(premija) || premija <= 0) {
    out.push("Premija je 0 € ali manjka. Preverite znesek.");
  } else if (premija > 20_000) {
    out.push("Premija je zelo visoka. Preverite znesek.");
  }
  if (!String(p?.ime || "").trim()) {
    out.push("Ime stranke ni bilo najdeno. Pozdrav bo splošen.");
  }
  if (tip === "avto") {
    if (!String(p.registrska || "").trim()) out.push("Manjka registrska številka.");
    if (!String(p.znamkaModel || "").trim()) out.push("Manjka znamka in model.");
    if (!(Number(p.aoStvari) > 0) && !(Number(p.aoOsebe) > 0)) out.push("AO nima zavarovalne vsote.");
    const asist = String(p.asistenca || "").trim().toUpperCase();
    if (asist && asist !== "L" && asist !== "M") {
      out.push("Asistenca ni L ali M, zato razdalja pomoči ni določena.");
    }
    const pari = [
      ["Prometna nesreča", p.kaskoPromet, p.kaskoPrometOdstotek],
      ["Parkirišče", p.kaskoParkirisce, p.kaskoParkirisceOdstotek],
      ["Stekla", p.kaskoStekla, p.kaskoSteklaOdstotek],
      ["Svetlobna telesa", p.kaskoSvetloba, p.kaskoSvetlobaOdstotek],
      ["Živali", p.kaskoZivali, p.kaskoZivaliOdstotek],
    ];
    for (const [label, on, pct] of pari) {
      if (on && Number(pct) > 30) out.push(`Franšiza za ${label} je ${pct} %, kar je nenavadno visoko.`);
    }
  }
  if (tip === "dom" && !String(p.naslov || "").trim()) {
    out.push("Manjka naslov nepremičnine. Vnesite ga ročno — naslov ni bil poslan v model.");
  }
  return out;
}
