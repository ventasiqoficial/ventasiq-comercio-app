// Importador de "Mis Comprobantes" (ARCA). Formato SIN verificar: detecta columnas por nombre aproximado
// y siempre muestra vista previa antes de guardar.
export type Fila = Record<string, string>;

export function parseCSV(texto: string): Fila[] {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = []; let cur: string[] = []; let campo = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === sep) { cur.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; cur.push(campo); campo = ''; if (cur.some(x => x !== '')) filas.push(cur); cur = []; }
    else campo += c;
  }
  if (campo !== '' || cur.length) { cur.push(campo); if (cur.some(x => x !== '')) filas.push(cur); }
  if (!filas.length) return [];
  const enc = filas[0].map(h => h.trim());
  return filas.slice(1).map(f => Object.fromEntries(enc.map((h, i) => [h, (f[i] ?? '').trim()])));
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function col(fila: Fila, ...alias: string[]): string {
  const m = new Map(Object.keys(fila).map(k => [norm(k), k]));
  for (const a of alias) { const k = m.get(norm(a)); if (k !== undefined) return fila[k]; }
  for (const a of alias) for (const [n, k] of m) if (n.includes(norm(a))) return fila[k];
  return '';
}

/** Números AR ("1.234,56") o con punto decimal ("1234.56"). */
export function numero(s: string): number {
  let x = s.trim().replace(/\s|\$/g, '');
  if (!x) return 0;
  if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
  else if ((x.match(/\./g)?.length ?? 0) > 1) x = x.replace(/\./g, '');
  const n = Number(x);
  return isFinite(n) ? n : 0;
}

/** dd/mm/aaaa o aaaa-mm-dd -> aaaa-mm-dd */
export function fecha(s: string): string | null {
  const a = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (a) return `${a[3]}-${a[2].padStart(2, '0')}-${a[1].padStart(2, '0')}`;
  const b = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return b ? `${b[1]}-${b[2]}-${b[3]}` : null;
}

export const CODIGOS_NC = new Set([3, 8, 13, 53, 203, 208, 213]);
const codigoTipo = (s: string) => { const m = s.match(/^\s*(\d{1,3})/); return m ? Number(m[1]) : NaN; };

export type CompraImp = { fecha: string; tipo_comprobante: string; punto_venta: number; numero: number; cuit_emisor: string; neto: number; iva: number; total: number; es_nota_credito: boolean; origen: 'mis_comprobantes' };
export type EmitidoImp = { fecha: string; tipo_comprobante: string; punto_venta: number; numero: number; cuit_cliente: string | null; importe: number; es_nota_credito: boolean; cae: string | null; origen: 'mis_comprobantes' };

export function aCompras(filas: Fila[]): { ok: CompraImp[]; descartadas: number } {
  const ok: CompraImp[] = []; let descartadas = 0;
  for (const f of filas) {
    const fch = fecha(col(f, 'Fecha de Emisión', 'Fecha', 'Fecha Emision'));
    const tipoRaw = col(f, 'Tipo de Comprobante', 'Tipo');
    const cod = codigoTipo(tipoRaw);
    const numeroC = Math.trunc(numero(col(f, 'Número Desde', 'Numero', 'Número')));
    const cuit = col(f, 'Nro. Doc. Emisor', 'CUIT Emisor', 'CUIT').replace(/\D/g, '');
    const total = numero(col(f, 'Imp. Total', 'Importe Total', 'Total'));
    if (!fch || !cuit || !numeroC || isNaN(cod)) { descartadas++; continue; }
    const nc = CODIGOS_NC.has(cod);
    ok.push({ fecha: fch, tipo_comprobante: String(cod).padStart(3, '0'), punto_venta: Math.trunc(numero(col(f, 'Punto de Venta', 'Pto Vta'))), numero: numeroC, cuit_emisor: cuit,
      neto: Math.abs(numero(col(f, 'Neto Gravado Total', 'Neto Gravado', 'Neto'))), iva: Math.abs(numero(col(f, 'Total IVA', 'IVA'))), total: Math.abs(total), es_nota_credito: nc, origen: 'mis_comprobantes' });
  }
  return { ok, descartadas };
}

export function aEmitidos(filas: Fila[]): { ok: EmitidoImp[]; descartadas: number } {
  const ok: EmitidoImp[] = []; let descartadas = 0;
  for (const f of filas) {
    const fch = fecha(col(f, 'Fecha de Emisión', 'Fecha', 'Fecha Emision'));
    const cod = codigoTipo(col(f, 'Tipo de Comprobante', 'Tipo'));
    const numeroC = Math.trunc(numero(col(f, 'Número Desde', 'Numero', 'Número')));
    if (!fch || !numeroC || isNaN(cod)) { descartadas++; continue; }
    const cuit = col(f, 'Nro. Doc. Receptor', 'CUIT Receptor').replace(/\D/g, '');
    ok.push({ fecha: fch, tipo_comprobante: String(cod), punto_venta: Math.trunc(numero(col(f, 'Punto de Venta', 'Pto Vta'))), numero: numeroC,
      cuit_cliente: cuit && cuit !== '0' ? cuit : null, importe: Math.abs(numero(col(f, 'Imp. Total', 'Importe Total', 'Total'))),
      es_nota_credito: CODIGOS_NC.has(cod), cae: col(f, 'Cód. Autorización', 'CAE') || null, origen: 'mis_comprobantes' });
  }
  return { ok, descartadas };
}
