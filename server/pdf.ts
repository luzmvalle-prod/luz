// Gerador mínimo de PDF (uma página, texto) para os anexos de exemplo do seed.
export function pdfSimples(titulo: string, linhas: string[]): Uint8Array {
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const corpo = [
    'BT /F1 16 Tf 56 780 Td (' + esc(titulo) + ') Tj ET',
    ...linhas.map((l, i) => `BT /F1 11 Tf 56 ${748 - i * 18} Td (${esc(l)}) Tj ET`),
  ].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${corpo.length} >>\nstream\n${corpo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Latin-1: um byte por caractere (os textos do seed não passam de U+00FF).
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff);
}
