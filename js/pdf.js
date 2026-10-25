import * as pdfjs from "../vendor/pdfjs/pdf.min.mjs";
import { CONFIG } from "../lib/config.js";

let pripravljeno = false;

function pripravi() {
  if (pripravljeno) return;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  pripravljeno = true;
}

function vrsticeIzVsebine(content) {
  let out = "";
  let lastY = null;
  for (const item of content.items || []) {
    if (!item || !item.str) continue;
    const y = item.transform ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) out += "\n";
    else if (out && !out.endsWith("\n") && !out.endsWith(" ")) out += " ";
    out += item.str;
    if (y !== null) lastY = y;
  }
  return out;
}

export async function preberiPdf(file) {
  pripravi();
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  } catch (err) {
    if (err && (err.name === "PasswordException" || /password/i.test(String(err.message || "")))) {
      throw new Error("PDF je zaklenjen z geslom.");
    }
    throw new Error("PDF-ja ni bilo mogoče odpreti.");
  }
  const prebranih = Math.min(pdf.numPages, CONFIG.maxStrani);
  let text = "";
  for (let i = 1; i <= prebranih; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += `${vrsticeIzVsebine(content)}\n`;
  }
  return { pdf, text, strani: pdf.numPages, prebranih };
}

export async function narisiPredogled(pdf, container) {
  container.replaceChildren();
  const pages = Math.min(pdf.numPages, 4);
  const width = Math.max(container.clientWidth || 320, 280);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (let i = 1; i <= pages; i += 1) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = (width / base.width) * dpr;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = "100%";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Stran ${i} od ${pdf.numPages}`);
    container.append(canvas);
    const task = page.render({ canvas, viewport });
    await task.promise;
  }
  if (pdf.numPages > pages) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = `Predogled kaže prve ${pages} od ${pdf.numPages} strani.`;
    container.append(note);
  }
}
