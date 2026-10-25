export function jePdf(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  const poImenu = name.endsWith(".pdf");
  if (type === "application/pdf") return true;
  if (type === "application/octet-stream" && poImenu) return true;
  if (!type && poImenu) return true;
  return false;
}

export function preveriDatoteko(file, { maxBytes }) {
  if (!file) return "Izberite PDF datoteko.";
  if (!jePdf(file)) return "Dovoljene so samo PDF datoteke.";
  if (!file.size) return "Datoteka je prazna.";
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `Datoteka je prevelika (največ ${mb} MB).`;
  }
  return "";
}
