function parts(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  const negative = rounded < 0;
  const [int, dec] = Math.abs(rounded).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return { negative, grouped, dec };
}

/** Evri: celi zneski brez decimalk, sicer dve decimalki (486,50 €). */
export function formatEur(value) {
  const p = parts(value);
  if (!p) return "0 €";
  const body = p.dec === "00" ? p.grouped : `${p.grouped},${p.dec}`;
  return `${p.negative ? "-" : ""}${body} €`;
}

/** Površine in odstotki: odvečne ničle se odrežejo (8,5). */
export function formatStevilo(value) {
  const p = parts(value);
  if (!p) return "0";
  const trimmed = p.dec.replace(/0+$/, "");
  const body = trimmed ? `${p.grouped},${trimmed}` : p.grouped;
  return `${p.negative ? "-" : ""}${body}`;
}
