// QR de facturas electrónicas de ARCA: https://www.afip.gob.ar/fe/qr/?p=<base64 de un JSON>
// Campos (versión 1): ver, fecha, cuit, ptoVta, tipoCmp, nroCmp, importe, moneda, ctz, tipoDocRec, nroDocRec, tipoCodAut, codAut
import { CODIGOS_NC } from './csv';

export type DatosQR = {
  fecha: string; cuit: string; ptoVta: number; tipoCmp: number; nroCmp: number;
  importe: number; moneda: string; ctz: number; totalPesos: number; codAut: string; esNotaCredito: boolean;
};

function decodeBase64(b64: string): string {
  const limpio = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  const rellenado = limpio + '='.repeat((4 - (limpio.length % 4)) % 4);
  const bin = atob(rellenado);
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

/** Devuelve los datos o un texto con el motivo por el que no sirve. */
export function leerQR(texto: string): DatosQR | string {
  const t = texto.trim();
  const m = t.match(/[?&]p=([^&#\s]+)/);
  if (!m || !/\/fe\/qr\//i.test(t)) return 'Eso no parece el QR de una factura electrónica de ARCA.';
  let j: Record<string, unknown>;
  try { j = JSON.parse(decodeBase64(decodeURIComponent(m[1]))); } catch { return 'No se pudo leer el contenido del QR.'; }
  const cuit = String(j.cuit ?? '').replace(/\D/g, '');
  const fecha = String(j.fecha ?? '');
  // El importe suele venir como número, pero si viene como texto con puntos de miles o coma decimal ("12.345,67") también se entiende.
  const aNumero = (v: unknown): number => {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').trim();
    return /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  };
  const importe = aNumero(j.importe), ctz = aNumero(j.ctz ?? 1) || 1;
  const tipo = Number(j.tipoCmp), pv = Number(j.ptoVta), nro = Number(j.nroCmp);
  if (cuit.length !== 11 || !/^\d{4}-\d{2}-\d{2}/.test(fecha) || !isFinite(importe) || !isFinite(tipo) || !isFinite(nro))
    return 'El QR no tiene todos los datos de la factura.';
  const moneda = String(j.moneda ?? 'PES');
  return { fecha: fecha.slice(0, 10), cuit, ptoVta: isFinite(pv) ? pv : 0, tipoCmp: tipo, nroCmp: nro, importe, moneda, ctz,
    totalPesos: Math.round(importe * (moneda === 'PES' ? 1 : ctz) * 100) / 100, codAut: String(j.codAut ?? ''), esNotaCredito: CODIGOS_NC.has(tipo) };
}

/** Busca un QR en una imagen (File de foto) o en la primera página de un PDF. */
export async function qrDesdeArchivo(file: File): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  const leer = (c: HTMLCanvasElement | OffscreenCanvas) => {
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const d = ctx.getImageData(0, 0, c.width, c.height);
    return jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  };
  const sobreCanvas = (w: number, h: number, dibujar: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    dibujar(c.getContext('2d')!); return c;
  };
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
      const page = await pdf.getPage(n);
      for (const escala of [2, 3]) {
        const vp = page.getViewport({ scale: escala });
        const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        await page.render({ canvas: c, viewport: vp }).promise;
        const r = leer(c); if (r) return r;
      }
    }
    return null;
  }
  const bmp = await createImageBitmap(file);
  for (const lado of [1600, 2400, bmp.width]) {
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = sobreCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k), ctx => ctx.drawImage(bmp, 0, 0, Math.round(bmp.width * k), Math.round(bmp.height * k)));
    const r = leer(c); if (r) return r;
  }
  return null;
}
