import { parseCSV, type Fila } from './csv';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Convierte una matriz de celdas a filas con nombre de columna. Busca la fila de encabezados
 *  (la primera que tenga "fecha" y varias celdas con texto), por si el archivo trae títulos arriba. */
export function matrizAFilas(m: unknown[][]): Fila[] {
  const texto = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).trim();
  };
  const idx = m.findIndex(r => r.filter(c => texto(c) !== '').length >= 4 && r.some(c => sinTildes(texto(c)).includes('fecha')));
  if (idx < 0) return [];
  const enc = m[idx].map(texto);
  return m.slice(idx + 1)
    .filter(r => r.some(c => texto(c) !== ''))
    .map(r => Object.fromEntries(enc.map((h, i) => [h, texto(r[i])])));
}

/** Lee Excel (.xlsx) o CSV desde un archivo elegido por el usuario. */
export async function leerTabla(file: File): Promise<Fila[]> {
  const n = file.name.toLowerCase();
  if (n.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    return matrizAFilas((await readSheet(file)) as unknown[][]);
  }
  if (n.endsWith('.xls')) throw new Error('Ese Excel es de formato viejo (.xls). Abrilo y guardalo como .xlsx, o descargá el CSV desde ARCA.');
  return parseCSV(await file.text());
}
