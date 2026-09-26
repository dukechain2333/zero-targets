// Renders a TargetScene (plus the setup-specific guide) to a PDF at 1:1 scale with jsPDF.
// jsPDF is loaded on demand so it stays out of the initial page bundle.

import type { Guide } from "../guide";
import type { PageScene, Prim } from "./scene";

const PT = 1 / 72;

/** The standard PDF fonts only cover WinAnsi; keep text to safe characters. */
const pdfSafe = (s: string) =>
  s.replace(/[−–]/g, "-").replace(/—/g, " - ").replace(/≈/g, "~").replace(/×/g, "x").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

type JsPdf = import("jspdf").jsPDF;

function drawPrim(doc: JsPdf, p: Prim) {
  switch (p.t) {
    case "line":
      doc.setDrawColor(p.color);
      doc.setLineWidth(p.w * PT);
      doc.setLineCap(p.cap ?? "butt");
      if (p.dash) doc.setLineDashPattern([p.dash, p.dash], 0);
      doc.line(p.x1, p.y1, p.x2, p.y2);
      if (p.dash) doc.setLineDashPattern([], 0);
      break;
    case "circle": {
      if (p.fill) doc.setFillColor(p.fill);
      if (p.stroke) {
        doc.setDrawColor(p.stroke);
        doc.setLineWidth((p.w ?? 1) * PT);
      }
      doc.circle(p.cx, p.cy, p.r, p.fill && p.stroke ? "FD" : p.fill ? "F" : "S");
      break;
    }
    case "rect": {
      if (p.fill) doc.setFillColor(p.fill);
      if (p.stroke) {
        doc.setDrawColor(p.stroke);
        doc.setLineWidth((p.lw ?? 1) * PT);
      }
      const style = p.fill && p.stroke ? "FD" : p.fill ? "F" : "S";
      if (p.radius) doc.roundedRect(p.x, p.y, p.w, p.h, p.radius, p.radius, style);
      else doc.rect(p.x, p.y, p.w, p.h, style);
      break;
    }
    case "tri":
      doc.setFillColor(p.fill);
      doc.triangle(p.pts[0][0], p.pts[0][1], p.pts[1][0], p.pts[1][1], p.pts[2][0], p.pts[2][1], "F");
      break;
    case "text": {
      const s = pdfSafe(p.text);
      doc.setFont("helvetica", p.bold ? "bold" : "normal");
      doc.setFontSize(p.size);
      const w = doc.getTextWidth(s);
      const x0 = p.align === "center" ? p.x - w / 2 : p.align === "right" ? p.x - w : p.x;
      if (p.halo) {
        doc.setFillColor(p.halo);
        doc.rect(x0 - 0.04, p.y - p.size * PT * 0.8, w + 0.08, p.size * PT * 1.05, "F");
      }
      doc.setTextColor(p.color);
      doc.text(s, x0, p.y);
      break;
    }
  }
}

function drawGuidePage(doc: JsPdf, guide: Guide, widthIn: number, heightIn: number) {
  const M = 0.6;
  const maxW = widthIn - 2 * M;
  let y = M + 0.2;

  const ensureRoom = (h: number) => {
    if (y + h > heightIn - M) {
      doc.addPage([widthIn, heightIn], "portrait");
      y = M + 0.2;
    }
  };
  const para = (s: string, size: number, bold = false, gapAfter = 0.08, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(pdfSafe(s), maxW - indent);
    const lh = size * PT * 1.3;
    ensureRoom(lines.length * lh);
    doc.setTextColor("#000000");
    doc.text(lines, M + indent, y);
    y += lines.length * lh + gapAfter;
  };

  para(guide.title, 16, true, 0.03);
  para(guide.subtitle, 9.5, false, 0.2);

  // Setup summary, two columns.
  doc.setFontSize(9);
  const rowH = 9 * PT * 1.4;
  ensureRoom(guide.facts.length * rowH + 0.2);
  doc.setDrawColor("#999999");
  doc.setLineWidth(0.5 * PT);
  doc.line(M, y - 0.1, widthIn - M, y - 0.1);
  for (const [label, value] of guide.facts) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#555555");
    doc.text(pdfSafe(label), M, y + 0.05);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#000000");
    doc.text(pdfSafe(value), M + 2.3, y + 0.05);
    y += rowH;
  }
  doc.line(M, y - 0.02, widthIn - M, y - 0.02);
  y += 0.25;

  guide.steps.forEach((step, i) => {
    para(`${i + 1}. ${step.heading}`, 10.5, true, 0.02);
    for (const b of step.body) para(b, 9.5, false, 0.03, 0.22);
    y += 0.06;
  });

  if (guide.notes.length) {
    y += 0.04;
    para("Notes", 10.5, true, 0.02);
    for (const n of guide.notes) para(`- ${n}`, 8.5, false, 0.03, 0.1);
  }
}

/** One printed part of the pack: a drawn page, or the guide (which flows onto as many pages as it needs). */
export type PackPart = { kind: "page"; scene: PageScene } | { kind: "guide"; guide: Guide };

/** Render the print pack (any mix of target, guide, cards and table pages) as one PDF, 1:1 scale. */
export async function renderPackPdf(parts: PackPart[], paper: { widthIn: number; heightIn: number }, title: string): Promise<JsPdf> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "in", format: [paper.widthIn, paper.heightIn], orientation: "portrait" });
  doc.setProperties({ title, subject: "Zeroing target and ballistic data", creator: "zero-targets" });
  parts.forEach((part, i) => {
    if (i > 0) doc.addPage([paper.widthIn, paper.heightIn], "portrait");
    if (part.kind === "page") for (const p of part.scene.prims) drawPrim(doc, p);
    else drawGuidePage(doc, part.guide, paper.widthIn, paper.heightIn);
  });
  return doc;
}
