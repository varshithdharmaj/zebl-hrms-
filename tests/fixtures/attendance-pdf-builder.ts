/**
 * Builds a minimal PDF 1.4 with Helvetica text lines for unpdf/PDF.js extraction tests.
 */
export function buildAttendanceTablePdf(lines: string[]): Uint8Array {
  let content = "BT /F1 10 Tf 40 750 Td 14 TL\n";
  for (let i = 0; i < lines.length; i++) {
    const safe = lines[i]
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    // Embed PDF string newline so extractors preserve row boundaries when possible
    content += i === 0 ? `(${safe}\\n) Tj\n` : `T* (${safe}\\n) Tj\n`;
  }
  content += "ET";

  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);

  const objs: Uint8Array[] = [];
  const pushObj = (s: string) => objs.push(encoder.encode(s));

  pushObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  pushObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  pushObj(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );

  const streamHeader = encoder.encode(
    `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`
  );
  const streamFooter = encoder.encode("\nendstream\nendobj\n");
  const obj4 = new Uint8Array(streamHeader.length + contentBytes.length + streamFooter.length);
  obj4.set(streamHeader, 0);
  obj4.set(contentBytes, streamHeader.length);
  obj4.set(streamFooter, streamHeader.length + contentBytes.length);
  objs.push(obj4);

  pushObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const header = encoder.encode("%PDF-1.4\n");
  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let offset = header.length;
  for (const obj of objs) {
    offsets.push(offset);
    parts.push(obj);
    offset += obj.length;
  }

  let xref = `xref\n0 ${objs.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= objs.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\n`;
  xref += `startxref\n${offset}\n%%EOF\n`;
  parts.push(encoder.encode(xref));

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
