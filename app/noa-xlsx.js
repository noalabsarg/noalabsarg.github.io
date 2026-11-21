/* Genera archivos .xlsx reales (con fórmulas y formatos) sin librerías externas.
   NOA_XLSX.bajar("archivo.xlsx", [{nombre, columnas:[anchos], filas:[[celda,...]]}])
   Celda: texto | número | {v, f:"SUM(B2:B9)", z:"plata"|"fecha"|"pct", b:true} */
window.NOA_XLSX = (function () {
  "use strict";
  const enc = new TextEncoder();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const col = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const ESTILO = {"": 0, b: 1, plata: 2, fecha: 3, "b-plata": 4, pct: 5};
  const serial = d => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) - Date.UTC(1899, 11, 30)) / 864e5;

  function hoja(h) {
    const filas = h.filas.map((fila, r) => `<row r="${r + 1}">` + fila.map((c, k) => {
      if (c === null || c === undefined || c === "") return "";
      const ref = col(k) + (r + 1), o = typeof c === "object" && !(c instanceof Date) ? c : {v: c};
      const st = ESTILO[(o.b ? "b" : "") + (o.b && o.z ? "-" : "") + (o.z || "")] ?? (o.z ? ESTILO[o.z] : o.b ? 1 : 0);
      const s = st ? ` s="${st}"` : "";
      if (o.f) return `<c r="${ref}"${s}><f>${esc(o.f)}</f></c>`;
      if (o.v instanceof Date) return `<c r="${ref}" s="3"><v>${serial(o.v)}</v></c>`;
      if (typeof o.v === "number" && isFinite(o.v)) return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
    }).join("") + "</row>").join("");
    const cols = h.columnas ? `<cols>${h.columnas.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${filas}</sheetData></worksheet>`;
  }

  function archivos(hojas) {
    const f = {};
    f["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
    f["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    f["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${esc(h.nombre.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    f["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    f["xl/styles.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="0%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    hojas.forEach((h, i) => f[`xl/worksheets/sheet${i + 1}.xml`] = hoja(h));
    return f;
  }

  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  function zip(files) {
    const partes = [], central = [];
    let off = 0;
    for (const [nombre, texto] of Object.entries(files)) {
      const n = enc.encode(nombre), d = enc.encode(texto), c = crc32(d);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true);
      partes.push(new Uint8Array(h.buffer), n, d);
      const ce = new DataView(new ArrayBuffer(46));
      ce.setUint32(0, 0x02014b50, true); ce.setUint16(4, 20, true); ce.setUint16(6, 20, true); ce.setUint16(8, 0x0800, true);
      ce.setUint32(16, c, true); ce.setUint32(20, d.length, true); ce.setUint32(24, d.length, true); ce.setUint16(28, n.length, true); ce.setUint32(42, off, true);
      central.push(new Uint8Array(ce.buffer), n);
      off += 30 + n.length + d.length;
    }
    const tam = central.reduce((a, b) => a + b.length, 0), fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, Object.keys(files).length, true); fin.setUint16(10, Object.keys(files).length, true);
    fin.setUint32(12, tam, true); fin.setUint32(16, off, true);
    return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }

  function bajar(nombre, hojas) {
    const blob = zip(archivos(hojas)), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nombre; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return blob;
  }
  return {bajar, _blob: hojas => zip(archivos(hojas))};
})();
